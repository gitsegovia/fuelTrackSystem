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
import { Invoice } from "./invoice";
import { DispatchReception } from "./dispatchReception";
import { Payment } from "./payment";

export interface CurrencyAttributes {
  id: string;
  name: string; // Nombre de la moneda (ej. "Bolivar Soberano", "Euro")
  symbol: string; // Símbolo de la moneda (ej. "Bs", "€")
  exchangeRate: number; // Tasa de cambio respecto a la moneda base (USD). Ej: 1 USD = 36.5 Bs, entonces exchangeRate = 36.5
}

interface CurrencyCreationAttributes
  extends Optional<CurrencyAttributes, "id"> {}

export class Currency
  extends Model<CurrencyAttributes, CurrencyCreationAttributes>
  implements CurrencyAttributes
{
  public id!: string;
  public name!: string;
  public symbol!: string;
  public exchangeRate!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getSaleTypeConfigs!: HasManyGetAssociationsMixin<SaleTypeConfig>; // Alias 'saleTypeConfigs'
  public getInvoices!: HasManyGetAssociationsMixin<Invoice>; // Alias 'invoices'
  public getDispatchReceptions!: HasManyGetAssociationsMixin<DispatchReception>; // Alias 'dispatchReceptions'
  public getPayments!: HasManyGetAssociationsMixin<Payment>; // Alias 'payments'

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly saleTypeConfigs?: SaleTypeConfig[];
  public readonly invoices?: Invoice[];
  public readonly dispatchReceptions?: DispatchReception[];
  public readonly payments?: Payment[];

  static associate(models: AppModels) {
    this.hasMany(models.SaleTypeConfig, {
      foreignKey: "currencyId",
      as: "saleTypeConfigs",
    });
    this.hasMany(models.Invoice, { foreignKey: "currencyId", as: "invoices" });
    this.hasMany(models.DispatchReception, {
      foreignKey: "currencyId",
      as: "dispatchReceptions",
    });
    this.hasMany(models.Payment, {
      foreignKey: "currencyId",
      as: "payments",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<Currency> {
  Currency.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Cada moneda debe tener un nombre único
      },
      symbol: {
        type: DataTypes.STRING(5), // Un símbolo corto, ej. "Bs", "$", "€"
        allowNull: false,
        unique: true, // Cada moneda debe tener un símbolo único
      },
      exchangeRate: {
        type: DataTypes.DECIMAL(10, 4), // Tasa de cambio con 4 decimales para precisión
        allowNull: false,
        defaultValue: 1.0, // La moneda base (USD) tendría una tasa de 1.0
      },
    },
    {
      sequelize,
      tableName: "currencies", // Nombre de la tabla en plural
      modelName: "Currency",
    }
  );
  return Currency;
}
