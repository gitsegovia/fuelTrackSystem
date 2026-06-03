import { GraphQLScalarType, Kind } from "graphql";
import {
  UUIDResolver,
  DateTimeResolver,
  JSONResolver,
  JSONObjectResolver,
} from "graphql-scalars";

// Puedes usar DateResolver si solo necesitas fechas sin hora, o DateTimeResolver
const DateResolver = new GraphQLScalarType({
  name: "Date",
  description: "Date custom scalar type",
  serialize(value: unknown) {
    if (value instanceof Date) {
      // <-- Verifica que sea una instancia de Date
      return value.toISOString().split("T")[0]; // Solo la parte de la fecha
    }
    // Si no es una instancia de Date, intenta convertirlo a Date
    const date = new Date(value as string | number); // <-- Cast a string | number
    if (isNaN(date.getTime())) {
      // Valida si la fecha es válida
      throw new Error(
        "Date Scalar serializer expected a valid Date object or string/number convertible to Date."
      );
    }
    return date.toISOString().split("T")[0];
  },
  parseValue(value: unknown) {
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        // Valida si la fecha es válida
        throw new Error(
          "Date Scalar parser expected a valid date string or number."
        );
      }
      return date;
    }
    throw new Error("Date Scalar parser expected a string or number.");
  },
  parseLiteral(ast: any) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
      // <-- También maneja INT para timestamps
      const date = new Date(ast.value);
      if (isNaN(date.getTime())) {
        // Valida si la fecha es válida
        throw new Error(
          "Date Scalar literal parser expected a valid date string or number."
        );
      }
      return date;
    }
    return null;
  },
});

const DecimalScalar = new GraphQLScalarType({
  name: "Decimal",
  description: "Decimal custom scalar type",
  serialize(value: unknown) {
    // Asegúrate de que el valor sea un número o una cadena parseable
    if (
      typeof value === "number" ||
      (typeof value === "string" && !isNaN(parseFloat(value as string)))
    ) {
      return parseFloat(value as string); // <-- Cast a string antes de parseFloat
    }
    throw new Error(
      "Decimal Scalar serializer expected a number or a string convertible to number."
    );
  },
  parseValue(value: unknown) {
    if (typeof value === "string" || typeof value === "number") {
      // <-- Verifica tipo string o number
      const num = parseFloat(value as string); // <-- Cast a string antes de parseFloat
      if (isNaN(num)) {
        throw new Error(
          "Decimal Scalar parser expected a valid number or string."
        );
      }
      return num;
    }
    throw new Error("Decimal Scalar parser expected a string or number.");
  },
  parseLiteral(ast: any) {
    if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) {
      return parseFloat(ast.value);
    }
    return null;
  },
});

export const scalarResolvers = {
  UUID: UUIDResolver,
  Date: DateResolver,
  DateTime: DateTimeResolver,
  JSON: JSONResolver,
  JSONObject: JSONObjectResolver,
  Decimal: DecimalScalar,
};
