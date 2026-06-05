import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import {
  buildDateWhere,
  computeInvoiceAudit,
  computeDriverAudit,
  computeShiftAuditRow,
  computeShiftAudit,
  computeDispatcherAudit,
  computeTankBalance,
  computeTankBalanceByStation,
  computeShiftFinancialAudit,
} from "../helpers/auditHelpers";

const auditResolver: IResolvers<Context> = {
  Query: {
    invoiceAudit: async (
      _,
      { gasStationId, startDate, endDate }: { gasStationId: string; startDate?: Date; endDate?: Date },
      ctx: Context
    ) => computeInvoiceAudit(gasStationId, startDate, endDate, ctx),

    driverAuditSummary: async (
      _,
      { gasStationId, startDate, endDate }: { gasStationId?: string; startDate?: Date; endDate?: Date },
      ctx: Context
    ) => computeDriverAudit(gasStationId, startDate, endDate, ctx),

    shiftAudit: async (
      _,
      { gasStationId, startDate, endDate }: { gasStationId: string; startDate?: Date; endDate?: Date },
      ctx: Context
    ) => computeShiftAudit(gasStationId, startDate, endDate, ctx),

    shiftAuditDetail: async (_, { shiftId }: { shiftId: string }, ctx: Context) => {
      const shift = await ctx.models.EmployeeShift.findByPk(shiftId, {
        include: [
          { model: ctx.models.Employee, as: "employee" },
          { model: ctx.models.GasStation, as: "gasStation" },
        ],
      });
      if (!shift) return null;
      return computeShiftAuditRow(shift as any, ctx);
    },

    dispatcherAudit: async (
      _,
      { gasStationId, startDate, endDate }: { gasStationId: string; startDate?: Date; endDate?: Date },
      ctx: Context
    ) => computeDispatcherAudit(gasStationId, startDate, endDate, ctx),

    tankBalanceAudit: async (
      _,
      { tankId, startDate, endDate }: { tankId: string; startDate: Date; endDate: Date },
      ctx: Context
    ) => computeTankBalance(tankId, startDate, endDate, ctx),

    tankBalanceAuditByStation: async (
      _,
      { gasStationId, startDate, endDate }: { gasStationId: string; startDate: Date; endDate: Date },
      ctx: Context
    ) => computeTankBalanceByStation(gasStationId, startDate, endDate, ctx),

    shiftFinancialAudit: async (
      _,
      { gasStationId, startDate, endDate }: { gasStationId: string; startDate?: Date; endDate?: Date },
      ctx: Context
    ) => computeShiftFinancialAudit(gasStationId, startDate, endDate, ctx),
  },
};

export default auditResolver;
