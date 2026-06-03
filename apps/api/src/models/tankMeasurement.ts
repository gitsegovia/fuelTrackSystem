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

export interface TankMeasurementAttributes {
  id: string;
  tankId: string; // FK al Tanque (el tanque que está siendo medido)
  employeeId: string; // FK al Empleado (el empleado que realizó la medición)
  measurementTime: Date; // Fecha y hora de la medición
  manualLevelReadingCm: number; // Lectura manual del nivel en centímetros (cm)
  volumeInLiters: number; // Volumen calculado en litros basado en la tabla de calibración y la lectura del nivel
  measurementReason: MeasurementReason; // Motivo de esta medición
  dispensedVolumeSinceLastMeasurement?: number; // Volumen despachado de este tanque desde la última medición (calculado por la lógica de la aplicación)
  receivedVolumeSinceLastMeasurement?: number; // Volumen recibido en este tanque desde la última medición (calculado por la lógica de la aplicación)
  notes?: string; // Notas opcionales sobre la medición
  createdAt: Date;
  updatedAt: Date;
}

interface TankMeasurementCreationAttributes
  extends Optional<
    TankMeasurementAttributes,
    | "id"
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
  public measurementTime!: Date;
  public manualLevelReadingCm!: number;
  public volumeInLiters!: number;
  public measurementReason!: MeasurementReason;
  public dispensedVolumeSinceLastMeasurement?: number;
  public receivedVolumeSinceLastMeasurement?: number;
  public notes?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getTank!: BelongsToGetAssociationMixin<Tank>;
  public getEmployee!: BelongsToGetAssociationMixin<Employee>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly tank?: Tank;
  public readonly employee?: Employee;

  static associate(models: AppModels) {
    // Una medición de tanque pertenece a un tanque específico
    this.belongsTo(models.Tank, {
      foreignKey: "tankId",
      as: "tank",
    });
    // Una medición de tanque es realizada por un empleado
    this.belongsTo(models.Employee, {
      foreignKey: "employeeId",
      as: "employee",
    });
    // Se podría considerar añadir un enlace a EmployeeShift si se desea vincularlo explícitamente al turno
    // durante el cual ocurrió. Sin embargo, el employeeId y measurementTime podrían ser suficientes
    // para inferir el turno a través de la lógica de negocio.
    // this.belongsTo(models.EmployeeShift, {
    //   foreignKey: 'employeeShiftId', // Se necesitaría añadir esta FK al modelo
    //   as: 'employeeShift',
    // });
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
        onDelete: "RESTRICT", // Evita eliminar un empleado si realizó mediciones
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
