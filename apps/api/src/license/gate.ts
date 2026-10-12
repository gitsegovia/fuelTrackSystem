import { GraphQLFieldResolver } from "graphql";
import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../interfaces";
import { PUBLIC_OPERATIONS } from "../authz/policy";
import { assertStationLimit, assertWritable, scheduleImmediateRevalidation } from "./service";

type AnyResolver = GraphQLFieldResolver<unknown, Context>;

// Única mutation con un tope de negocio además de solo-lectura. Reactivar no es una mutation
// (T-055: solo CCI Innovation puede, con el script reactivate-station, que revisa el mismo tope
// por su cuenta — ver src/scripts/reactivate-station.ts).
const STATION_LIMIT_OPS = new Set(["createGasStation"]);

// T-055, criterio 4: tras cualquiera de estas, validar contra CCI Licencias enseguida (en segundo
// plano, con antirrebote) en vez de esperar las 24h — cambian activeStations. (deactivateGasStation
// cambia el conteo; reactivar lo dispara desde el propio script, sin pasar por este gate.)
const IMMEDIATE_REVALIDATION_OPS = new Set(["createGasStation", "deactivateGasStation"]);

function guardMutation(field: string, resolve: AnyResolver): AnyResolver {
  if (PUBLIC_OPERATIONS.has(`Mutation.${field}`)) return resolve;
  return async (parent, args, context, info) => {
    await assertWritable(context.models);
    if (STATION_LIMIT_OPS.has(field)) await assertStationLimit(context.models);
    const result = await resolve(parent, args, context, info);
    if (IMMEDIATE_REVALIDATION_OPS.has(field)) scheduleImmediateRevalidation(context.models);
    return result;
  };
}

// Se aplica después de la autorización (para no filtrar el estado de la licencia a quien no
// tiene sesión) y antes de la idempotencia (para que una mutation bloqueada no quede APPLIED).
// Ver el orden completo en graphql/index.ts.
export function applyLicenseGate(resolvers: IResolvers<any>[]): IResolvers<any>[] {
  return resolvers.map((map: any) => {
    if (!map.Mutation) return map;
    return {
      ...map,
      Mutation: Object.fromEntries(
        Object.entries(map.Mutation).map(([field, fn]) => [field, guardMutation(field, fn as AnyResolver)])
      ),
    };
  });
}
