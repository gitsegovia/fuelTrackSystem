import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { DispatchReception } from "./dispatchReception";

export interface TankAssignmentAttributes {
  id: string;
  dispatchReceptionId: string; // FK a DispatchReception (el despacho al que pertenece esta asignación)
  assignedLiters: number; // Litros asignados a este "lote" o sector de venta
  unitPrice: number; // Precio unitario del combustible de este lote (al momento de la recepción)
  assignedDate: Date; // Fecha de asignación (normalmente la misma que receptionDate de DispatchReception)
  // Podríamos añadir un campo para identificar el "lote" si es necesario,
  // por ejemplo, un número de lote o un identificador único para el combustible recibido.
  // Por ahora, la combinación de dispatchReceptionId y assignedDate podría ser suficiente.
}

interface TankAssignmentCreationAttributes
  extends Optional<TankAssignmentAttributes, "id"> {}

export class TankAssignment
  extends Model<TankAssignmentAttributes, TankAssignmentCreationAttributes>
  implements TankAssignmentAttributes
{
  public id!: string;
  public dispatchReceptionId!: string;
  public assignedLiters!: number;
  public unitPrice!: number;
  public assignedDate!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getDispatchReception!: BelongsToGetAssociationMixin<DispatchReception>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly dispatchReception?: DispatchReception;

  static associate(models: AppModels) {
    // Una asignación de tanque pertenece a una recepción de despacho
    this.belongsTo(models.DispatchReception, {
      foreignKey: "dispatchReceptionId",
      as: "dispatchReception",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<TankAssignment> {
  TankAssignment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      dispatchReceptionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "dispatch_receptions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE", // Si se elimina una recepción, sus asignaciones también
      },
      assignedLiters: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(10, 4), // Precio con 4 decimales para mayor precisión
        allowNull: false,
      },
      assignedDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "tank_assignments",
      modelName: "TankAssignment",
    }
  );
  return TankAssignment;
}
