import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  BelongsToGetAssociationMixin,
  HasOneGetAssociationMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models";
import { UserRole, UserType } from "../utils/types";
import { Company } from "./company";
import { GasStation } from "./gasStation";
import { Employee } from "./employee";

export interface UserAttributes {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  userType: UserType;
  companyId: string;
  gasStationId?: string | null;
}

interface UserCreationAttributes
  extends Optional<UserAttributes, "id" | "gasStationId"> {}

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: string;
  public username!: string;
  public passwordHash!: string;
  public role!: UserRole;
  public userType!: UserType;
  public companyId!: string;
  public gasStationId?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getCompany!: BelongsToGetAssociationMixin<Company>; // Alias 'company'
  public getAssignedGasStation!: BelongsToGetAssociationMixin<GasStation>; // Alias 'assignedGasStation'
  public getEmployeeProfile!: HasOneGetAssociationMixin<Employee>; // Alias 'employeeProfile'

  public readonly company?: Company;
  public readonly assignedGasStation?: GasStation | null;
  public readonly employeeProfile?: Employee;

  static associate(models: AppModels) {
    this.belongsTo(models.Company, {
      foreignKey: "companyId",
      as: "company",
    });
    this.belongsTo(models.GasStation, {
      foreignKey: "gasStationId",
      as: "assignedGasStation",
    });
    this.hasOne(models.Employee, {
      foreignKey: "userId",
      as: "employeeProfile",
    });
  }
}

// Retorna ModelStatic<User>
export function initialize(sequelize: Sequelize): ModelStatic<User> {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM(...Object.values(UserRole)),
        defaultValue: UserRole.EMPLOYEE,
        allowNull: false,
      },
      userType: {
        type: DataTypes.ENUM(...Object.values(UserType)),
        defaultValue: UserType.ADMINISTRATIVE,
        allowNull: false,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "companies", key: "id" },
      },
      gasStationId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "gas_stations", key: "id" },
        onDelete: "SET NULL",
      },
    },
    {
      sequelize,
      tableName: "users",
      modelName: "User",
    }
  );
  return User;
}
