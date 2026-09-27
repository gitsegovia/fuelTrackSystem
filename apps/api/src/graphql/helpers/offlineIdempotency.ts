import { GraphQLError, GraphQLFieldResolver } from "graphql";
import { IResolvers } from "@graphql-tools/utils";
import { Model, ModelStatic, Sequelize, Transaction } from "sequelize";
import { Context } from "../../interfaces";

// Idempotencia de mutations offline (header x-offline-mutation-id).
//
// 1. Transacción externa: INSERT … ON CONFLICT DO NOTHING de la fila de log (unique en
//    clientMutationId) + SELECT … FOR UPDATE. Un duplicado simultáneo se bloquea aquí hasta
//    que el primero termine.
// 2. Fila APPLIED → no se ejecuta el resolver; se devuelve el resultado guardado.
// 3. Si no: el resolver corre con un `sequelize` cuyo transaction() abre un SAVEPOINT en la
//    transacción externa, y la fila pasa a APPLIED antes del commit → efecto y marca son atómicos.
// 4. Error → rollback (nada aplicado) y, fuera de la transacción, la fila queda FAILED para
//    auditoría; un reintento vuelve a ejecutar.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCK_TIMEOUT = "15s";

type Stored =
  | { list: Stored[] }
  | { model: string; values: Record<string, unknown> }
  | { value: unknown };

interface StoredResponse {
  field: string;
  result: Stored;
}

function serialize(value: unknown): Stored {
  if (Array.isArray(value)) return { list: value.map(serialize) };
  if (value instanceof Model) {
    const M = value.constructor as ModelStatic<Model>;
    const plain = value.get({ plain: true }) as Record<string, unknown>;
    const values = Object.fromEntries(
      Object.keys(M.getAttributes()).map((attr) => [attr, plain[attr] ?? null])
    );
    return { model: M.name, values };
  }
  return { value: value ?? null };
}

function hydrate(stored: Stored, sequelize: Sequelize): unknown {
  if ("list" in stored) return stored.list.map((s) => hydrate(s, sequelize));
  if ("model" in stored) {
    const M = Object.values(sequelize.models).find((m) => m.name === stored.model);
    if (!M) throw new Error(`Modelo desconocido en respuesta guardada: ${stored.model}`);
    return M.build(stored.values, { isNewRecord: false, raw: true });
  }
  return stored.value;
}

// Resolvers existentes llaman context.sequelize.transaction(cb): aquí eso se vuelve un savepoint.
function scopedSequelize(sequelize: Sequelize, outer: Transaction): Sequelize {
  return new Proxy(sequelize, {
    get(target, prop) {
      if (prop === "transaction") {
        return (optionsOrCb?: unknown, cb?: unknown) => {
          const [options, fn] =
            typeof optionsOrCb === "function"
              ? [{}, optionsOrCb]
              : [(optionsOrCb as object) ?? {}, cb];
          return (target.transaction as any)({ ...options, transaction: outer }, fn);
        };
      }
      const v = Reflect.get(target, prop, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

function withOfflineIdempotency(
  field: string,
  resolve: GraphQLFieldResolver<unknown, Context>
): GraphQLFieldResolver<unknown, Context> {
  return async (parent, args, context, info) => {
    const clientMutationId = context.offlineMutationId;
    if (!clientMutationId) return resolve(parent, args, context, info);

    if (!UUID_RE.test(clientMutationId)) {
      throw new GraphQLError("x-offline-mutation-id debe ser un UUID.", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const { sequelize, models } = context;
    const src = context.offlineSource;
    const queuedAt = src ? new Date(src.queuedAt) : new Date();
    const logFields = {
      clientMutationId,
      operationName: info.operation.name?.value ?? field,
      createdBy: src?.createdBy ?? context.user?.username ?? "",
      deviceFingerprint: src?.deviceFingerprint ?? "",
      queuedAt: isNaN(queuedAt.getTime()) ? new Date() : queuedAt,
      variables: JSON.parse(JSON.stringify(info.variableValues ?? {})),
      userId: context.user?.id ?? null,
    };

    try {
      return await sequelize.transaction(async (outer) => {
        await sequelize.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`, {
          transaction: outer,
        });
        await models.OfflineMutationLog.bulkCreate([{ ...logFields, status: "PENDING" }], {
          ignoreDuplicates: true,
          transaction: outer,
        });
        const log = await models.OfflineMutationLog.findOne({
          where: { clientMutationId },
          lock: outer.LOCK.UPDATE,
          transaction: outer,
        });
        if (!log) throw new Error("No se pudo registrar la mutation offline.");

        const stored = log.responseData as StoredResponse | null;
        if (log.status === "APPLIED" && stored) {
          if (stored.field !== field) {
            throw new GraphQLError(
              `x-offline-mutation-id ya fue usado por la mutation '${stored.field}'.`,
              { extensions: { code: "BAD_USER_INPUT" } }
            );
          }
          return hydrate(stored.result, sequelize);
        }

        const result = await resolve(
          parent,
          args,
          { ...context, sequelize: scopedSequelize(sequelize, outer) },
          info
        );
        await log.update(
          {
            ...logFields,
            status: "APPLIED",
            responseData: { field, result: serialize(result) } as unknown as Record<string, unknown>,
          },
          { transaction: outer }
        );
        return result;
      });
    } catch (error) {
      await recordFailure(sequelize, logFields).catch((e) =>
        console.warn("[FuelTrack] No se pudo registrar el fallo offline:", e)
      );
      throw error;
    }
  };
}

// No pisa una fila APPLIED (p. ej. si el error fue reusar el id en otra mutation).
async function recordFailure(
  sequelize: Sequelize,
  f: {
    clientMutationId: string;
    operationName: string;
    createdBy: string;
    deviceFingerprint: string;
    queuedAt: Date;
    variables: unknown;
    userId: string | null;
  }
) {
  await sequelize.query(
    `INSERT INTO offline_mutation_logs
       (id, "clientMutationId", "operationName", "createdBy", "deviceFingerprint",
        "queuedAt", variables, "userId", status, "createdAt")
     VALUES (gen_random_uuid(), :clientMutationId, :operationName, :createdBy,
        :deviceFingerprint, :queuedAt, CAST(:variables AS JSONB), :userId, 'FAILED', NOW())
     ON CONFLICT ("clientMutationId") DO UPDATE SET status = 'FAILED'
     WHERE offline_mutation_logs.status IS DISTINCT FROM 'APPLIED'`,
    { replacements: { ...f, variables: JSON.stringify(f.variables) } }
  );
}

// Su respuesta trae tokens: guardarla en responseData dejaría secretos en claro en la BD.
const EXCLUDED = new Set(["login", "refreshSession", "logout"]);

export function applyOfflineIdempotency(maps: IResolvers<any>[]): IResolvers<any>[] {
  return maps.map((map) => {
    const mutation = map.Mutation as Record<string, GraphQLFieldResolver<unknown, Context>> | undefined;
    if (!mutation) return map;
    return {
      ...map,
      Mutation: Object.fromEntries(
        Object.entries(mutation).map(([field, resolve]) => [
          field,
          EXCLUDED.has(field) ? resolve : withOfflineIdempotency(field, resolve),
        ])
      ),
    };
  });
}
