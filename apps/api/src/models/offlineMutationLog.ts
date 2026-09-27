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
  clientMutationId: string | null; // header x-offline-mutation-id (id del item de la cola)
  status: OfflineMutationStatus | null;
  responseData: Record<string, unknown> | null; // resultado del resolver, para responder reintentos
}

export type OfflineMutationStatus = "PENDING" | "APPLIED" | "FAILED";

interface OfflineMutationLogCreationAttributes
  extends Optional<
    OfflineMutationLogAttributes,
    "id" | "clientMutationId" | "status" | "responseData"
  > {}

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
  public clientMutationId!: string | null;
  public status!: OfflineMutationStatus | null;
  public responseData!: Record<string, unknown> | null;

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
      clientMutationId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      responseData: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "offline_mutation_logs",
      modelName: "OfflineMutationLog",
      updatedAt: false, // solo importa cuándo llegó (createdAt = executedAt)
      // Índice con nombre (no `unique: true` en la columna): sync({alter:true}) duplica
      // constraints unique sin nombre en cada arranque.
      indexes: [
        {
          name: "offline_mutation_logs_client_mutation_id_uq",
          unique: true,
          fields: ["clientMutationId"],
        },
      ],
    }
  );
  return OfflineMutationLog;
}
