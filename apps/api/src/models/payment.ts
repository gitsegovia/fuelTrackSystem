import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models"; // Ruta ajustada
import { PaymentMethod } from "../utils/types";
import { SalesTicket } from "./salesTicket";
import { Currency } from "./currency";

export interface PaymentAttributes {
  id: string;
  salesTicketId: string; // FK a SalesTicket (el ticket al que se asocia este pago)
  paymentMethod: PaymentMethod; // Método de pago utilizado
  amount: number; // Monto pagado con este método
  paymentTime: Date; // Fecha y hora en que se registró el pago
  transactionReference?: string; // Referencia de la transacción (ej. número de aprobación de tarjeta, ID de transferencia)
  currencyId: string; // FK a Currency (la moneda en la que se realizó el pago)
  exchangeRateAtPayment: number; // Snapshot de la tasa de cambio de la moneda al momento del pago
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentCreationAttributes
  extends Optional<PaymentAttributes, "id" | "transactionReference" | "createdAt" | "updatedAt"> {}

export class Payment
  extends Model<PaymentAttributes, PaymentCreationAttributes>
  implements PaymentAttributes
{
  public id!: string;
  public salesTicketId!: string;
  public paymentMethod!: PaymentMethod;
  public amount!: number;
  public paymentTime!: Date;
  public transactionReference?: string;
  public currencyId!: string;
  public exchangeRateAtPayment!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getSalesTicket!: BelongsToGetAssociationMixin<SalesTicket>;
  public getCurrency!: BelongsToGetAssociationMixin<Currency>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly salesTicket?: SalesTicket;
  public readonly currency?: Currency;

  static associate(models: AppModels) {
    // Un pago pertenece a un SalesTicket
    this.belongsTo(models.SalesTicket, {
      foreignKey: "salesTicketId",
      as: "salesTicket",
    });
    // Un pago se realiza en una moneda específica
    this.belongsTo(models.Currency, {
      foreignKey: "currencyId",
      as: "currency",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<Payment> {
  Payment.init(
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
        onDelete: "CASCADE", // Si se elimina el ticket, sus pagos también
      },
      paymentMethod: {
        type: DataTypes.ENUM(...Object.values(PaymentMethod)), // Usa el ENUM definido
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(18, 2), // Monto del pago
        allowNull: false,
      },
      paymentTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      transactionReference: {
        type: DataTypes.STRING,
        allowNull: true, // Opcional, dependiendo del método de pago
      },
      currencyId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "currencies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      exchangeRateAtPayment: {
        type: DataTypes.DECIMAL(18, 6),
        allowNull: false,
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
      tableName: "payments", // Nombre de la tabla en plural
      modelName: "Payment",
      indexes: [
        {
          // Índice para búsquedas rápidas por ticket de venta
          fields: ["salesTicketId"],
        },
        {
          // Índice para búsquedas rápidas por método de pago
          fields: ["paymentMethod"],
        },
      ],
    }
  );
  return Payment;
}
