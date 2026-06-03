import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  HasManyGetAssociationsMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models"; // Ajustado según tu indicación
import { TankCalibrationEntry } from "./tankCalibrationEntry";
import { Tank } from "./tank";

export interface TankModelAttributes {
  id: string;
  name: string; // Nombre del modelo (ej. "Cilíndrico Horizontal 20k L")
  nominalCapacity: number; // Capacidad nominal en litros (ej. 20000)
  shape: string; // Forma del tanque (ej. "Cylindrical Horizontal", "Cylindrical Vertical", "Rectangular")
  lengthCm?: number; // Longitud del tanque en cm (opcional, si aplica)
  diameterCm?: number; // Diámetro del tanque en cm (opcional, si aplica)
  widthCm?: number; // Ancho del tanque en cm (opcional, si aplica)
  heightCm?: number; // Altura del tanque en cm (opcional, si aplica)
  description?: string; // Descripción adicional
}

interface TankModelCreationAttributes
  extends Optional<
    TankModelAttributes,
    "id" | "lengthCm" | "diameterCm" | "widthCm" | "heightCm" | "description"
  > {}

export class TankModel
  extends Model<TankModelAttributes, TankModelCreationAttributes>
  implements TankModelAttributes
{
  public id!: string;
  public name!: string;
  public nominalCapacity!: number;
  public shape!: string;
  public lengthCm?: number;
  public diameterCm?: number;
  public widthCm?: number;
  public heightCm?: number;
  public description?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getCalibrationEntries!: HasManyGetAssociationsMixin<TankCalibrationEntry>;
  public getTanks!: HasManyGetAssociationsMixin<Tank>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly calibrationEntries?: TankCalibrationEntry[];
  public readonly tanks?: Tank[];

  static associate(models: AppModels) {
    // Un TankModel puede tener muchas entradas de calibración (TankCalibrationEntry)
    this.hasMany(models.TankCalibrationEntry, {
      foreignKey: "tankModelId",
      as: "calibrationEntries",
    });
    // Un TankModel puede ser usado por muchos tanques físicos (Tank)
    this.hasMany(models.Tank, {
      foreignKey: "tankModelId",
      as: "tanks",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<TankModel> {
  TankModel.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Cada modelo de tanque debe tener un nombre único
      },
      nominalCapacity: {
        type: DataTypes.DECIMAL(10, 2), // Capacidad en litros con 2 decimales
        allowNull: false,
      },
      shape: {
        type: DataTypes.STRING,
        allowNull: false,
        // Podrías considerar un ENUM aquí si las formas son fijas (ej. ['Cylindrical Horizontal', 'Cylindrical Vertical', 'Rectangular'])
      },
      lengthCm: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // Opcional, dependiendo de la forma
      },
      diameterCm: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // Opcional, si aplica para cilindros
      },
      widthCm: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // Opcional, si aplica para rectangulares
      },
      heightCm: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // Opcional, si aplica para rectangulares
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "tank_models", // Nombre de la tabla en plural
      modelName: "TankModel",
    }
  );
  return TankModel;
}
