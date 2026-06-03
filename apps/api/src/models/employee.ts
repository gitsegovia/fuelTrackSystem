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
import { User } from "./user";
import { EmployeeShift } from "./employeeShift";
import { SalesTicket } from "./salesTicket";
import { TankMeasurement } from "./tankMeasurement";

export interface EmployeeAttributes {
  id: string;
  userId: string;
  gasStationId: string;
  firstName: string;
  lastName: string;
  position: string;
}

interface EmployeeCreationAttributes
  extends Optional<EmployeeAttributes, "id"> {}

export class Employee
  extends Model<EmployeeAttributes, EmployeeCreationAttributes>
  implements EmployeeAttributes
{
  public id!: string;
  public userId!: string;
  public gasStationId!: string;
  public firstName!: string;
  public lastName!: string;
  public position!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getGasStation!: BelongsToGetAssociationMixin<GasStation>; // Alias 'gasStation'
  public getUser!: BelongsToGetAssociationMixin<User>; // Alias 'user' (antes 'User')
  public getShifts!: HasManyGetAssociationsMixin<EmployeeShift>; // Alias 'shifts'
  public getDispatchedSalesTickets!: HasManyGetAssociationsMixin<SalesTicket>; // Alias 'dispatchedSalesTickets'
  public getTankMeasurementsPerformed!: HasManyGetAssociationsMixin<TankMeasurement>; // Alias 'tankMeasurementsPerformed'

  public readonly gasStation?: GasStation;
  public readonly user?: User;
  public readonly shifts?: EmployeeShift[];
  public readonly dispatchedSalesTickets?: SalesTicket[];
  public readonly tankMeasurementsPerformed?: TankMeasurement[];

  static associate(models: AppModels) {
    this.belongsTo(models.GasStation, {
      foreignKey: "gasStationId",
      as: "gasStation",
    });
    this.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
    this.hasMany(models.EmployeeShift, {
      foreignKey: "employeeId",
      as: "shifts",
    });
    // Un empleado puede ser el 'dispatcherEmployeeId' en muchos tickets de venta
    this.hasMany(models.SalesTicket, {
      foreignKey: "dispatcherEmployeeId",
      as: "dispatchedSalesTickets",
    });
    this.hasMany(models.TankMeasurement, {
      foreignKey: "employeeId",
      as: "tankMeasurementsPerformed",
    });
  }
}

// Retorna ModelStatic<Employee>
export function initialize(sequelize: Sequelize): ModelStatic<Employee> {
  Employee.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
      },
      gasStationId: {
        type: DataTypes.UUID,
        allowNull: false, // Un empleado debe estar asignado a una estación
        references: { model: "gas_stations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No eliminar la estación si tiene empleados asociados
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      position: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "employees",
      modelName: "Employee",
    }
  );
  return Employee;
}
