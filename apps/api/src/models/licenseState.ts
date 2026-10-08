import { DataTypes, Model, Optional, Sequelize, ModelStatic } from "sequelize";

// Fila única (SINGLETON_ID en src/license/service.ts) con la última licencia CCI1 verificada.
export interface LicenseStateAttributes {
  id: string;
  licenseToken: string | null;
  payload: Record<string, unknown> | null;
  serverStatus: string | null;
  graceEndsAt: Date | null;
  activeStations: number | null;
  // T-053: la hora más alta vista (serverTime, issuedAt o el reloj local), para que atrasar el
  // reloj del servidor y cortar la red no rejuvenezca la licencia. Nunca retrocede.
  maxSeenAt: Date | null;
  lastValidatedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LicenseStateCreationAttributes
  extends Optional<
    LicenseStateAttributes,
    | "licenseToken"
    | "payload"
    | "serverStatus"
    | "graceEndsAt"
    | "activeStations"
    | "maxSeenAt"
    | "lastValidatedAt"
    | "lastError"
    | "createdAt"
    | "updatedAt"
  > {}

export class LicenseState
  extends Model<LicenseStateAttributes, LicenseStateCreationAttributes>
  implements LicenseStateAttributes
{
  public id!: string;
  public licenseToken!: string | null;
  public payload!: Record<string, unknown> | null;
  public serverStatus!: string | null;
  public graceEndsAt!: Date | null;
  public activeStations!: number | null;
  public maxSeenAt!: Date | null;
  public lastValidatedAt!: Date | null;
  public lastError!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export function initialize(sequelize: Sequelize): ModelStatic<LicenseState> {
  LicenseState.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      licenseToken: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      payload: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      serverStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      graceEndsAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      activeStations: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      maxSeenAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastValidatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastError: {
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
      tableName: "license_states",
      modelName: "LicenseState",
    }
  );

  return LicenseState;
}
