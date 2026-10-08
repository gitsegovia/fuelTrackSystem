import { ApolloServer } from "@apollo/server";
import type { ApolloServerPlugin } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import express from "express";
import http from "http";
import cors from "cors";
import config from "./config";
import { sequelize, models } from "./models";
import { typeDefs, resolvers } from "./graphql";
import { loadRequestUser } from "./authz";
import { Context } from "./interfaces";
import { bootLicense, startDailyRevalidation } from "./license/service";
import { createLoaders } from "./graphql/helpers/dataloaders";

// Plugin que persiste un log por cada mutation que llega desde la cola offline.
// Identifica requests offline por la presencia del header x-offline-created-by.
// Con x-offline-mutation-id el log lo escribe la capa de idempotencia (graphql/helpers/offlineIdempotency).
const offlineAuditPlugin: ApolloServerPlugin<Context> = {
  async requestDidStart(requestContext) {
    if (!requestContext.contextValue.offlineSource) return;
    if (requestContext.contextValue.offlineMutationId) return;

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

async function startApolloServer() {
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

  // La BD hace falta para validar la licencia (modo CCI1 guarda la última licencia verificada
  // para poder arrancar sin red) y para todo lo demás, así que se conecta primero.
  try {
    await sequelize.authenticate();
    console.log("Connection to database has been established successfully.");
    await sequelize.sync({ alter: true });
    console.log("Database synced!");
  } catch (error) {
    console.error("Unable to connect to the database: ", error);
    process.exit(1);
  }

  const isLicenseValid = await bootLicense(models);

  if (isLicenseValid) {
    // Si la licencia es válida (o en modo CCI1, utilizable aunque esté en solo lectura),
    // configuramos GraphQL.
    console.log("Configurando el servidor GraphQL...");
    app.use(
      "/graphql",
      cors<cors.CorsRequest>(),
      express.json(),
      expressMiddleware(server, {
        context: async ({ req }) => {
          const user = await loadRequestUser(models, req.headers.authorization);

          const createdByHeader = req.headers["x-offline-created-by"];
          const offlineSource = createdByHeader
            ? {
                createdBy: String(createdByHeader),
                deviceFingerprint: String(req.headers["x-offline-device-fp"] ?? ""),
                queuedAt: String(req.headers["x-offline-queued-at"] ?? new Date().toISOString()),
              }
            : undefined;

          const mutationIdHeader = req.headers["x-offline-mutation-id"];
          const offlineMutationId = mutationIdHeader ? String(mutationIdHeader) : undefined;

          return { user, models, sequelize, offlineSource, offlineMutationId, loaders: createLoaders(models) };
        },
      })
    );
    startDailyRevalidation(models);
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
