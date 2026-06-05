import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { InvoicePaymentMethod } from "../utils/types";
import { Invoice } from "./invoice";
import { User } from "./user";

export interface InvoicePaymentAttributes {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: Date;
  bankName: string;
  paymentMethod: InvoicePaymentMethod;
  referenceNumber?: string;
  notes?: string;
  recordedById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface InvoicePaymentCreationAttributes
  extends Optional<
    InvoicePaymentAttributes,
    "id" | "referenceNumber" | "notes"
  > {}

export class InvoicePayment
  extends Model<InvoicePaymentAttributes, InvoicePaymentCreationAttributes>
  implements InvoicePaymentAttributes
{
  public id!: string;
  public invoiceId!: string;
  public amount!: number;
  public paymentDate!: Date;
  public bankName!: string;
  public paymentMethod!: InvoicePaymentMethod;
  public referenceNumber?: string;
  public notes?: string;
  public recordedById!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getInvoice!: BelongsToGetAssociationMixin<Invoice>;
  public getRecordedBy!: BelongsToGetAssociationMixin<User>;

  public readonly invoice?: Invoice;
  public readonly recordedBy?: User;

  static associate(models: AppModels) {
    this.belongsTo(models.Invoice, {
      foreignKey: "invoiceId",
      as: "invoice",
    });
    this.belongsTo(models.User, {
      foreignKey: "recordedById",
      as: "recordedBy",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<InvoicePayment> {
  InvoicePayment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      invoiceId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "invoices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      amount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      paymentDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      paymentMethod: {
        type: DataTypes.ENUM(...Object.values(InvoicePaymentMethod)),
        allowNull: false,
      },
      referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      recordedById: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
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
      tableName: "invoice_payments",
      modelName: "InvoicePayment",
      indexes: [
        { fields: ["invoiceId"] },
        { fields: ["paymentDate"] },
        { fields: ["recordedById"] },
      ],
    }
  );
  return InvoicePayment;
}
