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
import { PumpIsland } from "./pumpIsland";
import { Tank } from "./tank";
import { FuelType } from "./fuelType";
import { SalesTicket } from "./salesTicket";
import { DispenserNozzle } from "./dispenserNozzle";

export interface DispenserAttributes {
  id: string;
  gasStationId: string; // FK a GasStation
  pumpIslandId: string; // FK a PumpIsland (el andén donde se ubica)
  tankId: string; // FK a Tank (el tanque del que despacha)
  fuelTypeId: string; // FK a FuelType (el tipo de combustible que despacha)
  name: string; // Nombre del surtidor (ej. "Surtidor 1", "Bomba Diesel A")
  isOperational: boolean; // Indica si el surtidor está en funcionamiento
  createdAt: Date;
  updatedAt: Date;
}

interface DispenserCreationAttributes
  extends Optional<DispenserAttributes, "id"> {}

export class Dispenser
  extends Model<DispenserAttributes, DispenserCreationAttributes>
  implements DispenserAttributes
{
  public id!: string;
  public gasStationId!: string;
  public pumpIslandId!: string;
  public tankId!: string;
  public fuelTypeId!: string;
  public name!: string;
  public isOperational!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getGasStation!: BelongsToGetAssociationMixin<GasStation>;
  public getPumpIsland!: BelongsToGetAssociationMixin<PumpIsland>;
  public getTank!: BelongsToGetAssociationMixin<Tank>;
  public getFuelType!: BelongsToGetAssociationMixin<FuelType>;
  public getSalesTickets!: HasManyGetAssociationsMixin<SalesTicket>;
  public getNozzles!: HasManyGetAssociationsMixin<DispenserNozzle>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly gasStation?: GasStation;
  public readonly pumpIsland?: PumpIsland;
  public readonly tank?: Tank;
  public readonly fuelType?: FuelType;
  public readonly salesTickets?: SalesTicket[];
  public readonly nozzles?: DispenserNozzle[];

  static associate(models: AppModels) {
    // Un surtidor pertenece a una estación de servicio
    this.belongsTo(models.GasStation, {
      foreignKey: "gasStationId",
      as: "gasStation",
    });
    // Un surtidor se ubica en un andén
    this.belongsTo(models.PumpIsland, {
      foreignKey: "pumpIslandId",
      as: "pumpIsland",
    });
    // Un surtidor está conectado a un tanque específico
    this.belongsTo(models.Tank, {
      foreignKey: "tankId",
      as: "tank",
    });
    // Un surtidor despacha un tipo de combustible
    this.belongsTo(models.FuelType, {
      foreignKey: "fuelTypeId",
      as: "fuelType",
    });
    // Un surtidor puede tener muchas boquillas/caras
    this.hasMany(models.DispenserNozzle, {
      foreignKey: "dispenserId",
      as: "nozzles",
    });
    // Un surtidor puede estar referenciado en muchos tickets de venta
    this.hasMany(models.SalesTicket, {
      foreignKey: "dispenserId", // Aunque el ticket se asocia más directamente con DispenserNozzle,
      // puede ser útil tener esta FK aquí también para consultas generales
      as: "salesTickets",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<Dispenser> {
  Dispenser.init(
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
        onDelete: "CASCADE", // Si se elimina la estación, sus surtidores también
      },
      pumpIslandId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "pump_islands", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No se elimina un andén si tiene surtidores
      },
      tankId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "tanks", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No se elimina un tanque si tiene surtidores conectados
      },
      fuelTypeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "fuel_types", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No se elimina un tipo de combustible si está en uso por un surtidor
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isOperational: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      tableName: "dispensers", // Nombre de la tabla en plural
      modelName: "Dispenser",
      indexes: [
        {
          unique: true,
          fields: ["gasStationId", "name"], // Un nombre de surtidor debe ser único por estación
          name: "unique_dispenser_name_per_station",
        },
        {
          // Índice para búsquedas rápidas por andén
          fields: ["pumpIslandId"],
        },
        {
          // Índice para búsquedas rápidas por tanque
          fields: ["tankId"],
        },
        {
          // Índice para búsquedas rápidas por tipo de combustible
          fields: ["fuelTypeId"],
        },
      ],
    }
  );
  return Dispenser;
}
