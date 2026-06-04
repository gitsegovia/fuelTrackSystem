// src/models/SaleTypeConfig.ts

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
import { SaleTypeName } from "../utils/types";
import { GasStation } from "./gasStation";
import { FuelType } from "./fuelType";
import { SalesTicket } from "./salesTicket";
import { Currency } from "./currency";

export interface SaleTypeConfigAttributes {
  id: string;
  gasStationId: string; // FK a GasStation
  fuelTypeId: string; // FK a FuelType (la nueva tabla de tipos de combustible base)
  saleTypeName: SaleTypeName; // El tipo de venta (ej. 'Regular', 'Subsidized')
  salePricePerLiter: number; // El precio de venta al público para este tipo de venta
  percentage: number; // Porcentaje del combustible que se vende bajo esta modalidad (0-100);
  currencyId: string;
}

interface SaleTypeConfigCreationAttributes
  extends Optional<SaleTypeConfigAttributes, "id"> {}

export class SaleTypeConfig
  extends Model<SaleTypeConfigAttributes, SaleTypeConfigCreationAttributes>
  implements SaleTypeConfigAttributes
{
  public id!: string;
  public gasStationId!: string;
  public fuelTypeId!: string;
  public saleTypeName!: SaleTypeName;
  public salePricePerLiter!: number;
  public percentage!: number;
  public currencyId!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getGasStation!: BelongsToGetAssociationMixin<GasStation>; // Alias 'gasStation' (normalizado)
  public getFuelType!: BelongsToGetAssociationMixin<FuelType>; // Alias 'fuelType' (normalizado)
  public getAssociatedSalesTickets!: HasManyGetAssociationsMixin<SalesTicket>; // Alias 'associatedSalesTickets'
  public getCurrency!: BelongsToGetAssociationMixin<Currency>; // Alias 'currency'

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly gasStation?: GasStation;
  public readonly fuelType?: FuelType;
  public readonly associatedSalesTickets?: SalesTicket[];
  public readonly currency?: Currency;

  static associate(models: AppModels) {
    // Relación Many-to-One: Una configuración pertenece a una estación de gasolina
    this.belongsTo(models.GasStation, {
      foreignKey: "gasStationId",
      as: "gasStation",
    });
    // Relación Many-to-One: Una configuración se refiere a un tipo de combustible
    this.belongsTo(models.FuelType, {
      foreignKey: "fuelTypeId",
      as: "fuelType",
    });
    this.hasMany(models.SalesTicket, {
      foreignKey: "assignedSaleTypeConfigId",
      as: "associatedSalesTickets",
    });
    this.belongsTo(models.Currency, {
      foreignKey: "currencyId",
      as: "currency",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<SaleTypeConfig> {
  SaleTypeConfig.init(
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
        onDelete: "CASCADE",
      },
      saleTypeName: {
        type: DataTypes.ENUM(...Object.values(SaleTypeName)),
        allowNull: false,
      },
      salePricePerLiter: {
        type: DataTypes.DECIMAL(10, 4), // Precio de venta al público
        allowNull: false,
      },
      percentage: {
        type: DataTypes.DECIMAL(5, 2), // 0.00 – 100.00
        allowNull: false,
        validate: {
          min: 0,
          max: 100,
        },
      },
      currencyId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "currencies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No borrar la moneda si está en uso por una configuración de venta
      },
    },
    {
      sequelize,
      tableName: "sale_type_configs",
      modelName: "SaleTypeConfig",
      indexes: [
        // Índice único compuesto para asegurar que una estación no tenga la misma combinación
        // de tipo de combustible y tipo de venta duplicada.
        {
          unique: true,
          fields: ["gasStationId", "fuelTypeId", "saleTypeName"],
          name: "unique_station_fuel_sale_config",
        },
      ],
    }
  );
  return SaleTypeConfig;
}
