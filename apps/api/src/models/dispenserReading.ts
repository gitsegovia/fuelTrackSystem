import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { ReadingType } from "../utils/types";
import { DispenserNozzle } from "./dispenserNozzle";
import { EmployeeShift } from "./employeeShift";

export interface DispenserReadingAttributes {
  id: string;
  dispenserNozzleId: string; // FK a DispenserNozzle (la boquilla a la que pertenece la lectura)
  employeeShiftId: string; // FK a EmployeeShift (el turno de bombero al que se asocia la lectura)
  readingTime: Date; // Momento en que se tomó la lectura
  meterReading: number; // Valor del odómetro en ese momento
  readingType: ReadingType; // Tipo de lectura: 'initial' (al inicio del turno) o 'final' (al final del turno)
  createdAt: Date;
  updatedAt: Date;
}

interface DispenserReadingCreationAttributes
  extends Optional<DispenserReadingAttributes, "id"> {}

export class DispenserReading
  extends Model<DispenserReadingAttributes, DispenserReadingCreationAttributes>
  implements DispenserReadingAttributes
{
  public id!: string;
  public dispenserNozzleId!: string;
  public employeeShiftId!: string;
  public readingTime!: Date;
  public meterReading!: number;
  public readingType!: ReadingType;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getDispenserNozzle!: BelongsToGetAssociationMixin<DispenserNozzle>;
  public getEmployeeShift!: BelongsToGetAssociationMixin<EmployeeShift>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly dispenserNozzle?: DispenserNozzle;
  public readonly employeeShift?: EmployeeShift;

  static associate(models: AppModels) {
    // Una lectura de surtidor pertenece a una boquilla
    this.belongsTo(models.DispenserNozzle, {
      foreignKey: "dispenserNozzleId",
      as: "dispenserNozzle",
    });
    // Una lectura de surtidor pertenece a un turno de empleado (bombero)
    this.belongsTo(models.EmployeeShift, {
      foreignKey: "employeeShiftId",
      as: "employeeShift",
    });
  }
}

export function initialize(
  sequelize: Sequelize
): ModelStatic<DispenserReading> {
  DispenserReading.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      dispenserNozzleId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "dispenser_nozzles", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No eliminar boquilla si tiene lecturas asociadas
      },
      employeeShiftId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "employee_shifts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No eliminar turno si tiene lecturas asociadas
      },
      readingTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      meterReading: {
        type: DataTypes.DECIMAL(18, 2), // Misma precisión que el odómetro de la boquilla
        allowNull: false,
      },
      readingType: {
        type: DataTypes.ENUM(...Object.values(ReadingType)), // Tipo de lectura
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "dispenser_readings", // Nombre de la tabla en plural
      modelName: "DispenserReading",
      indexes: [
        {
          // Asegura que solo haya una lectura inicial y una final por boquilla por turno
          unique: true,
          fields: ["dispenserNozzleId", "employeeShiftId", "readingType"],
          name: "unique_reading_per_nozzle_shift_type",
        },
        {
          // Índice para búsquedas rápidas por boquilla y tiempo
          fields: ["dispenserNozzleId", "readingTime"],
        },
        {
          // Índice para búsquedas rápidas por turno y tiempo
          fields: ["employeeShiftId", "readingTime"],
        },
      ],
    }
  );
  return DispenserReading;
}
