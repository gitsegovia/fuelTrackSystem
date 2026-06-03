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
import { Company } from "./company";
import { User } from "./user";
import { Invoice } from "./invoice";
import { SaleTypeConfig } from "./saleTypeConfig";
import { Tank } from "./tank";
import { PumpIsland } from "./pumpIsland";
import { Dispenser } from "./dispenser";
import { Employee } from "./employee";
import { EmployeeShift } from "./employeeShift";
import { SalesTicket } from "./salesTicket";

export interface GasStationAttributes {
  id: string;
  name: string;
  code: string;
  address: string;
  companyId: string;
}

interface GasStationCreationAttributes
  extends Optional<GasStationAttributes, "id"> {}

export class GasStation
  extends Model<GasStationAttributes, GasStationCreationAttributes>
  implements GasStationAttributes
{
  public id!: string;
  public name!: string;
  public code!: string;
  public address!: string;
  public companyId!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Mixins (nombres basados en los alias PascalCase)
  public getCompany!: BelongsToGetAssociationMixin<Company>; // Alias 'Company'
  public getAssignedUsers!: HasManyGetAssociationsMixin<User>; // Alias 'AssignedUsers'
  public getReceivedInvoices!: HasManyGetAssociationsMixin<Invoice>; // Alias 'ReceivedInvoices'
  public getSaleTypeConfigs!: HasManyGetAssociationsMixin<SaleTypeConfig>; // Alias 'SaleTypeConfigs'
  public getTanks!: HasManyGetAssociationsMixin<Tank>; // Alias 'Tanks'
  public getPumpIslands!: HasManyGetAssociationsMixin<PumpIsland>; // Alias 'PumpIslands' (antes 'pumpIslands')
  public getDispensers!: HasManyGetAssociationsMixin<Dispenser>; // Alias 'Dispensers' (antes 'dispensers')
  public getEmployeeShifts!: HasManyGetAssociationsMixin<EmployeeShift>; // Alias 'EmployeeShifts' (antes 'employeeShifts')
  public getSalesTickets!: HasManyGetAssociationsMixin<SalesTicket>; // Alias 'SalesTickets' (antes 'salesTickets')
  public getEmployees!: HasManyGetAssociationsMixin<Employee>;

  // Propiedades de solo lectura (nombres basados en los alias camelCase)
  public readonly company?: Company; // Alias 'company'
  public readonly assignedUsers?: User[];
  public readonly receivedInvoices?: Invoice[];
  public readonly saleTypeConfigs?: SaleTypeConfig[];
  public readonly tanks?: Tank[];
  public readonly pumpIslands?: PumpIsland[];
  public readonly dispensers?: Dispenser[];
  public readonly employeeShifts?: EmployeeShift[];
  public readonly salesTickets?: SalesTicket[];
  public readonly employees?: Employee[];

  static associate(models: AppModels) {
    this.belongsTo(models.Company, {
      foreignKey: "companyId",
      as: "company",
    });
    this.hasMany(models.User, {
      foreignKey: "gasStationId",
      as: "assignedUsers",
    });
    this.hasMany(models.Invoice, {
      foreignKey: "gasStationId",
      as: "receivedInvoices",
    });
    this.hasMany(models.SaleTypeConfig, {
      foreignKey: "gasStationId",
      as: "saleTypeConfigs",
    });
    this.hasMany(models.Tank, {
      foreignKey: "gasStationId",
      as: "tanks",
    });
    this.hasMany(models.PumpIsland, {
      foreignKey: "gasStationId",
      as: "pumpIslands",
    });
    this.hasMany(models.Dispenser, {
      foreignKey: "gasStationId",
      as: "dispensers",
    });
    this.hasMany(models.EmployeeShift, {
      foreignKey: "gasStationId",
      as: "employeeShifts",
    });
    this.hasMany(models.SalesTicket, {
      foreignKey: "gasStationId",
      as: "salesTickets",
    });
    this.hasMany(models.Employee, {
      foreignKey: "gasStationId",
      as: "employees",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<GasStation> {
  GasStation.init(
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
      code: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "companies",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
    },
    {
      sequelize,
      tableName: "gas_stations",
      modelName: "GasStation",
    }
  );
  return GasStation;
}
