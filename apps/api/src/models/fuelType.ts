import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  HasManyGetAssociationsMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { SaleTypeConfig } from "./saleTypeConfig";
import { Tank } from "./tank";
import { Dispenser } from "./dispenser";
import { SalesTicket } from "./salesTicket";

export interface FuelTypeAttributes {
  id: string;
  name: string; // Nombre del tipo de combustible (ej. "Gasolina 91 Octanos", "Diésel")
  costPerLiter: number; // Costo por litro de despacho (no el precio de venta al público)
}

interface FuelTypeCreationAttributes
  extends Optional<FuelTypeAttributes, "id"> {}

export class FuelType
  extends Model<FuelTypeAttributes, FuelTypeCreationAttributes>
  implements FuelTypeAttributes
{
  public id!: string;
  public name!: string;
  public costPerLiter!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getSaleTypeConfig!: HasManyGetAssociationsMixin<SaleTypeConfig>; // Normalizado a 'saleTypeConfigs'
  public getTanksStoringThisFuel!: HasManyGetAssociationsMixin<Tank>; // Normalizado a 'tanksStoringThisFuel'
  public getDispensersHandlingThisFuel!: HasManyGetAssociationsMixin<Dispenser>; // Normalizado a 'dispensersHandlingThisFuel'
  public getSalesTicketsForFuel!: HasManyGetAssociationsMixin<SalesTicket>; // Normalizado a 'salesTicketsForFuel'

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly saleTypeConfig?: SaleTypeConfig[];
  public readonly tanksStoringThisFuel?: Tank[];
  public readonly dispensersHandlingThisFuel?: Dispenser[];
  public readonly salesTicketsForFuel?: SalesTicket[];

  static associate(models: AppModels) {
    // Una FuelType puede tener muchas configuraciones de venta
    this.hasMany(models.SaleTypeConfig, {
      foreignKey: "fuelTypeId",
      as: "saleTypeConfig",
    });
    this.hasMany(models.Tank, {
      foreignKey: "fuelTypeId",
      as: "tanksStoringThisFuel", // Nombre más descriptivo para evitar ambigüedades
    });
    this.hasMany(models.Dispenser, {
      foreignKey: "fuelTypeId",
      as: "dispensersHandlingThisFuel", // Nombre descriptivo
    });
    this.hasMany(models.SalesTicket, {
      foreignKey: "fuelTypeId",
      as: "salesTicketsForFuel",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<FuelType> {
  FuelType.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Cada tipo de combustible debe tener un nombre único
      },
      costPerLiter: {
        type: DataTypes.DECIMAL(10, 4), // Costo por litro con mayor precisión
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "fuel_types", // Renombramos la tabla a fuel_types
      modelName: "FuelType",
    }
  );
  return FuelType;
}
