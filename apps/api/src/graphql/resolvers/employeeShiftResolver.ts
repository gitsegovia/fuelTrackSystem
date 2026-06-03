import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { EmployeeShift as EmployeeShiftModel } from "../../models/employeeShift";
import { Op } from "sequelize"; // Importar Op para operadores de Sequelize

const employeeShiftResolver: IResolvers<Context> = {
  Query: {
    employeeShifts: async (_parent, _args, context: Context) => {
      return context.models.EmployeeShift.findAll({
        include: [
          { model: context.models.Employee, as: "employee" },
          { model: context.models.GasStation, as: "gasStation" },
        ],
        order: [["shiftStartTime", "DESC"]],
      });
    },
    employeeShift: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      return context.models.EmployeeShift.findByPk(id, {
        include: [
          { model: context.models.Employee, as: "employee" },
          { model: context.models.GasStation, as: "gasStation" },
        ],
      });
    },
    employeeShiftsByEmployee: async (
      _parent,
      {
        employeeId,
        startDate,
        endDate,
      }: { employeeId: string; startDate?: Date; endDate?: Date },
      context: Context
    ) => {
      const where: any = { employeeId };
      if (startDate && endDate) {
        where.shiftStartTime = {
          [Op.between]: [startDate, endDate],
        };
      } else if (startDate) {
        where.shiftStartTime = {
          [Op.gte]: startDate,
        };
      } else if (endDate) {
        where.shiftStartTime = {
          [Op.lte]: endDate,
        };
      }
      return context.models.EmployeeShift.findAll({
        where,
        include: [
          { model: context.models.Employee, as: "employee" },
          { model: context.models.GasStation, as: "gasStation" },
        ],
        order: [["shiftStartTime", "DESC"]],
      });
    },
    employeeShiftsByGasStation: async (
      _parent,
      {
        gasStationId,
        startDate,
        endDate,
      }: { gasStationId: string; startDate?: Date; endDate?: Date },
      context: Context
    ) => {
      const where: any = { gasStationId };
      if (startDate && endDate) {
        where.shiftStartTime = {
          [Op.between]: [startDate, endDate],
        };
      } else if (startDate) {
        where.shiftStartTime = {
          [Op.gte]: startDate,
        };
      } else if (endDate) {
        where.shiftStartTime = {
          [Op.lte]: endDate,
        };
      }
      return context.models.EmployeeShift.findAll({
        where,
        include: [
          { model: context.models.Employee, as: "employee" },
          { model: context.models.GasStation, as: "gasStation" },
        ],
        order: [["shiftStartTime", "DESC"]],
      });
    },
    activeEmployeeShift: async (
      _parent,
      { employeeId }: { employeeId: string },
      context: Context
    ) => {
      return context.models.EmployeeShift.findOne({
        where: { employeeId, shiftEndTime: null }, // Busca un turno donde shiftEndTime es NULL
        order: [["shiftStartTime", "DESC"]],
        include: [
          { model: context.models.Employee, as: "employee" },
          { model: context.models.GasStation, as: "gasStation" },
        ],
      });
    },
  },
  Mutation: {
    createEmployeeShift: async (_parent, { input }, context: Context) => {
      try {
        const { employeeId, ...restInput } = input;

        // Opcional: Validar que no haya un turno activo para este empleado en la misma estación
        const existingActiveShift = await context.models.EmployeeShift.findOne({
          where: {
            employeeId,
            gasStationId: input.gasStationId,
            shiftEndTime: null, // Un turno activo no tiene hora de fin
          },
        });

        if (existingActiveShift) {
          throw new Error(
            "There is already an active shift for this employee at this gas station."
          );
        }

        const newShift = await context.models.EmployeeShift.create(input);
        return newShift;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createEmployeeShift' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while creating the employee shift: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    updateEmployeeShift: async (_parent, { id, input }, context: Context) => {
      try {
        const shift = await context.models.EmployeeShift.findByPk(id);
        if (!shift) {
          throw new Error("Employee shift not found.");
        }

        // Si se intenta actualizar `shiftEndTime` a un valor no nulo y ya hay un valor,
        // o si `shiftStartTime` es posterior a `shiftEndTime`, puedes añadir validaciones aquí.
        if (
          input.shiftStartTime &&
          input.shiftEndTime &&
          input.shiftStartTime >= input.shiftEndTime
        ) {
          throw new Error(
            "Shift start time cannot be later than or equal to shift end time."
          );
        }

        await shift.update(input);
        return shift;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateEmployeeShift' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while updating the employee shift: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    deleteEmployeeShift: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const shift = await context.models.EmployeeShift.findByPk(id);
        if (!shift) {
          throw new Error("Employee shift not found.");
        }

        // Antes de eliminar, puedes considerar si hay dependencias (ej. DispenserReadings o SalesTickets)
        // asociados a este turno que impedirían su eliminación o requerirían una lógica de cascada.
        // Por simplicidad, el modelo ya tiene onDelete: RESTRICT para employeeId,
        // y CASCADE para gasStationId. Para DispenserReading y SalesTicket,
        // tendrías que definir un comportamiento adecuado (ej. set null, o restrict).
        // Aquí asumimos que las FKs en DispenserReading y SalesTicket manejarán la restricción.
        const deleted = await context.models.EmployeeShift.destroy({
          where: { id },
        });
        return deleted > 0;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteEmployeeShift' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the employee shift: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    endEmployeeShift: async (
      _parent,
      { id, shiftEndTime }: { id: string; shiftEndTime: Date },
      context: Context
    ) => {
      try {
        const shift = await context.models.EmployeeShift.findByPk(id);
        if (!shift) {
          throw new Error("Employee shift not found.");
        }

        if (shift.shiftEndTime) {
          throw new Error("This shift has already been ended.");
        }

        // Validar que la hora de fin no sea anterior a la hora de inicio
        if (shiftEndTime <= shift.shiftStartTime) {
          throw new Error(
            "Shift end time cannot be earlier than or equal to shift start time."
          );
        }

        await shift.update({ shiftEndTime });

        // **Lógica Adicional al finalizar un turno (ejemplos):**
        // 1. **Calcular ventas totales del turno:** Podrías recorrer todos los SalesTickets asociados
        //    a `cashierShiftId` para sumar los montos o litros despachados.
        // 2. **Calcular total de litros despachados por boquilla:** Usar las `DispenserReading` iniciales y finales
        //    para calcular los litros despachados por cada boquilla durante el turno.
        // 3. **Generar un reporte de turno:** Crear un resumen o un registro en otra tabla de auditoría.
        // 4. **Actualizar el estado del empleado a "inactivo":** Si la aplicación requiere seguir el estado de trabajo.

        return shift;
      } catch (error: any) {
        console.error(
          `❌ Error in 'endEmployeeShift' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while ending the employee shift: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  EmployeeShift: {
    employee: async (parent: EmployeeShiftModel, _args, _context: Context) => {
      return parent.getEmployee();
    },
    gasStation: async (
      parent: EmployeeShiftModel,
      _args,
      _context: Context
    ) => {
      return parent.getGasStation();
    },
    dispenserReadings: async (
      parent: EmployeeShiftModel,
      _args,
      _context: Context
    ) => {
      return parent.getDispenserReadings();
    },
    salesTicketsProcessed: async (
      parent: EmployeeShiftModel,
      _args,
      _context: Context
    ) => {
      return parent.getSalesTicketsProcessed();
    },
    salesTicketsDispatched: async (
      parent: EmployeeShiftModel,
      _args,
      _context: Context
    ) => {
      return parent.getSalesTicketsDispatched();
    },
  },
};

export default employeeShiftResolver;
