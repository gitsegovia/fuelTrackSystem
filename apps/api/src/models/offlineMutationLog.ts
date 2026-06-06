import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
} from "sequelize";

export interface OfflineMutationLogAttributes {
  id: string;
  operationName: string;
  createdBy: string;          // username del empleado
  deviceFingerprint: string;  // UUID estable del navegador/dispositivo
  queuedAt: Date;             // momento en que se generó la mutation offline
  variables: Record<string, unknown>; // variables de la mutation (JSONB)
  userId: string | null;      // id del usuario autenticado vía JWT (null si token expiró)
}

interface OfflineMutationLogCreationAttributes
  extends Optional<OfflineMutationLogAttributes, "id"> {}

export class OfflineMutationLog
  extends Model<OfflineMutationLogAttributes, OfflineMutationLogCreationAttributes>
  implements OfflineMutationLogAttributes
{
  public id!: string;
  public operationName!: string;
  public createdBy!: string;
  public deviceFingerprint!: string;
  public queuedAt!: Date;
  public variables!: Record<string, unknown>;
  public userId!: string | null;

  public readonly createdAt!: Date; // momento en que llegó al servidor (sync)
}

export function initialize(sequelize: Sequelize): ModelStatic<OfflineMutationLog> {
  OfflineMutationLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      operationName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      createdBy: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      deviceFingerprint: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      queuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      variables: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "offline_mutation_logs",
      modelName: "OfflineMutationLog",
      updatedAt: false, // solo importa cuándo llegó (createdAt = executedAt)
    }
  );
  return OfflineMutationLog;
}
