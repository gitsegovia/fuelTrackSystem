import { IResolvers } from "@graphql-tools/utils";
import { Op } from "sequelize";
import { Context } from "../../interfaces";
import { DispenserReading as DispenserReadingModel } from "../../models/dispenserReading";
import { ReadingType } from "../../utils/types";

const dispenserReadingResolver: IResolvers<Context> = {
  Query: {
    // Obtener todas las lecturas de surtidores
    dispenserReadings: async (_parent, _args, context: Context) => {
      return context.models.DispenserReading.findAll({
        include: [
          { model: context.models.DispenserNozzle, as: "dispenserNozzle" },
          { model: context.models.EmployeeShift, as: "employeeShift" },
        ],
      });
    },
    // Obtener una lectura por ID
    dispenserReading: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      return context.models.DispenserReading.findByPk(id, {
        include: [
          { model: context.models.DispenserNozzle, as: "dispenserNozzle" },
          { model: context.models.EmployeeShift, as: "employeeShift" },
        ],
      });
    },
    // Obtener lecturas por ID de boquilla
    dispenserReadingsByNozzle: async (
      _parent,
      { dispenserNozzleId }: { dispenserNozzleId: string },
      context: Context
    ) => {
      return context.models.DispenserReading.findAll({
        where: { dispenserNozzleId },
        include: [
          { model: context.models.DispenserNozzle, as: "dispenserNozzle" },
          { model: context.models.EmployeeShift, as: "employeeShift" },
        ],
        order: [["readingTime", "DESC"]], // Las más recientes primero
      });
    },
    // Obtener lecturas por ID de turno de empleado
    dispenserReadingsByShift: async (
      _parent,
      { employeeShiftId }: { employeeShiftId: string },
      context: Context
    ) => {
      return context.models.DispenserReading.findAll({
        where: { employeeShiftId },
        include: [
          { model: context.models.DispenserNozzle, as: "dispenserNozzle" },
          { model: context.models.EmployeeShift, as: "employeeShift" },
        ],
        order: [["readingTime", "ASC"]], // En orden cronológico para el turno
      });
    },
    // Obtener una lectura específica por boquilla, turno y tipo (initial/final)
    dispenserReadingByNozzleShiftAndType: async (
      _parent,
      {
        dispenserNozzleId,
        employeeShiftId,
        readingType,
      }: {
        dispenserNozzleId: string;
        employeeShiftId: string;
        readingType: ReadingType;
      },
      context: Context
    ) => {
      return context.models.DispenserReading.findOne({
        where: {
          dispenserNozzleId,
          employeeShiftId,
          readingType,
        },
        include: [
          { model: context.models.DispenserNozzle, as: "dispenserNozzle" },
          { model: context.models.EmployeeShift, as: "employeeShift" },
        ],
      });
    },
  },
  Mutation: {
    // Crear una nueva lectura de surtidor
    createDispenserReading: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          // Validar la lectura: asegurar que 'final' solo se pueda crear después de 'initial'
          if (input.readingType === ReadingType.FINAL) {
            const initialReading =
              await context.models.DispenserReading.findOne({
                where: {
                  dispenserNozzleId: input.dispenserNozzleId,
                  employeeShiftId: input.employeeShiftId,
                  readingType: ReadingType.INITIAL,
                },
                transaction: t,
              });

            if (!initialReading) {
              throw new Error(
                "Cannot create a FINAL reading without an existing INITIAL reading for this nozzle and shift."
              );
            }
            if (input.meterReading < initialReading.meterReading) {
              throw new Error(
                "Final meter reading cannot be less than initial meter reading."
              );
            }
          }

          const dispenserReading = await context.models.DispenserReading.create(
            input,
            { transaction: t }
          );
          return dispenserReading;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createDispenserReading' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "A reading of this type already exists for this nozzle and shift."
          );
        }
        throw new Error(
          `An error occurred while creating the dispenser reading: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Actualizar una lectura existente
    updateDispenserReading: async (
      _parent,
      { id, input },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const dispenserReading =
            await context.models.DispenserReading.findByPk(id, {
              transaction: t,
            });
          if (!dispenserReading) {
            throw new Error("Dispenser reading not found.");
          }

          // Si se actualiza el `readingType`, verificar la unicidad
          if (
            input.readingType &&
            input.readingType !== dispenserReading.readingType
          ) {
            const existingReading =
              await context.models.DispenserReading.findOne({
                where: {
                  dispenserNozzleId: dispenserReading.dispenserNozzleId,
                  employeeShiftId: dispenserReading.employeeShiftId,
                  readingType: input.readingType,
                  id: { [Op.ne]: id }, // Excluir la lectura actual
                },
                transaction: t,
              });
            if (existingReading) {
              throw new Error(
                `A reading of type ${input.readingType} already exists for this nozzle and shift.`
              );
            }
          }

          // Lógica de validación si se actualiza `meterReading` o `readingType`
          if (
            input.meterReading !== undefined ||
            (input.readingType && input.readingType === ReadingType.FINAL)
          ) {
            const relatedReadings =
              await context.models.DispenserReading.findAll({
                where: {
                  dispenserNozzleId: dispenserReading.dispenserNozzleId,
                  employeeShiftId: dispenserReading.employeeShiftId,
                  id: { [Op.ne]: id },
                },
                transaction: t,
              });

            const initialReading = relatedReadings.find(
              (r) => r.readingType === ReadingType.INITIAL
            );
            const finalReading = relatedReadings.find(
              (r) => r.readingType === ReadingType.FINAL
            );

            let currentMeterReading =
              input.meterReading !== undefined
                ? input.meterReading
                : dispenserReading.meterReading;
            let currentReadingType =
              input.readingType !== undefined
                ? input.readingType
                : dispenserReading.readingType;

            if (
              currentReadingType === ReadingType.INITIAL &&
              finalReading &&
              currentMeterReading > finalReading.meterReading
            ) {
              throw new Error(
                "Initial meter reading cannot be greater than the existing final meter reading."
              );
            }
            if (
              currentReadingType === ReadingType.FINAL &&
              initialReading &&
              currentMeterReading < initialReading.meterReading
            ) {
              throw new Error(
                "Final meter reading cannot be less than the existing initial meter reading."
              );
            }
          }

          await dispenserReading.update(input, { transaction: t });
          return dispenserReading;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateDispenserReading' mutation:`,
          error.message || error
        );
        if (error.name === "SequelizeUniqueConstraintError") {
          throw new Error(
            "Updating to these values would create a duplicate reading type for this nozzle and shift."
          );
        }
        throw new Error(
          `An error occurred while updating the dispenser reading: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    // Eliminar una lectura
    deleteDispenserReading: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const deleted = await context.models.DispenserReading.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteDispenserReading' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the dispenser reading: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  DispenserReading: {
    dispenserNozzle: async (
      parent: DispenserReadingModel,
      _args,
      _context: Context
    ) => {
      return parent.getDispenserNozzle();
    },
    employeeShift: async (
      parent: DispenserReadingModel,
      _args,
      _context: Context
    ) => {
      return parent.getEmployeeShift();
    },
  },
};

export default dispenserReadingResolver;
