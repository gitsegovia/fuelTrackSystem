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
import type { InvoicePayment } from "./invoicePayment";

export interface InvoiceAttributes {
  id: string;
  invoiceNumber: string;
  controlNumber: string;
  sealNumber: string;
  liters: number;
  dispatchDate: Date;
  dischargeDate: Date;
  truckPlate: string;
  tankPlate: string;
  driverName: string;
  driverIdNumber: string;
  fuelType: FuelType;
  totalAmount: number;
  costPerLiter: number;
  gasStationId: string;
  currencyId: string;
  status: 'PENDING' | 'CLOSED';
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
  public truckPlate!: string;
  public tankPlate!: string;
  public driverName!: string;
  public driverIdNumber!: string;
  public fuelType!: FuelType;
  public totalAmount!: number;
  public costPerLiter!: number;
  public gasStationId!: string;
  public currencyId!: string;
  public status!: 'PENDING' | 'CLOSED';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getReceivingGasStation!: BelongsToGetAssociationMixin<GasStation>;
  public getCurrency!: BelongsToGetAssociationMixin<Currency>;
  public getDispatchReceptions!: HasManyGetAssociationsMixin<DispatchReception>;
  public getInvoicePayments!: HasManyGetAssociationsMixin<InvoicePayment>;

  public readonly receivingGasStation?: GasStation;
  public readonly currency?: Currency;
  public readonly dispatchReceptions?: DispatchReception[];
  public readonly invoicePayments?: InvoicePayment[];

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
    this.hasMany(models.InvoicePayment, {
      foreignKey: "invoiceId",
      as: "invoicePayments",
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
      truckPlate: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tankPlate: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      driverName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      driverIdNumber: {
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
      status: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'PENDING',
        validate: { isIn: [['PENDING', 'CLOSED']] },
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
