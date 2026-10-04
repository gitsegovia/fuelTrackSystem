import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { PaymentMethod } from "../utils/types";
import { SalesTicket } from "./salesTicket";
import { Currency } from "./currency";
import { User } from "./user";

export interface TicketRefundAttributes {
  id: string;
  salesTicketId: string;
  amount: number;
  currencyId: string;
  exchangeRateAtRefund: number;
  paymentMethod: PaymentMethod;
  recordedById: string;
  refundedAt: Date;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TicketRefundCreationAttributes
  extends Optional<TicketRefundAttributes, "id" | "notes" | "createdAt" | "updatedAt"> {}

export class TicketRefund
  extends Model<TicketRefundAttributes, TicketRefundCreationAttributes>
  implements TicketRefundAttributes
{
  public id!: string;
  public salesTicketId!: string;
  public amount!: number;
  public currencyId!: string;
  public exchangeRateAtRefund!: number;
  public paymentMethod!: PaymentMethod;
  public recordedById!: string;
  public refundedAt!: Date;
  public notes?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getSalesTicket!: BelongsToGetAssociationMixin<SalesTicket>;
  public getCurrency!: BelongsToGetAssociationMixin<Currency>;

  public readonly salesTicket?: SalesTicket;
  public readonly currency?: Currency;
  public readonly recordedBy?: User;

  static associate(models: AppModels) {
    this.belongsTo(models.SalesTicket, { foreignKey: "salesTicketId", as: "salesTicket" });
    this.belongsTo(models.Currency, { foreignKey: "currencyId", as: "currency" });
    this.belongsTo(models.User, { foreignKey: "recordedById", as: "recordedBy" });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<TicketRefund> {
  TicketRefund.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      salesTicketId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "sales_tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      amount: {
        type: DataTypes.DECIMAL(18, 2), // En la moneda indicada por currencyId
        allowNull: false,
      },
      currencyId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "currencies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      exchangeRateAtRefund: {
        type: DataTypes.DECIMAL(18, 6), // Snapshot de la tasa de la moneda al devolver
        allowNull: false,
      },
      paymentMethod: {
        type: DataTypes.ENUM(...Object.values(PaymentMethod)),
        allowNull: false,
      },
      recordedById: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      refundedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      tableName: "ticket_refunds",
      modelName: "TicketRefund",
    }
  );

  return TicketRefund;
}
