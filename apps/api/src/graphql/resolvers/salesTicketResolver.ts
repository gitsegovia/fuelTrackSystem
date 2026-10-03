import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { PaymentMode, SalesTicketStatus } from "../../utils/types";
import { Op, QueryTypes } from "sequelize"; // Importar Op para operaciones de fecha
import { buildDateWhere, round, toNum } from "../helpers/auditHelpers";
import {
  computeTicketFinancials,
  loadTicketFinancialRows,
} from "../helpers/ticketFinancials";
import { belongsTo, hasMany } from "../helpers/dataloaders";

const salesTicketResolver: IResolvers<Context> = {
  Query: {
    salesTickets: async (_parent, _args, context: Context) => {
      return context.models.SalesTicket.findAll({
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.EmployeeShift, as: "cashierShift" },
          { model: context.models.Employee, as: "dispatcherEmployee" },
          { model: context.models.DispenserNozzle, as: "dispenserNozzle" },
          { model: context.models.FuelType, as: "fuelType" },
          {
            model: context.models.SaleTypeConfig,
            as: "assignedSaleTypeConfig",
          },
          { model: context.models.Payment, as: "payments" }, // Incluir pagos
        ],
      });
    },
    salesTicket: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.SalesTicket.findByPk(id, {
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          { model: context.models.EmployeeShift, as: "cashierShift" },
          { model: context.models.Employee, as: "dispatcherEmployee" },
          { model: context.models.DispenserNozzle, as: "dispenserNozzle" },
          { model: context.models.FuelType, as: "fuelType" },
          {
            model: context.models.SaleTypeConfig,
            as: "assignedSaleTypeConfig",
          },
          { model: context.models.Payment, as: "payments" },
        ],
      });
    },
    salesTicketsByGasStation: async (
      _parent,
      {
        gasStationId,
        date,
        startDate,
        endDate,
      }: { gasStationId: string; date?: Date; startDate?: Date; endDate?: Date },
      context: Context
    ) => {
      let whereClause: any = { gasStationId };
      if (date) {
        // Retrocompatible: un solo día, tiene prioridad sobre startDate/endDate si ambos llegan.
        const queryDate = new Date(date);
        const startOfDay = new Date(
          queryDate.getFullYear(),
          queryDate.getMonth(),
          queryDate.getDate(),
          0,
          0,
          0
        );
        const endOfDay = new Date(
          queryDate.getFullYear(),
          queryDate.getMonth(),
          queryDate.getDate(),
          23,
          59,
          59,
          999
        );
        whereClause.ticketIssueTime = {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay,
        };
      } else if (startDate || endDate) {
        whereClause = { ...whereClause, ...buildDateWhere("ticketIssueTime", startDate, endDate) };
      }
      return context.models.SalesTicket.findAll({
        where: whereClause,
        include: [
          { model: context.models.GasStation, as: "gasStation" },
          // Opta por no incluir todas las relaciones si no son estrictamente necesarias para la lista
        ],
        order: [["ticketNumber", "ASC"]], // Ordenar por número de ticket secuencial
      });
    },
    salesTicketsByCashierShift: async (
      _parent,
      { cashierShiftId }: { cashierShiftId: string },
      context: Context
    ) => {
      return context.models.SalesTicket.findAll({
        where: { cashierShiftId },
        include: [{ model: context.models.EmployeeShift, as: "cashierShift" }],
      });
    },
    salesTicketsByDispatcher: async (
      _parent,
      { dispatcherEmployeeId }: { dispatcherEmployeeId: string },
      context: Context
    ) => {
      return context.models.SalesTicket.findAll({
        where: { dispatcherEmployeeId },
        include: [{ model: context.models.Employee, as: "dispatcherEmployee" }],
      });
    },
    salesTicketsByNozzle: async (
      _parent,
      { dispenserNozzleId }: { dispenserNozzleId: string },
      context: Context
    ) => {
      return context.models.SalesTicket.findAll({
        where: { dispenserNozzleId },
        include: [
          { model: context.models.DispenserNozzle, as: "dispenserNozzle" },
        ],
      });
    },
    salesTicketsByFuelType: async (
      _parent,
      { fuelTypeId }: { fuelTypeId: string },
      context: Context
    ) => {
      return context.models.SalesTicket.findAll({
        where: { fuelTypeId },
        include: [{ model: context.models.FuelType, as: "fuelType" }],
      });
    },
    salesTicketsByStatus: async (
      _parent,
      { status }: { status: SalesTicketStatus },
      context: Context
    ) => {
      return context.models.SalesTicket.findAll({
        where: { status },
        include: [
          // Puedes decidir qué relaciones incluir aquí para optimizar la carga
        ],
      });
    },
    // T-022 (riesgo #1): agregado por día y combustible para el dashboard, en vez de traer
    // todos los tickets crudos y sumar en el cliente. Mismos criterios que hoy usa
    // admin/dashboard/page.tsx: solo tickets COMPLETED, litros = actualLitersDispatched ??
    // requestedLiters, ingresos = totalAmountExpected convertido a moneda base (/ exchangeRate).
    salesTicketDailyTotals: async (
      _parent,
      {
        gasStationId,
        startDate,
        endDate,
      }: { gasStationId?: string; startDate: Date; endDate: Date },
      context: Context
    ) => {
      const rows: any[] = await context.sequelize.query(
        `
        SELECT
          date_trunc('day', st."ticketIssueTime") AS "date",
          st."fuelTypeId" AS "fuelTypeId",
          ft.name AS "fuelTypeName",
          SUM(COALESCE(st."actualLitersDispatched", st."requestedLiters")) AS "liters",
          SUM(st."totalAmountExpected" / COALESCE(cur."exchangeRate", 1)) AS "revenue",
          COUNT(*)::int AS "ticketCount"
        FROM sales_tickets st
        JOIN fuel_types ft ON ft.id = st."fuelTypeId"
        JOIN sale_type_configs stc ON stc.id = st."assignedSaleTypeConfigId"
        JOIN currencies cur ON cur.id = stc."currencyId"
        WHERE st.status = 'COMPLETED'
          AND st."ticketIssueTime" >= :startDate
          AND st."ticketIssueTime" <= :endDate
          ${gasStationId ? 'AND st."gasStationId" = :gasStationId' : ""}
        GROUP BY 1, 2, 3
        ORDER BY 1, 3
        `,
        {
          replacements: { startDate, endDate, gasStationId },
          type: QueryTypes.SELECT,
        }
      );
      return rows.map((r) => ({
        date: r.date,
        fuelTypeId: r.fuelTypeId,
        fuelTypeName: r.fuelTypeName,
        liters: parseFloat(r.liters),
        revenue: parseFloat(r.revenue),
        ticketCount: r.ticketCount,
      }));
    },
    salesTicketDifferential: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      const [row] = await loadTicketFinancialRows(context, `st.id = :id`, { id });
      if (!row) return null;
      const f = computeTicketFinancials(row);
      return {
        paidAmount: f.paidAmount,
        dispatchedAmount: f.dispatchedAmount,
        refundedAmount: f.refundedAmount,
        differentialAmount: f.differentialAmount,
        differentialLiters: f.differentialLiters,
      };
    },
    dispatcherDifferentialSummary: async (
      _parent,
      {
        gasStationId,
        startDate,
        endDate,
        dispatcherShiftId,
      }: {
        gasStationId?: string;
        startDate?: Date;
        endDate?: Date;
        dispatcherShiftId?: string;
      },
      context: Context
    ) => {
      const conditions = [`st.status = 'COMPLETED'`, `st."dispatcherEmployeeId" IS NOT NULL`];
      const replacements: Record<string, unknown> = {};
      if (gasStationId) {
        conditions.push(`st."gasStationId" = :gasStationId`);
        replacements.gasStationId = gasStationId;
      }
      if (startDate) {
        conditions.push(`st."ticketIssueTime" >= :startDate`);
        replacements.startDate = startDate;
      }
      if (endDate) {
        conditions.push(`st."ticketIssueTime" <= :endDate`);
        replacements.endDate = endDate;
      }
      if (dispatcherShiftId) {
        conditions.push(`st."dispatcherShiftId" = :dispatcherShiftId`);
        replacements.dispatcherShiftId = dispatcherShiftId;
      }

      const rows = await loadTicketFinancialRows(
        context,
        conditions.join(" AND "),
        replacements
      );

      const byDispatcher = new Map<
        string,
        {
          ticketCount: number;
          grossLiters: number;
          grossAmount: number;
          refundedLiters: number;
          refundedAmount: number;
        }
      >();
      for (const row of rows) {
        const f = computeTicketFinancials(row);
        const acc = byDispatcher.get(row.dispatcherEmployeeId!) ?? {
          ticketCount: 0,
          grossLiters: 0,
          grossAmount: 0,
          refundedLiters: 0,
          refundedAmount: 0,
        };
        acc.ticketCount += 1;
        acc.grossLiters += f.grossLiters;
        acc.grossAmount += f.grossAmount;
        acc.refundedLiters += f.refundedLiters;
        acc.refundedAmount += f.refundedAmount;
        byDispatcher.set(row.dispatcherEmployeeId!, acc);
      }

      return [...byDispatcher.entries()].map(([dispatcherEmployeeId, a]) => ({
        dispatcherEmployeeId,
        ticketCount: a.ticketCount,
        grossDifferentialLiters: round(a.grossLiters, 3),
        grossDifferentialAmount: round(a.grossAmount, 2),
        refundedLiters: round(a.refundedLiters, 3),
        refundedAmount: round(a.refundedAmount, 2),
        netDifferentialLiters: round(a.grossLiters - a.refundedLiters, 3),
        netDifferentialAmount: round(a.grossAmount - a.refundedAmount, 2),
      }));
    },
  },
  Mutation: {
    createSalesTicket: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const saleTypeConfig = await context.models.SaleTypeConfig.findByPk(
            input.assignedSaleTypeConfigId,
            { transaction: t }
          );
          if (!saleTypeConfig) {
            throw new Error("Sale type config not found for this ticket.");
          }
          const pricePerLiter = toNum(saleTypeConfig.salePricePerLiter);

          const last = await context.models.SalesTicket.findOne({
            where: { gasStationId: input.gasStationId },
            order: [["ticketNumber", "DESC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          const ticketNumber = (last?.ticketNumber ?? 0) + 1;
          const salesTicket = await context.models.SalesTicket.create(
            {
              gasStationId: input.gasStationId,
              cashierShiftId: input.cashierShiftId,
              fuelTypeId: input.fuelTypeId,
              requestedLiters: input.requestedLiters,
              assignedSaleTypeConfigId: input.assignedSaleTypeConfigId,
              ticketIssueTime: input.ticketIssueTime,
              paymentMode: input.paymentMode ?? PaymentMode.PREPAID,
              status: SalesTicketStatus.ISSUED,
              pricePerLiter,
              totalAmountExpected: round(toNum(input.requestedLiters) * pricePerLiter, 2),
              ticketNumber,
            },
            { transaction: t }
          );
          return salesTicket;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createSalesTicket' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while creating the sales ticket: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    updateSalesTicket: async (_parent, { id, input: rawInput }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const salesTicket = await context.models.SalesTicket.findByPk(id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!salesTicket) {
            throw new Error("Sales ticket not found.");
          }

          // Los campos legados (status, total, despacho) se ignoran: solo estos cuatro aplican.
          const input = Object.fromEntries(
            Object.entries({
              fuelTypeId: rawInput.fuelTypeId,
              requestedLiters: rawInput.requestedLiters,
              assignedSaleTypeConfigId: rawInput.assignedSaleTypeConfigId,
              ticketIssueTime: rawInput.ticketIssueTime,
            }).filter(([, v]) => v !== undefined)
          );
          const pricingChanged =
            input.requestedLiters !== undefined ||
            input.assignedSaleTypeConfigId !== undefined ||
            input.fuelTypeId !== undefined;
          if (!pricingChanged) {
            await salesTicket.update(input, { transaction: t });
            return salesTicket;
          }

          if (salesTicket.status !== SalesTicketStatus.ISSUED) {
            throw new Error(
              `Sales ticket pricing can only change while ISSUED (current status: ${salesTicket.status}).`
            );
          }
          const saleTypeConfig = await context.models.SaleTypeConfig.findByPk(
            input.assignedSaleTypeConfigId ?? salesTicket.assignedSaleTypeConfigId,
            { transaction: t }
          );
          if (!saleTypeConfig) {
            throw new Error("Sale type config not found for this ticket.");
          }
          const pricePerLiter = toNum(saleTypeConfig.salePricePerLiter);
          const requestedLiters = toNum(input.requestedLiters ?? salesTicket.requestedLiters);

          await salesTicket.update(
            {
              ...input,
              pricePerLiter,
              totalAmountExpected: round(requestedLiters * pricePerLiter, 2),
            },
            { transaction: t }
          );
          return salesTicket;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateSalesTicket' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while updating the sales ticket: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    deleteSalesTicket: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.SalesTicket.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteSalesTicket' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the sales ticket: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    processSalesTicketDispatch: async (
      _parent,
      {
        id,
        dispatcherEmployeeId,
        dispenserNozzleId,
        actualLitersDispatched,
      }: {
        id: string;
        dispatcherEmployeeId: string;
        dispenserNozzleId: string;
        actualLitersDispatched: number;
      },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const salesTicket = await context.models.SalesTicket.findByPk(id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!salesTicket) {
            throw new Error("Sales ticket not found.");
          }
          const liters = toNum(actualLitersDispatched);
          if (!(liters > 0)) {
            throw new Error("Dispatched liters must be greater than zero.");
          }

          const activeShift = await context.models.EmployeeShift.findOne({
            where: {
              employeeId: dispatcherEmployeeId,
              gasStationId: salesTicket.gasStationId,
              shiftEndTime: null,
            },
            order: [["shiftStartTime", "DESC"]],
            transaction: t,
          });
          const dispatch = {
            dispatcherEmployeeId,
            dispatcherShiftId: activeShift?.id,
            dispenserNozzleId,
            actualLitersDispatched: liters,
          };

          if (salesTicket.paymentMode === PaymentMode.PREPAID) {
            if (salesTicket.status !== SalesTicketStatus.PAID) {
              throw new Error(
                `Prepaid sales ticket must be PAID before dispatch (current status: ${salesTicket.status}).`
              );
            }
            const requestedLiters = toNum(salesTicket.requestedLiters);
            if (liters > requestedLiters) {
              throw new Error(
                `Prepaid sales ticket cannot dispatch more liters than paid: ${liters} > ${requestedLiters}.`
              );
            }
            // El cobro ya cubre el total: no se recalcula y el despacho completa el ticket.
            await salesTicket.update(
              { ...dispatch, status: SalesTicketStatus.COMPLETED },
              { transaction: t }
            );
            return salesTicket;
          }

          if (salesTicket.status !== SalesTicketStatus.ISSUED) {
            throw new Error(
              `Postpaid sales ticket can only be dispatched from ISSUED (current status: ${salesTicket.status}).`
            );
          }
          const saleTypeConfig = await context.models.SaleTypeConfig.findByPk(
            salesTicket.assignedSaleTypeConfigId,
            { transaction: t }
          );
          if (!saleTypeConfig) {
            throw new Error("Sale type config not found for this ticket.");
          }
          const pricePerLiter = toNum(saleTypeConfig.salePricePerLiter);
          await salesTicket.update(
            {
              ...dispatch,
              pricePerLiter,
              totalAmountExpected: round(liters * pricePerLiter, 2),
              status: SalesTicketStatus.DISPATCHED,
            },
            { transaction: t }
          );
          return salesTicket;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'processSalesTicketDispatch' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while processing dispatch for the sales ticket: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    completeSalesTicketPayment: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const salesTicket = await context.models.SalesTicket.findByPk(id, {
            transaction: t,
          });
          if (!salesTicket) {
            throw new Error("Sales ticket not found.");
          }
          if (salesTicket.status === SalesTicketStatus.COMPLETED) {
            return salesTicket;
          }
          throw new Error(
            `Sales ticket completes automatically once payment and dispatch are both recorded (paymentMode: ${salesTicket.paymentMode}, status: ${salesTicket.status}).`
          );
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'completeSalesTicketPayment' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while completing payment for the sales ticket: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    cancelSalesTicket: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const salesTicket = await context.models.SalesTicket.findByPk(id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!salesTicket) {
            throw new Error("Sales ticket not found.");
          }
          if (salesTicket.status === SalesTicketStatus.COMPLETED) {
            throw new Error(
              `Sales ticket cannot be cancelled from its current status: ${salesTicket.status}`
            );
          }
          await salesTicket.update(
            { status: SalesTicketStatus.CANCELED },
            { transaction: t }
          );
          return salesTicket;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'cancelSalesTicket' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while cancelling the sales ticket: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  // T-023 (H-021): antes cada campo volvía a consultar con parent.getX() sin importar si la
  // query padre ya lo había traído con `include` — hasta 8 queries extra por ticket.
  SalesTicket: {
    gasStation: belongsTo("gasStation", "GasStation", "gasStationId"),
    cashierShift: belongsTo("cashierShift", "EmployeeShift", "cashierShiftId"),
    dispatcherEmployee: belongsTo("dispatcherEmployee", "Employee", "dispatcherEmployeeId"),
    dispatcherShift: belongsTo("dispatcherShift", "EmployeeShift", "dispatcherShiftId"),
    dispenserNozzle: belongsTo("dispenserNozzle", "DispenserNozzle", "dispenserNozzleId"),
    fuelType: belongsTo("fuelType", "FuelType", "fuelTypeId"),
    assignedSaleTypeConfig: belongsTo("assignedSaleTypeConfig", "SaleTypeConfig", "assignedSaleTypeConfigId"),
    payments: hasMany("payments", "Payment", "salesTicketId"),
  },
};

export default salesTicketResolver;
