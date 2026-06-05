import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { MeasurementReason } from "../utils/types";
import { Tank } from "./tank";
import { Employee } from "./employee";
import type { EmployeeShift } from "./employeeShift";

export interface TankMeasurementAttributes {
  id: string;
  tankId: string;
  employeeId: string;
  employeeShiftId?: string; // FK al turno activo del empleado, obligatorio en SHIFT_CLOSURE
  measurementTime: Date;
  manualLevelReadingCm: number;
  volumeInLiters: number;
  measurementReason: MeasurementReason;
  dispensedVolumeSinceLastMeasurement?: number;
  receivedVolumeSinceLastMeasurement?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TankMeasurementCreationAttributes
  extends Optional<
    TankMeasurementAttributes,
    | "id"
    | "employeeShiftId"
    | "dispensedVolumeSinceLastMeasurement"
    | "receivedVolumeSinceLastMeasurement"
    | "notes"
  > {}

export class TankMeasurement
  extends Model<TankMeasurementAttributes, TankMeasurementCreationAttributes>
  implements TankMeasurementAttributes
{
  public id!: string;
  public tankId!: string;
  public employeeId!: string;
  public employeeShiftId?: string;
  public measurementTime!: Date;
  public manualLevelReadingCm!: number;
  public volumeInLiters!: number;
  public measurementReason!: MeasurementReason;
  public dispensedVolumeSinceLastMeasurement?: number;
  public receivedVolumeSinceLastMeasurement?: number;
  public notes?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getTank!: BelongsToGetAssociationMixin<Tank>;
  public getEmployee!: BelongsToGetAssociationMixin<Employee>;
  public getEmployeeShift!: BelongsToGetAssociationMixin<EmployeeShift>;

  public readonly tank?: Tank;
  public readonly employee?: Employee;
  public readonly employeeShift?: EmployeeShift;

  static associate(models: AppModels) {
    this.belongsTo(models.Tank, {
      foreignKey: "tankId",
      as: "tank",
    });
    this.belongsTo(models.Employee, {
      foreignKey: "employeeId",
      as: "employee",
    });
    this.belongsTo(models.EmployeeShift, {
      foreignKey: "employeeShiftId",
      as: "employeeShift",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<TankMeasurement> {
  TankMeasurement.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      tankId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "tanks", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // Evita eliminar un tanque si tiene mediciones
      },
      employeeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "employees", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      employeeShiftId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "employee_shifts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      measurementTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      manualLevelReadingCm: {
        type: DataTypes.DECIMAL(10, 2), // Nivel en centímetros, ej. 250.75 cm
        allowNull: false,
      },
      volumeInLiters: {
        type: DataTypes.DECIMAL(18, 2), // Volumen calculado basado en la tabla de calibración
        allowNull: false,
      },
      measurementReason: {
        type: DataTypes.ENUM(...Object.values(MeasurementReason)), // Usa el ENUM definido
        allowNull: false,
      },
      dispensedVolumeSinceLastMeasurement: {
        type: DataTypes.DECIMAL(18, 2), // Volumen despachado (calculado)
        allowNull: true, // Nulo para la primera medición, luego calculado por la lógica de la aplicación
      },
      receivedVolumeSinceLastMeasurement: {
        type: DataTypes.DECIMAL(18, 2), // Volumen recibido (calculado)
        allowNull: true, // Nulo para la primera medición, luego calculado por la lógica de la aplicación
      },
      notes: {
        type: DataTypes.TEXT, // Para cualquier comentario adicional
        allowNull: true,
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
      tableName: "tank_measurements", // Nombre de la tabla en plural
      modelName: "TankMeasurement",
      indexes: [
        {
          // Índice para búsquedas rápidas por tanque y tiempo
          fields: ["tankId", "measurementTime"],
        },
        {
          // Índice para búsquedas rápidas por empleado y tiempo
          fields: ["employeeId", "measurementTime"],
        },
        {
          // Índice para búsquedas rápidas por motivo
          fields: ["measurementReason"],
        },
      ],
    }
  );
  return TankMeasurement;
}
