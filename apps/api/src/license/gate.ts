import { GraphQLFieldResolver } from "graphql";
import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../interfaces";
import { PUBLIC_OPERATIONS } from "../authz/policy";
import { assertStationLimit, assertWritable } from "./service";

type AnyResolver = GraphQLFieldResolver<unknown, Context>;

// Única mutation con un tope de negocio además de solo-lectura (T-050, criterio 4). GasStation no
// tiene hoy un estado "inactiva" que se pueda reactivar, así que no hay otra operación que revise.
const STATION_LIMIT_OPS = new Set(["createGasStation"]);

function guardMutation(field: string, resolve: AnyResolver): AnyResolver {
  if (PUBLIC_OPERATIONS.has(`Mutation.${field}`)) return resolve;
  return async (parent, args, context, info) => {
    await assertWritable(context.models);
    if (STATION_LIMIT_OPS.has(field)) await assertStationLimit(context.models);
    return resolve(parent, args, context, info);
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
