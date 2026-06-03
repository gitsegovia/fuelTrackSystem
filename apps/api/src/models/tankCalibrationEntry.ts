import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { TankModel } from "./tankModel";

export interface TankCalibrationEntryAttributes {
  id: string;
  tankModelId: string; // FK a TankModel
  heightCm: number; // Altura medida en centímetros (clave para la búsqueda)
  volumeLiters: number; // Volumen correspondiente a esa altura en litros
}

interface TankCalibrationEntryCreationAttributes
  extends Optional<TankCalibrationEntryAttributes, "id"> {}

export class TankCalibrationEntry
  extends Model<
    TankCalibrationEntryAttributes,
    TankCalibrationEntryCreationAttributes
  >
  implements TankCalibrationEntryAttributes
{
  public id!: string;
  public tankModelId!: string;
  public heightCm!: number;
  public volumeLiters!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getTankModel!: BelongsToGetAssociationMixin<TankModel>; // Alias 'tankModel' (normalizado)

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly tankModel?: TankModel;

  static associate(models: AppModels) {
    // Una entrada de calibración pertenece a un TankModel
    this.belongsTo(models.TankModel, {
      foreignKey: "tankModelId",
      as: "tankModel",
    });
  }
}

export function initialize(
  sequelize: Sequelize
): ModelStatic<TankCalibrationEntry> {
  TankCalibrationEntry.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      tankModelId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "tank_models", key: "id" }, // Referencia a la tabla tank_models
        onUpdate: "CASCADE",
        onDelete: "CASCADE", // Si se elimina un modelo de tanque, sus entradas de calibración también
      },
      heightCm: {
        type: DataTypes.DECIMAL(10, 2), // Altura en cm con 2 decimales para precisión
        allowNull: false,
      },
      volumeLiters: {
        type: DataTypes.DECIMAL(10, 2), // Volumen en litros con 2 decimales
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "tank_calibration_entries", // Nombre de la tabla
      modelName: "TankCalibrationEntry",
      indexes: [
        {
          unique: true,
          fields: ["tankModelId", "heightCm"],
          name: "unique_calibration_entry_per_model_height",
        },
      ],
    }
  );
  return TankCalibrationEntry;
}
