import {
  DataTypes, Model, Optional, Sequelize, ModelStatic,
  BelongsToGetAssociationMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { GasStation } from "./gasStation";
import { User } from "./user";

export type AuditCloseType = "MONTHLY" | "MANUAL";
export type AuditCloseStatus = "DRAFT" | "CLOSED";

export interface AuditPeriodCloseAttributes {
  id: string;
  gasStationId: string;
  closedById: string;
  periodStart: Date;
  periodEnd: Date;
  closeType: AuditCloseType;
  status: AuditCloseStatus;
  invoiceSnapshot: object | null;
  shiftSnapshot: object | null;
  dispatcherSnapshot: object | null;
  tankSnapshot: object | null;
  financialSnapshot: object | null;
  driverSnapshot: object | null;
  marginSnapshot: object | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AuditPeriodCloseCreationAttributes
  extends Optional<AuditPeriodCloseAttributes, "id" | "createdAt" | "updatedAt" | "invoiceSnapshot" | "shiftSnapshot" | "dispatcherSnapshot" | "tankSnapshot" | "financialSnapshot" | "driverSnapshot" | "marginSnapshot"> {}

export class AuditPeriodClose
  extends Model<AuditPeriodCloseAttributes, AuditPeriodCloseCreationAttributes>
  implements AuditPeriodCloseAttributes
{
  public id!: string;
  public gasStationId!: string;
  public closedById!: string;
  public periodStart!: Date;
  public periodEnd!: Date;
  public closeType!: AuditCloseType;
  public status!: AuditCloseStatus;
  public invoiceSnapshot!: object | null;
  public shiftSnapshot!: object | null;
  public dispatcherSnapshot!: object | null;
  public tankSnapshot!: object | null;
  public financialSnapshot!: object | null;
  public driverSnapshot!: object | null;
  public marginSnapshot!: object | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getGasStation!: BelongsToGetAssociationMixin<GasStation>;
  public getClosedBy!: BelongsToGetAssociationMixin<User>;

  static associate(models: AppModels) {
    this.belongsTo(models.GasStation, { foreignKey: "gasStationId", as: "gasStation" });
    this.belongsTo(models.User, { foreignKey: "closedById", as: "closedBy" });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<AuditPeriodClose> {
  AuditPeriodClose.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      gasStationId: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: "gas_stations", key: "id" },
        onUpdate: "CASCADE", onDelete: "RESTRICT",
      },
      closedById: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE", onDelete: "RESTRICT",
      },
      periodStart: { type: DataTypes.DATE, allowNull: false },
      periodEnd: { type: DataTypes.DATE, allowNull: false },
      closeType: {
        type: DataTypes.ENUM("MONTHLY", "MANUAL"),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("DRAFT", "CLOSED"),
        allowNull: false,
        defaultValue: "DRAFT",
      },
      invoiceSnapshot: { type: DataTypes.JSONB, allowNull: true },
      shiftSnapshot: { type: DataTypes.JSONB, allowNull: true },
      dispatcherSnapshot: { type: DataTypes.JSONB, allowNull: true },
      tankSnapshot: { type: DataTypes.JSONB, allowNull: true },
      financialSnapshot: { type: DataTypes.JSONB, allowNull: true },
      driverSnapshot: { type: DataTypes.JSONB, allowNull: true },
      marginSnapshot: { type: DataTypes.JSONB, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      tableName: "audit_period_closes",
      modelName: "AuditPeriodClose",
      indexes: [
        { fields: ["gasStationId"], name: "idx_audit_period_closes_station" },
        { fields: ["periodStart", "periodEnd"], name: "idx_audit_period_closes_period" },
        { fields: ["status"], name: "idx_audit_period_closes_status" },
      ],
    }
  );
  return AuditPeriodClose;
}
