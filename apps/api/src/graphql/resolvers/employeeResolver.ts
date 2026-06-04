import { IResolvers } from "@graphql-tools/utils";
import bcrypt from "bcryptjs";
import { Context } from "../../interfaces";
import { AppModels } from "../../interfaces/models";
import { Employee as EmployeeModel } from "../../models/employee"; // Importar el tipo de modelo Employee

const employeeResolver: IResolvers<Context> = {
  Query: {
    // Obtener todos los empleados
    employees: async (_parent, _args, context: Context) => {
      // Incluir relaciones para evitar N+1 si se piden a menudo
      return context.models.Employee.findAll({
        include: [
          { model: context.models.User, as: "user" },
          { model: context.models.GasStation, as: "gasStation" },
          // { model: context.models.EmployeeShift, as: 'shifts' }, // Descomentar cuando EmployeeShift esté listo
          // { model: context.models.SalesTicket, as: 'dispatchedSalesTickets' }, // Descomentar cuando SalesTicket esté listo
          // { model: context.models.TankMeasurement, as: 'tankMeasurementsPerformed' }, // Descomentar cuando TankMeasurement esté listo
        ],
      });
    },
    // Obtener un empleado por ID
    employee: async (_parent, { id }: { id: string }, context: Context) => {
      return context.models.Employee.findByPk(id, {
        include: [
          { model: context.models.User, as: "user" },
          { model: context.models.GasStation, as: "gasStation" },
          // { model: context.models.EmployeeShift, as: 'shifts' }, // Descomentar cuando EmployeeShift esté listo
          // { model: context.models.SalesTicket, as: 'dispatchedSalesTickets' }, // Descomentar cuando SalesTicket esté listo
          // { model: context.models.TankMeasurement, as: 'tankMeasurementsPerformed' }, // Descomentar cuando TankMeasurement esté listo
        ],
      });
    },
  },
  Mutation: {
    // Crear un nuevo empleado
    createEmployee: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          // Opcional: Validaciones adicionales si es necesario antes de crear
          const employee = await context.models.Employee.create(input, {
            transaction: t,
          });
          return employee;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createEmployee' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error("A profile for this user already exists.");
        }
        throw new Error(
          `An error occurred while creating the employee: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    createEmployeeWithUser: async (_parent, { input }, context: Context) => {
      const {
        username, password, role, userType, companyId,
        gasStationId, firstName, lastName, position,
      } = input;

      const existingUser = await context.models.User.findOne({ where: { username } });
      if (existingUser) {
        throw new Error("Username already exists. Please choose a different one.");
      }

      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const passwordHash = await bcrypt.hash(password, 10);
          const newUser = await context.models.User.create(
            { username, passwordHash, role, userType, companyId, gasStationId },
            { transaction: t }
          );
          const employee = await context.models.Employee.create(
            { userId: newUser.id, gasStationId, firstName, lastName, position },
            { transaction: t }
          );
          return context.models.Employee.findByPk(employee.id, {
            include: [
              { model: context.models.User, as: "user" },
              { model: context.models.GasStation, as: "gasStation" },
            ],
            transaction: t,
          });
        });
        return result;
      } catch (error: any) {
        console.error(`❌ Error in 'createEmployeeWithUser' mutation:`, error.message || error);
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error("Username already exists. Please choose another one.");
        }
        throw new Error(
          `An error occurred while creating the employee: ${error.message || "Unknown error"}`
        );
      }
    },
    // Actualizar un empleado existente
    updateEmployee: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const employee = await context.models.Employee.findByPk(id, {
            transaction: t,
          });
          if (!employee) {
            throw new Error("Employee not found.");
          }
          await employee.update(input, { transaction: t });
          return employee;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateEmployee' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error("A profile for this user already exists.");
        }
        throw new Error(
          `An error occurred while updating the employee: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar un empleado
    deleteEmployee: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.Employee.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteEmployee' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the employee: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  Employee: {
    user: async (parent: EmployeeModel, _args, _context: Context) => {
      return parent.getUser();
    },
    gasStation: async (parent: EmployeeModel, _args, _context: Context) => {
      return parent.getGasStation();
    },
    shifts: async (parent: EmployeeModel, _args, _context: Context) => {
      // Necesitarás EmployeeShift definido para esto
      return parent.getShifts();
    },
    dispatchedSalesTickets: async (
      parent: EmployeeModel,
      _args,
      _context: Context
    ) => {
      // Necesitarás SalesTicket definido para esto
      return parent.getDispatchedSalesTickets();
    },
    tankMeasurementsPerformed: async (
      parent: EmployeeModel,
      _args,
      _context: Context
    ) => {
      // Necesitarás TankMeasurement definido para esto
      return parent.getTankMeasurementsPerformed();
    },
  },
};

export default employeeResolver;
