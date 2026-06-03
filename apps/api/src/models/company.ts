import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  HasManyGetAssociationsMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { GasStation } from "./gasStation";
import { User } from "./user";

export interface CompanyAttributes {
  id: string;
  name: string;
  address: string;
  phone: string;
  logo: string;
}

interface CompanyCreationAttributes extends Optional<CompanyAttributes, "id"> {}

export class Company
  extends Model<CompanyAttributes, CompanyCreationAttributes>
  implements CompanyAttributes
{
  public id!: string;
  public name!: string;
  public address!: string;
  public phone!: string;
  public logo!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // DECLARACIÓN SIMPLIFICADA DEL MIXIN:
  public getGasStations!: HasManyGetAssociationsMixin<GasStation>;
  public getUsers!: HasManyGetAssociationsMixin<User>;

  // Opcional: Si quieres tipar la propiedad directamente (cuando usas 'include')
  public readonly gasStations?: GasStation[];
  public readonly users?: User[];

  static associate(models: AppModels) {
    this.hasMany(models.GasStation, {
      foreignKey: "companyId",
      as: "gasStations",
    });
    this.hasMany(models.User, {
      foreignKey: "companyId",
      as: "users",
    });
  }
}

// Retorna ModelStatic<Company>
export function initialize(sequelize: Sequelize): ModelStatic<Company> {
  Company.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      logo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "companies",
      modelName: "Company",
    }
  );
  return Company;
}
