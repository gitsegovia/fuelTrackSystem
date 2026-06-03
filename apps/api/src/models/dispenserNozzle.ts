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
import { Dispenser } from "./dispenser";
import { DispenserReading } from "./dispenserReading";
import { SalesTicket } from "./salesTicket";

export interface DispenserNozzleAttributes {
  id: string;
  dispenserId: string; // FK a Dispenser (el surtidor al que pertenece)
  name: string; // Nombre de la boquilla/cara (ej. "Cara 1", "Manguera Derecha")
  initialMeterReading: number; // Lectura inicial del odómetro de la boquilla (cuando se configura por primera vez)
  currentMeterReading: number; // Lectura actual del odómetro de la boquilla
  isOperational: boolean; // Indica si la boquilla está en funcionamiento
  createdAt: Date;
  updatedAt: Date;
}

interface DispenserNozzleCreationAttributes
  extends Optional<DispenserNozzleAttributes, "id"> {}

export class DispenserNozzle
  extends Model<DispenserNozzleAttributes, DispenserNozzleCreationAttributes>
  implements DispenserNozzleAttributes
{
  public id!: string;
  public dispenserId!: string;
  public name!: string;
  public initialMeterReading!: number;
  public currentMeterReading!: number;
  public isOperational!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getDispenser!: BelongsToGetAssociationMixin<Dispenser>;
  public getDispenserReadings!: HasManyGetAssociationsMixin<DispenserReading>;
  public getSalesTickets!: HasManyGetAssociationsMixin<SalesTicket>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly dispenser?: Dispenser;
  public readonly dispenserReadings?: DispenserReading[];
  public readonly salesTickets?: SalesTicket[];

  static associate(models: AppModels) {
    // Una boquilla pertenece a un surtidor
    this.belongsTo(models.Dispenser, {
      foreignKey: "dispenserId",
      as: "dispenser",
    });
    // Una boquilla puede tener muchas lecturas de turno asociadas
    this.hasMany(models.DispenserReading, {
      foreignKey: "dispenserNozzleId",
      as: "dispenserReadings",
    });
    // Una boquilla puede estar referenciada en muchos tickets de venta (despachos)
    this.hasMany(models.SalesTicket, {
      foreignKey: "dispenserNozzleId",
      as: "salesTickets",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<DispenserNozzle> {
  DispenserNozzle.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      dispenserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "dispensers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE", // Si se elimina un surtidor, sus boquillas también
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      initialMeterReading: {
        type: DataTypes.DECIMAL(18, 2), // Suficiente precisión para odómetros de surtidores
        allowNull: false,
      },
      currentMeterReading: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      isOperational: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      tableName: "dispenser_nozzles", // Nombre de la tabla en plural
      modelName: "DispenserNozzle",
      indexes: [
        {
          unique: true,
          fields: ["dispenserId", "name"], // Una boquilla/cara debe ser única por surtidor
          name: "unique_nozzle_name_per_dispenser",
        },
      ],
    }
  );
  return DispenserNozzle;
}
