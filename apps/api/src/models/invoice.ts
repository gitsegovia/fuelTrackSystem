import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
  HasManyGetAssociationsMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models"; // Asegúrate de que esta ruta sea correcta
import { FuelType } from "../utils/types";
import { GasStation } from "./gasStation";
import { DispatchReception } from "./dispatchReception";
import { Currency } from "./currency";

export interface InvoiceAttributes {
  id: string;
  invoiceNumber: string; // Número de factura
  controlNumber: string; // Número de control
  sealNumber: string; // Número de precinto (opcional)
  liters: number; // Litros despachados
  dispatchDate: Date; // Fecha de despacho
  dischargeDate: Date; // Fecha de descarga
  truckIdentifier: string; // Identificador de la gandola/cisterna
  fuelType: FuelType; // Tipo de combustible
  totalAmount: number; // Monto total de la factura
  costPerLiter: number; // Costo por litro
  gasStationId: string; // ID de la estación que recibe (GasStation)
  currencyId: string; // ID de la moneda (Currency)
}

// Para la creación, 'id' y 'sealNumber' son opcionales
interface InvoiceCreationAttributes extends Optional<InvoiceAttributes, "id"> {}

export class Invoice
  extends Model<InvoiceAttributes, InvoiceCreationAttributes>
  implements InvoiceAttributes
{
  public id!: string;
  public invoiceNumber!: string;
  public controlNumber!: string;
  public sealNumber!: string;
  public liters!: number;
  public dispatchDate!: Date;
  public dischargeDate!: Date;
  public truckIdentifier!: string;
  public fuelType!: FuelType;
  public totalAmount!: number;
  public costPerLiter!: number;
  public gasStationId!: string;
  public currencyId!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getReceivingGasStation!: BelongsToGetAssociationMixin<GasStation>;
  public getCurrency!: BelongsToGetAssociationMixin<Currency>;
  public getDispatchReceptions!: HasManyGetAssociationsMixin<DispatchReception>;

  public readonly receivingGasStation?: GasStation;
  public readonly currency?: Currency;
  public readonly dispatchReceptions?: DispatchReception[];

  static associate(models: AppModels) {
    this.belongsTo(models.GasStation, {
      foreignKey: "gasStationId",
      as: "receivingGasStation",
    });
    this.belongsTo(models.Currency, {
      foreignKey: "currencyId",
      as: "currency",
    });
    this.hasMany(models.DispatchReception, {
      foreignKey: "invoiceId",
      as: "dispatchReceptions",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<Invoice> {
  Invoice.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      invoiceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      controlNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sealNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      liters: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      dispatchDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      dischargeDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      truckIdentifier: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fuelType: {
        type: DataTypes.ENUM(...Object.values(FuelType)),
        allowNull: false,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      costPerLiter: {
        type: DataTypes.DECIMAL(10, 4), // 4 decimales para mayor precisión en costo
        allowNull: false,
      },
      gasStationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "gas_stations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No se elimina una estación si tiene facturas asociadas
      },
      currencyId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "currencies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
    },
    {
      sequelize,
      tableName: "invoices",
      modelName: "Invoice",
    }
  );
  return Invoice;
}
