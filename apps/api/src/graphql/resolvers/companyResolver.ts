import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces"; // Asegúrate de que tu interfaz Context esté bien definida
import { AppModels } from "../../interfaces/models"; // Importa AppModels
import { Company as CompanyModel } from "../../models/company";

const companyResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las compañías
    companies: async (_parent, _args, context: { models: AppModels }) => {
      return context.models.Company.findAll();
    },
    // Obtener una compañía por ID
    company: async (
      _parent,
      { id }: { id: string },
      context: { models: AppModels }
    ) => {
      return context.models.Company.findByPk(id);
    },
  },
  Mutation: {
    // Crear una nueva compañía
    createCompany: async (
      _parent,
      { input },
      context: { models: AppModels }
    ) => {
      const company = await context.models.Company.create(input);
      return company;
    },
    // Actualizar una compañía existente
    updateCompany: async (
      _parent,
      { id, input },
      context: { models: AppModels }
    ) => {
      const company = await context.models.Company.findByPk(id);
      if (!company) {
        throw new Error("Company not found.");
      }
      await company.update(input);
      return company;
    },
    // Eliminar una compañía
    deleteCompany: async (
      _parent,
      { id }: { id: string },
      context: { models: AppModels }
    ) => {
      const deleted = await context.models.Company.destroy({ where: { id } });
      return deleted > 0; // Retorna true si se eliminó, false si no se encontró
    },
  },
  Company: {
    gasStations: async (
      parent: CompanyModel,
      _args,
      context: { models: AppModels }
    ) => {
      // 'parent' aquí es el objeto Company
      // Usamos el getter de Sequelize para obtener las estaciones asociadas
      return parent.getGasStations();
    },
  },
  // No necesitamos resolvers de campo para Company a menos que tenga relaciones que queramos cargar perezosamente
};

export default companyResolver;
