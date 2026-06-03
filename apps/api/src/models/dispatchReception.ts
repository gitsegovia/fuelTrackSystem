import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
  HasManyGetAssociationsMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { Invoice } from "./invoice";
import { Tank } from "./tank";
import { TankAssignment } from "./tankAssignment";

export interface DispatchReceptionAttributes {
  id: string;
  invoiceId: string; // FK a Invoice (la factura de este despacho)
  tankId: string; // FK a Tank (el tanque donde se recibió el combustible)
  receivedLiters: number; // Litros recibidos en este despacho en este tanque
  receptionDate: Date; // Fecha y hora de la recepción efectiva en el tanque
  initialTankReadingCm: number; // Lectura inicial del tanque en cm antes de la descarga
  finalTankReadingCm: number; // Lectura final del tanque en cm después de la descarga
  initialTankVolumeLiters: number; // Volumen inicial del tanque en litros (calculado de initialTankReadingCm)
  finalTankVolumeLiters: number; // Volumen final del tanque en litros (calculado de finalTankReadingCm)
}

interface DispatchReceptionCreationAttributes
  extends Optional<DispatchReceptionAttributes, "id"> {}

export class DispatchReception
  extends Model<
    DispatchReceptionAttributes,
    DispatchReceptionCreationAttributes
  >
  implements DispatchReceptionAttributes
{
  public id!: string;
  public invoiceId!: string;
  public tankId!: string;
  public receivedLiters!: number;
  public receptionDate!: Date;
  public initialTankReadingCm!: number;
  public finalTankReadingCm!: number;
  public initialTankVolumeLiters!: number;
  public finalTankVolumeLiters!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getInvoice!: BelongsToGetAssociationMixin<Invoice>;
  public getTank!: BelongsToGetAssociationMixin<Tank>;
  public getTankAssignments!: HasManyGetAssociationsMixin<TankAssignment>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly invoice?: Invoice;
  public readonly tank?: Tank;
  public readonly tankAssignments?: TankAssignment[];

  static associate(models: AppModels) {
    // Una recepción de despacho pertenece a una factura
    this.belongsTo(models.Invoice, {
      foreignKey: "invoiceId",
      as: "invoice",
    });
    // Una recepción de despacho ocurre en un tanque específico
    this.belongsTo(models.Tank, {
      foreignKey: "tankId",
      as: "tank",
    });
    // Una recepción de despacho genera muchas asignaciones de tanque (TankAssignment)
    this.hasMany(models.TankAssignment, {
      foreignKey: "dispatchReceptionId",
      as: "tankAssignments",
    });
  }
}

export function initialize(
  sequelize: Sequelize
): ModelStatic<DispatchReception> {
  DispatchReception.init(
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
        onDelete: "RESTRICT", // No se elimina una factura si tiene recepciones de despacho asociadas
      },
      tankId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "tanks", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No se elimina un tanque si tiene recepciones de despacho asociadas
      },
      receivedLiters: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      receptionDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      initialTankReadingCm: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      finalTankReadingCm: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      initialTankVolumeLiters: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      finalTankVolumeLiters: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "dispatch_receptions",
      modelName: "DispatchReception",
      indexes: [
        {
          unique: true,
          fields: ["invoiceId", "tankId"], // Una factura debería ser recibida en un tanque específico una sola vez
          name: "unique_dispatch_reception_per_invoice_tank",
        },
      ],
    }
  );
  return DispatchReception;
}
