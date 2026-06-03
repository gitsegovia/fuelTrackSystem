import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { AppModels } from "../../interfaces/models";
import { GasStation as GasStationModel } from "src/models/gasStation";

const gasStationResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las estaciones de servicio
    gasStations: async (_parent, _args, context: { models: AppModels }) => {
      return context.models.GasStation.findAll({
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
  },
  // Resolvers para campos específicos que son relaciones (si no se precargan en la consulta principal)
  GasStation: {
    company: async (
      parent: GasStationModel,
      _args,
      context: { models: AppModels }
    ) => {
      // 'parent' es el objeto GasStation que se está resolviendo
      return parent.getCompany(); // Usamos el getter de Sequelize
    },
  },
};

export default gasStationResolver;
