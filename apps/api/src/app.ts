import { ApolloServer } from "@apollo/server";
import type { ApolloServerPlugin } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import express from "express";
import http from "http";
import cors from "cors";
import { Request, Response, NextFunction } from "express";
import config from "./config";
import { sequelize, models } from "./models";
import { typeDefs, resolvers } from "./graphql";
import { verifyToken } from "./middleware/auth";
import { AuthenticatedUser, Context } from "./interfaces";
import { validateLicense } from "./utils/licenseValidator";

// Plugin que persiste un log por cada mutation que llega desde la cola offline.
// Identifica requests offline por la presencia del header x-offline-created-by.
const offlineAuditPlugin: ApolloServerPlugin<Context> = {
  async requestDidStart(requestContext) {
    if (!requestContext.contextValue.offlineSource) return;

    return {
      async executionDidStart(ctx) {
        const { contextValue, request, operation } = ctx;
        if (!contextValue.offlineSource) return;
        if (operation?.operation !== "mutation") return;

        const { createdBy, deviceFingerprint, queuedAt } = contextValue.offlineSource;
        const operationName =
          request.operationName ?? (operation?.name?.value ?? "unknown");

        try {
          await contextValue.models.OfflineMutationLog.create({
            operationName,
            createdBy,
            deviceFingerprint,
            queuedAt: new Date(queuedAt),
            variables: (request.variables as Record<string, unknown>) ?? {},
            userId: contextValue.user?.id ?? null,
          });
        } catch (e) {
          console.warn("[FuelTrack] Failed to write offline audit log:", e);
        }
      },
    };
  },
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

async function startApolloServer() {
  // Primero, validamos la licencia. La aplicación no se detendrá si falla.
  const isLicenseValid = await validateLicense();

  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      offlineAuditPlugin,
    ],
    formatError: (formattedError, error) => {
      console.error("GraphQl Error: ", error);

      return formattedError;
    },
  });

  await server.start();

  if (isLicenseValid) {
    // Si la licencia es válida, configuramos GraphQL y la lógica de la base de datos.
    console.log("Configurando el servidor GraphQL...");
    app.use(
      "/graphql",
      cors<cors.CorsRequest>(),
      express.json(),
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const authHeader = req.headers.authorization;
          const token =
            authHeader && authHeader.startsWith("Bearer ")
              ? authHeader.split(" ")[1]
              : null;

          if (token) {
            req.user = verifyToken(token);
          }
        } catch (error: any) {
          console.error("Autthentication check error: ", error.message);
        }
        next();
      },
      expressMiddleware(server, {
        context: async ({ req }) => {
          const user = req.user || undefined;

          const createdByHeader = req.headers["x-offline-created-by"];
          const offlineSource = createdByHeader
            ? {
                createdBy: String(createdByHeader),
                deviceFingerprint: String(req.headers["x-offline-device-fp"] ?? ""),
                queuedAt: String(req.headers["x-offline-queued-at"] ?? new Date().toISOString()),
              }
            : undefined;

          return { user, models, sequelize, offlineSource };
        },
      })
    );

    try {
      await sequelize.authenticate();
      console.log("Connection to database has been established successfully.");
      await sequelize.sync({ alter: true });
      console.log("Database synced!");
    } catch (error) {
      console.error("Unable to connect to the database: ", error);
      process.exit(1);
    }
  } else {
    // Si la licencia NO es válida, configuramos una respuesta para todas las rutas.
    console.log("Servidor iniciado en modo de licencia inválida.");
    app.use((req, res) => {
      res
        .status(402) // Payment Required
        .header("Content-Type", "text/html; charset=utf-8")
        .send(
          "<h1>Error de Licencia</h1><p>La licencia para este software no es válida o no se pudo verificar. Por favor, contacte al soporte técnico.</p>"
        );
    });
  }

  const PORT = config.port;
  await new Promise<void>((resolve) =>
    httpServer.listen({ port: PORT }, resolve)
  );

  if (isLicenseValid) {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`🚀 Playground available at http://localhost:${PORT}/graphql`);
  } else {
    console.log(
      `Servidor escuchando en http://localhost:${PORT} para mostrar el mensaje de error de licencia.`
    );
  }
}

startApolloServer().catch((err) => {
  console.error("❌ Fatal error starting server:");
  if (err instanceof Error) {
    console.error(err.message);
    console.error(err.stack);
  } else {
    console.error(JSON.stringify(err, null, 2));
    console.error(String(err));
  }
  process.exit(1);
});
