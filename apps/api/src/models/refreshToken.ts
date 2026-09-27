import { DataTypes, Model, Optional, Sequelize, ModelStatic } from "sequelize";
import type { AppModels } from "../interfaces/models";

export interface RefreshTokenAttributes {
  id: string;
  sessionId: string;
  tokenHash: string; // sha256 hex del token; el token en claro nunca se guarda
  replacedById: string | null; // no null = ya fue rotado; volver a usarlo es reuso
  rotatedAt: Date | null;
}

interface RefreshTokenCreationAttributes
  extends Optional<RefreshTokenAttributes, "id" | "replacedById" | "rotatedAt"> {}

export class RefreshToken
  extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes>
  implements RefreshTokenAttributes
{
  public id!: string;
  public sessionId!: string;
  public tokenHash!: string;
  public replacedById!: string | null;
  public rotatedAt!: Date | null;

  public readonly createdAt!: Date;

  static associate(models: AppModels) {
    this.belongsTo(models.AuthSession, { foreignKey: "sessionId", as: "session" });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<RefreshToken> {
  RefreshToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "auth_sessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false },
      replacedById: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "refresh_tokens", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      rotatedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      tableName: "refresh_tokens",
      modelName: "RefreshToken",
      updatedAt: false,
      // Índices con nombre: sync({alter:true}) duplica unique sin nombre en cada arranque.
      indexes: [
        { name: "refresh_tokens_token_hash_uq", unique: true, fields: ["tokenHash"] },
        { name: "refresh_tokens_session_id", fields: ["sessionId"] },
      ],
    }
  );
  return RefreshToken;
}
