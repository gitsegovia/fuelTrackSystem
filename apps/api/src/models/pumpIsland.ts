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
import { GasStation } from "./gasStation";
import { Dispenser } from "./dispenser";

export interface PumpIslandAttributes {
  id: string;
  gasStationId: string; // FK a GasStation
  name: string; // Nombre del andén (ej. "Andén 1", "Isla Central")
  description?: string; // Descripción adicional del andén
}

interface PumpIslandCreationAttributes
  extends Optional<PumpIslandAttributes, "id" | "description"> {}

export class PumpIsland
  extends Model<PumpIslandAttributes, PumpIslandCreationAttributes>
  implements PumpIslandAttributes
{
  public id!: string;
  public gasStationId!: string;
  public name!: string;
  public description?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getGasStation!: BelongsToGetAssociationMixin<GasStation>;
  public getDispensers!: HasManyGetAssociationsMixin<Dispenser>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly gasStation?: GasStation;
  public readonly dispensers?: Dispenser[];

  static associate(models: AppModels) {
    // Un andén pertenece a una estación de servicio
    this.belongsTo(models.GasStation, {
      foreignKey: "gasStationId",
      as: "gasStation",
    });
    // Un andén puede tener muchos surtidores
    this.hasMany(models.Dispenser, {
      foreignKey: "pumpIslandId",
      as: "dispensers",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<PumpIsland> {
  PumpIsland.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      gasStationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "gas_stations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE", // Si se elimina una estación, sus andenes también
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "pump_islands", // Nombre de la tabla en plural
      modelName: "PumpIsland",
      indexes: [
        {
          unique: true,
          fields: ["gasStationId", "name"], // Un nombre de andén debe ser único por estación
          name: "unique_pump_island_name_per_station",
        },
      ],
    }
  );
  return PumpIsland;
}
