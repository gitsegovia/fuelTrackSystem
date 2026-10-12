import { IResolvers } from "@graphql-tools/utils";
import { GraphQLError } from "graphql";
import { Context } from "../../interfaces";
import { AppModels } from "../../interfaces/models";
import { GasStation as GasStationModel } from "src/models/gasStation";
import { SalesTicketStatus } from "../../utils/types";
import { Op } from "sequelize";
import { belongsTo } from "../helpers/dataloaders";

const gasStationResolver: IResolvers<Context> = {
  Query: {
    // Sin "active": todas (para reportes). Con active: true/false: solo esas (para selectores).
    gasStations: async (
      _parent,
      { active }: { active?: boolean },
      context: { models: AppModels }
    ) => {
      return context.models.GasStation.findAll({
        where: active === undefined ? {} : { active },
        include: [{ model: context.models.Company, as: "company" }], // Incluimos la compañía asociada
      });
    },
    // Obtener una estación de servicio por ID
    gasStation: async (
      _parent,
      { id }: { id: string },
      context: { models: AppModels }
    ) => {
      return context.models.GasStation.findByPk(id, {
        include: [{ model: context.models.Company, as: "company" }], // Incluimos la compañía asociada
      });
    },
  },
  Mutation: {
    // Crear una nueva estación de servicio
    createGasStation: async (
      _parent,
      { input },
      context: { models: AppModels }
    ) => {
      const gasStation = await context.models.GasStation.create(input);
      // Tras la creación, devolvemos la estación con su relación 'company' precargada
      return context.models.GasStation.findByPk(gasStation.id, {
        include: [{ model: context.models.Company, as: "company" }],
      });
    },
    // Actualizar una estación de servicio existente
    updateGasStation: async (
      _parent,
      { id, input },
      context: { models: AppModels }
    ) => {
      const gasStation = await context.models.GasStation.findByPk(id);
      if (!gasStation) {
        throw new Error("Gas Station not found.");
      }
      await gasStation.update(input);
      // Devolvemos la estación actualizada con su relación 'company'
      return context.models.GasStation.findByPk(gasStation.id, {
        include: [{ model: context.models.Company, as: "company" }],
      });
    },
    // Eliminar una estación de servicio
    deleteGasStation: async (
      _parent,
      { id }: { id: string },
      context: { models: AppModels }
    ) => {
      const deleted = await context.models.GasStation.destroy({
        where: { id },
      });
      return deleted > 0;
    },
    // T-055 (ADR-004 de CCI Licencias): bajar de plan desactivando en vez de borrar.
    deactivateGasStation: async (_parent, { id }: { id: string }, context: Context) => {
      const gasStation = await context.models.GasStation.findByPk(id);
      if (!gasStation) throw new Error("Gas Station not found.");
      if (!gasStation.active) return gasStation; // idempotente: ya estaba desactivada

      const openShifts = await context.models.EmployeeShift.count({
        where: { gasStationId: id, shiftEndTime: null },
      });
      const openTickets = await context.models.SalesTicket.count({
        where: {
          gasStationId: id,
          status: { [Op.notIn]: [SalesTicketStatus.COMPLETED, SalesTicketStatus.CANCELED] },
        },
      });
      if (openShifts > 0 || openTickets > 0) {
        throw new GraphQLError(
          `La estación tiene ${openShifts} turno(s) abierto(s) y ${openTickets} ticket(s) sin completar.`,
          { extensions: { code: "STATION_HAS_OPEN_WORK", openShifts, openTickets } }
        );
      }

      await gasStation.update({ active: false });
      return gasStation;
    },
  },
  // Resolvers para campos específicos que son relaciones (si no se precargan en la consulta principal)
  GasStation: {
    company: belongsTo("company", "Company", "companyId"),
  },
};

export default gasStationResolver;
