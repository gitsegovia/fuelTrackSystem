import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { loadFilesSync } from "@graphql-tools/load-files";
import { mergeTypeDefs } from "@graphql-tools/merge";
import { IResolvers } from "@graphql-tools/utils";

import companyResolver from "./resolvers/companyResolver";
import gasStationResolver from "./resolvers/gasStationResolver";
import { scalarResolvers } from "./resolvers/scalarResolver";
import currencyResolver from "./resolvers/currencyResolver";
import userResolver from "./resolvers/userResolver";
import employeeResolver from "./resolvers/employeeResolver";
import invoiceResolver from "./resolvers/invoiceResolver";
import fuelTypeResolver from "./resolvers/fuelTypeResolver";
import saleTypeConfigResolver from "./resolvers/saleTypeConfigResolver";
import tankModelResolver from "./resolvers/tankModelResolver";
import tankCalibrationEntryResolver from "./resolvers/tankCalibrationEntryResolver";
import tankResolver from "./resolvers/tankResolver";
import dispatchReceptionResolver from "./resolvers/dispatchReceptionResolver";
import tankAssignmentResolver from "./resolvers/tankAssignmentResolver";
import pumpIslandResolver from "./resolvers/pumpIslandResolver";
import dispenserResolver from "./resolvers/dispenserResolver";
import dispenserNozzleResolver from "./resolvers/dispenserNozzleResolver";
import employeeShiftResolver from "./resolvers/employeeShiftResolver";
import dispenserReadingResolver from "./resolvers/dispenserReadingResolver";
import salesTicketResolver from "./resolvers/salesTicketResolver";
import paymentResolver from "./resolvers/paymentResolver";
import tankMeasurementResolver from "./resolvers/tankMeasurementResolver";
import auditResolver from "./resolvers/auditResolver";
import invoicePaymentResolver from "./resolvers/invoicePaymentResolver";
import auditPeriodCloseResolver from "./resolvers/auditPeriodCloseResolver";
import ticketRefundResolver from "./resolvers/ticketRefundResolver";
import licenseResolver from "./resolvers/licenseResolver";
import { applyOfflineIdempotency } from "./helpers/offlineIdempotency";
import { applyAuthorization } from "../authz";
import { applyLicenseGate } from "../license/gate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const typesArray = loadFilesSync(join(__dirname, "./schemas"), {
  extensions: ["graphql", "gql"],
  recursive: true,
});

export const typeDefs = mergeTypeDefs(typesArray);

// Orden: autorización → licencia → idempotencia. La autorización va primero para que una
// petición sin sesión dé UNAUTHENTICATED y no filtre nada de la licencia (cuántas estaciones
// tiene o si está en solo lectura) a quien no está ni autenticado. La licencia va antes de la
// idempotencia para que una mutation bloqueada por LICENSE_READ_ONLY o LICENSE_STATION_LIMIT
// tampoco quede marcada APPLIED.
export const resolvers: IResolvers<any>[] = applyAuthorization(applyLicenseGate(applyOfflineIdempotency([
  scalarResolvers,
  userResolver,
  companyResolver,
  gasStationResolver,
  currencyResolver,
  employeeResolver,
  invoiceResolver,
  fuelTypeResolver,
  saleTypeConfigResolver,
  tankModelResolver,
  tankCalibrationEntryResolver,
  tankResolver,
  dispatchReceptionResolver,
  tankAssignmentResolver,
  pumpIslandResolver,
  dispenserResolver,
  dispenserNozzleResolver,
  employeeShiftResolver,
  dispenserReadingResolver,
  salesTicketResolver,
  paymentResolver,
  tankMeasurementResolver,
  auditResolver,
  invoicePaymentResolver,
  auditPeriodCloseResolver,
  ticketRefundResolver,
  licenseResolver,
])));
