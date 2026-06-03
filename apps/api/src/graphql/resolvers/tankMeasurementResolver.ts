import { IResolvers } from "@graphql-tools/utils";
import { Context } from "../../interfaces";
import { TankMeasurement as TankMeasurementModel } from "../../models/tankMeasurement";
import { Op } from "sequelize"; // Importar Op para operadores de Sequelize

const tankMeasurementResolver: IResolvers<Context> = {
  Query: {
    tankMeasurements: async (_parent, _args, context: Context) => {
      return context.models.TankMeasurement.findAll({
        include: [
          { model: context.models.Tank, as: "tank" },
          { model: context.models.Employee, as: "employee" },
        ],
        order: [["measurementTime", "DESC"]],
      });
    },
    tankMeasurement: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      return context.models.TankMeasurement.findByPk(id, {
        include: [
          { model: context.models.Tank, as: "tank" },
          { model: context.models.Employee, as: "employee" },
        ],
      });
    },
    tankMeasurementsByTank: async (
      _parent,
      {
        tankId,
        startDate,
        endDate,
      }: { tankId: string; startDate?: Date; endDate?: Date },
      context: Context
    ) => {
      const where: any = { tankId };
      if (startDate && endDate) {
        where.measurementTime = {
          [Op.between]: [startDate, endDate],
        };
      } else if (startDate) {
        where.measurementTime = {
          [Op.gte]: startDate,
        };
      } else if (endDate) {
        where.measurementTime = {
          [Op.lte]: endDate,
        };
      }
      return context.models.TankMeasurement.findAll({
        where,
        include: [
          { model: context.models.Tank, as: "tank" },
          { model: context.models.Employee, as: "employee" },
        ],
        order: [["measurementTime", "DESC"]],
      });
    },
    tankMeasurementsByEmployee: async (
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
        where.measurementTime = {
          [Op.between]: [startDate, endDate],
        };
      } else if (startDate) {
        where.measurementTime = {
          [Op.gte]: startDate,
        };
      } else if (endDate) {
        where.measurementTime = {
          [Op.lte]: endDate,
        };
      }
      return context.models.TankMeasurement.findAll({
        where,
        include: [
          { model: context.models.Tank, as: "tank" },
          { model: context.models.Employee, as: "employee" },
        ],
        order: [["measurementTime", "DESC"]],
      });
    },
    latestTankMeasurement: async (
      _parent,
      { tankId }: { tankId: string },
      context: Context
    ) => {
      return context.models.TankMeasurement.findOne({
        where: { tankId },
        order: [["measurementTime", "DESC"]],
        include: [
          { model: context.models.Tank, as: "tank" },
          { model: context.models.Employee, as: "employee" },
        ],
      });
    },
  },
  Mutation: {
    createTankMeasurement: async (_parent, { input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const { tankId, manualLevelReadingCm, ...restInput } = input;

          const tank = await context.models.Tank.findByPk(tankId, {
            include: [{ model: context.models.TankModel, as: "tankModel" }],
            transaction: t,
          });

          if (!tank) {
            throw new Error("Tank not found.");
          }
          if (!tank.tankModel) {
            throw new Error(
              "Tank model not associated with this tank. Cannot calculate volume."
            );
          }

          // Calcular volumeInLiters usando la tabla de calibración
          const calibrationEntry =
            await context.models.TankCalibrationEntry.findOne({
              where: {
                tankModelId: tank.tankModelId,
                heightCm: { [Op.lte]: manualLevelReadingCm }, // Buscar la entrada más cercana por debajo o igual
              },
              order: [["heightCm", "DESC"]],
              transaction: t,
            });

          if (!calibrationEntry) {
            throw new Error(
              "No calibration data found for this tank model at or below the given height."
            );
          }

          // Nota: Una implementación más robusta usaría interpolación lineal
          // entre dos puntos de calibración si la altura no es exacta.
          // Por simplicidad, tomamos el volumen del punto de calibración más cercano por debajo.
          const calculatedVolumeInLiters = calibrationEntry.volumeLiters;

          // Obtener la última medición para calcular las diferencias
          const latestMeasurement =
            await context.models.TankMeasurement.findOne({
              where: { tankId: input.tankId },
              order: [["measurementTime", "DESC"]],
              transaction: t,
            });

          let dispensedVolumeSinceLastMeasurement: number | null = null;
          let receivedVolumeSinceLastMeasurement: number | null = null;

          if (latestMeasurement) {
            // --- Lógica compleja para calcular volúmenes despachados y recibidos ---
            // Esto requeriría:
            // 1. Obtener todas las sales (tickets) de este tanque desde latestMeasurement.measurementTime hasta input.measurementTime
            // 2. Obtener todas las recepciones de despacho para este tanque en el mismo período
            // 3. Sumar los litros despachados y recibidos.

            // Ejemplo simplificado (solo con los datos disponibles en la tabla de mediciones)
            // En un escenario real, necesitarías consultar DispenserReading, SalesTicket, DispatchReception
            // para obtener el volumen exacto despachado y recibido.

            // Calculo bruto basado en la diferencia de volumen (no preciso sin datos de transacciones)
            const volumeChange =
              calculatedVolumeInLiters - latestMeasurement.volumeInLiters;
            if (volumeChange < 0) {
              dispensedVolumeSinceLastMeasurement = -volumeChange;
              receivedVolumeSinceLastMeasurement = 0;
            } else {
              receivedVolumeSinceLastMeasurement = volumeChange;
              dispensedVolumeSinceLastMeasurement = 0;
            }

            // Aquí es donde iría la lógica de consulta a otras tablas
            // const salesLiters = await context.models.SalesTicket.sum('actualLitersDispatched', {
            //   where: {
            //     dispenserNozzleId: { [Op.in]: (await context.models.Dispenser.findAll({ where: { tankId: tankId }, attributes: ['id'], transaction: t })).map(d => d.id) }, // Esto es un ejemplo, necesitarías ir por DispenserNozzle
            //     ticketIssueTime: { [Op.between]: [latestMeasurement.measurementTime, input.measurementTime] }
            //   },
            //   transaction: t
            // });

            // const receivedLiters = await context.models.DispatchReception.sum('receivedLiters', {
            //   where: {
            //     tankId: tankId,
            //     receptionDate: { [Op.between]: [latestMeasurement.measurementTime, input.measurementTime] }
            //   },
            //   transaction: t
            // });

            // dispensedVolumeSinceLastMeasurement = salesLiters;
            // receivedVolumeSinceLastMeasurement = receivedLiters;
          }

          const newMeasurement = await context.models.TankMeasurement.create(
            {
              ...restInput,
              tankId,
              manualLevelReadingCm,
              volumeInLiters: calculatedVolumeInLiters,
              dispensedVolumeSinceLastMeasurement,
              receivedVolumeSinceLastMeasurement,
            },
            { transaction: t }
          );

          // Opcional: Actualizar el currentHeightCm y currentVolumeLiters del Tank
          await tank.update(
            {
              currentHeightCm: manualLevelReadingCm,
              currentVolumeLiters: calculatedVolumeInLiters,
            },
            { transaction: t }
          );

          return newMeasurement;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'createTankMeasurement' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while creating the tank measurement: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    updateTankMeasurement: async (_parent, { id, input }, context: Context) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const measurement = await context.models.TankMeasurement.findByPk(
            id,
            { transaction: t }
          );
          if (!measurement) {
            throw new Error("Tank measurement not found.");
          }

          const { manualLevelReadingCm, ...restInput } = input;
          let calculatedVolumeInLiters = input.volumeInLiters; // Mantener si ya se proveyó

          if (manualLevelReadingCm !== undefined) {
            const tank = await context.models.Tank.findByPk(
              measurement.tankId,
              {
                include: [{ model: context.models.TankModel, as: "tankModel" }],
                transaction: t,
              }
            );

            if (!tank || !tank.tankModel) {
              throw new Error(
                "Tank or Tank Model not found. Cannot recalculate volume."
              );
            }

            const calibrationEntry =
              await context.models.TankCalibrationEntry.findOne({
                where: {
                  tankModelId: tank.tankModelId,
                  heightCm: { [Op.lte]: manualLevelReadingCm },
                },
                order: [["heightCm", "DESC"]],
                transaction: t,
              });

            if (!calibrationEntry) {
              throw new Error(
                "No calibration data found for this tank model at or below the given height."
              );
            }
            calculatedVolumeInLiters = calibrationEntry.volumeLiters;
          }

          // **Consideración importante:** Actualizar `dispensedVolumeSinceLastMeasurement` y `receivedVolumeSinceLastMeasurement`
          // en una actualización es MUY complejo porque podría invalidar cálculos posteriores.
          // Generalmente, estos campos se calculan solo al momento de la creación de la medición.
          // Si se permite actualizar la lectura, lo más seguro es dejar estos campos como están
          // o forzar una recalibración completa de la serie de mediciones, lo cual es costoso.
          // Por simplicidad, no los actualizaremos aquí automáticamente.
          await measurement.update(
            {
              ...restInput,
              manualLevelReadingCm,
              volumeInLiters: calculatedVolumeInLiters, // Asegurarse de usar el calculado si se actualizó el nivel
            },
            { transaction: t }
          );

          // Opcional: Actualizar el currentHeightCm y currentVolumeLiters del Tank si esta es la última medición
          // Para esto, necesitarías verificar si `measurement.id` es la `latestTankMeasurement` para ese `tankId`
          // y solo entonces actualizar el tanque.
          // let latest = await context.models.TankMeasurement.findOne({
          //   where: { tankId: measurement.tankId },
          //   order: [['measurementTime', 'DESC']],
          //   transaction: t
          // });
          // if (latest && latest.id === measurement.id) {
          //   await measurement.getTank({ transaction: t }).then(tank => {
          //     if (tank) {
          //       tank.update({
          //         currentHeightCm: manualLevelReadingCm !== undefined ? manualLevelReadingCm : tank.currentHeightCm,
          //         currentVolumeLiters: calculatedVolumeInLiters !== undefined ? calculatedVolumeInLiters : tank.currentVolumeLiters
          //       }, { transaction: t });
          //     }
          //   });
          // }

          return measurement;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'updateTankMeasurement' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while updating the tank measurement: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
    deleteTankMeasurement: async (
      _parent,
      { id }: { id: string },
      context: Context
    ) => {
      try {
        const result = await context.sequelize.transaction(async (t: any) => {
          const measurement = await context.models.TankMeasurement.findByPk(
            id,
            { transaction: t }
          );
          if (!measurement) {
            throw new Error("Tank measurement not found.");
          }
          // **Consideración importante:** Eliminar una medición de tanque puede desordenar
          // los cálculos `dispensedVolumeSinceLastMeasurement` y `receivedVolumeSinceLastMeasurement`
          // de las mediciones *posteriores*. En un sistema real, esto requeriría una re-evaluación
          // de todas las mediciones subsiguientes para ese tanque.
          const deleted = await context.models.TankMeasurement.destroy({
            where: { id },
            transaction: t,
          });
          return deleted > 0;
        });
        return result;
      } catch (error: any) {
        console.error(
          `❌ Error in 'deleteTankMeasurement' mutation:`,
          error.message || error
        );
        throw new Error(
          `An error occurred while deleting the tank measurement: ${
            error.message || "Unknown error"
          }`
        );
      }
    },
  },
  // --- Resolvers de Campo para relaciones ---
  TankMeasurement: {
    tank: async (parent: TankMeasurementModel, _args, _context: Context) => {
      return parent.getTank();
    },
    employee: async (
      parent: TankMeasurementModel,
      _args,
      _context: Context
    ) => {
      return parent.getEmployee();
    },
  },
};

export default tankMeasurementResolver;
