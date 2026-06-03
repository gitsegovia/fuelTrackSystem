import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
  HasManyGetAssociationsMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { GasStation } from "./gasStation";
import { FuelType } from "./fuelType";
import { TankModel } from "./tankModel";
import { TankAssignment } from "./tankAssignment";
import { Dispenser } from "./dispenser";
import { DispatchReception } from "./dispatchReception";
import { TankMeasurement } from "./tankMeasurement";

export interface TankAttributes {
  id: string;
  gasStationId: string; // FK a GasStation
  fuelTypeId: string; // FK a FuelType
  tankModelId: string; // FK a TankModel (para la calibración)
  name: string; // Nombre del tanque (ej. "Tanque Diesel #1")
  currentHeightCm?: number; // Altura actual en cm (medición manual del operador)
  currentVolumeLiters?: number; // Volumen actual en litros (calculado desde currentHeightCm)
  maxCapacityLiters: number; // Capacidad máxima del tanque según placa o aforo
  minOperatingVolumeLiters: number; // Volumen mínimo operativo antes de requerir reabastecimiento
}

interface TankCreationAttributes
  extends Optional<
    TankAttributes,
    "id" | "currentHeightCm" | "currentVolumeLiters"
  > {}

export class Tank
  extends Model<TankAttributes, TankCreationAttributes>
  implements TankAttributes
{
  public id!: string;
  public gasStationId!: string;
  public fuelTypeId!: string;
  public tankModelId!: string;
  public name!: string;
  public currentHeightCm?: number;
  public currentVolumeLiters?: number;
  public maxCapacityLiters!: number;
  public minOperatingVolumeLiters!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Sequelize Mixins for relationships ---
  public getGasStation!: BelongsToGetAssociationMixin<GasStation>;
  public getFuelType!: BelongsToGetAssociationMixin<FuelType>;
  public getTankModel!: BelongsToGetAssociationMixin<TankModel>;
  public getTankAssignments!: HasManyGetAssociationsMixin<TankAssignment>;
  public getConnectedDispensers!: HasManyGetAssociationsMixin<Dispenser>;
  public getDispatchReceptions!: HasManyGetAssociationsMixin<DispatchReception>;
  public getMeasurements!: HasManyGetAssociationsMixin<TankMeasurement>;

  // --- Read-only properties for relationships (if used with `include`) ---
  public readonly gasStation?: GasStation;
  public readonly fuelType?: FuelType;
  public readonly tankModel?: TankModel;
  public readonly tankAssignments?: TankAssignment[];
  public readonly connectedDispensers?: Dispenser[];
  public readonly dispatchReceptions?: DispatchReception[];
  public readonly measurements?: TankMeasurement[];

  // Asociaciones
  static associate(models: AppModels) {
    // Un tanque pertenece a una estación de servicio
    this.belongsTo(models.GasStation, {
      foreignKey: "gasStationId",
      as: "gasStation",
    });
    // Un tanque almacena un tipo de combustible
    this.belongsTo(models.FuelType, {
      foreignKey: "fuelTypeId",
      as: "fuelType",
    });
    // Un tanque se basa en un modelo de tanque (para su calibración)
    this.belongsTo(models.TankModel, {
      foreignKey: "tankModelId",
      as: "tankModel",
    });
    this.hasMany(models.TankAssignment, {
      foreignKey: "tankId",
      as: "tankAssignments",
    });
    this.hasMany(models.Dispenser, {
      foreignKey: "tankId",
      as: "connectedDispensers", // Nombre descriptivo para evitar conflictos con 'tanks' en FuelType
    });
    // Un tanque puede tener muchas recepciones/despachos (DispatchReception)
    this.hasMany(models.DispatchReception, {
      foreignKey: "tankId",
      as: "dispatchReceptions",
    });
    this.hasMany(models.TankMeasurement, {
      foreignKey: "tankId",
      as: "measurements",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<Tank> {
  Tank.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      gasStationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "gas_stations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fuelTypeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "fuel_types", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No se puede eliminar un tipo de combustible si está asignado a un tanque
      },
      tankModelId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "tank_models", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No se puede eliminar un modelo de tanque si está asignado a un tanque físico
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Cada tanque debe tener un nombre único
      },
      currentHeightCm: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // Puede ser null si aún no se ha medido
      },
      currentVolumeLiters: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true, // Puede ser null, se calcula a partir de currentHeightCm
      },
      maxCapacityLiters: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      minOperatingVolumeLiters: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0, // Valor predeterminado
      },
    },
    {
      sequelize,
      tableName: "tanks", // Nombre de la tabla en plural
      modelName: "Tank",
      indexes: [
        {
          unique: true,
          fields: ["gasStationId", "name"], // Asegura que no haya dos tanques con el mismo nombre en la misma estación
          name: "unique_tank_name_per_station",
        },
      ],
    }
  );
  return Tank;
}
