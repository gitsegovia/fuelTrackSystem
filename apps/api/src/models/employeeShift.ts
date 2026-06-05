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
import { EmployeeRole } from "../utils/types";
import { Employee } from "./employee";
import { GasStation } from "./gasStation";
import { DispenserReading } from "./dispenserReading";
import { SalesTicket } from "./salesTicket";
import type { TankMeasurement } from "./tankMeasurement";

export interface EmployeeShiftAttributes {
  id: string;
  employeeId: string; // FK a Employee (el empleado que trabaja en este turno)
  gasStationId: string; // FK a GasStation (la estación donde se realiza el turno)
  shiftStartTime: Date; // Hora de inicio del turno
  shiftEndTime?: Date | null; // Hora de fin del turno (opcional, se llena al cerrar el turno)
  employeeRole: EmployeeRole; // Rol del empleado durante este turno (ej. 'Bombero', 'Cajero')
  createdAt: Date;
  updatedAt: Date;
}

interface EmployeeShiftCreationAttributes
  extends Optional<EmployeeShiftAttributes, "id" | "shiftEndTime"> {}

export class EmployeeShift
  extends Model<EmployeeShiftAttributes, EmployeeShiftCreationAttributes>
  implements EmployeeShiftAttributes
{
  public id!: string;
  public employeeId!: string;
  public gasStationId!: string;
  public shiftStartTime!: Date;
  public shiftEndTime?: Date;
  public employeeRole!: EmployeeRole;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getEmployee!: BelongsToGetAssociationMixin<Employee>;
  public getGasStation!: BelongsToGetAssociationMixin<GasStation>;
  public getDispenserReadings!: HasManyGetAssociationsMixin<DispenserReading>;
  public getSalesTicketsProcessed!: HasManyGetAssociationsMixin<SalesTicket>;
  public getSalesTicketsDispatched!: HasManyGetAssociationsMixin<SalesTicket>;
  public getTankMeasurements!: HasManyGetAssociationsMixin<TankMeasurement>;

  public readonly employee?: Employee;
  public readonly gasStation?: GasStation;
  public readonly dispenserReadings?: DispenserReading[];
  public readonly salesTicketsProcessed?: SalesTicket[];
  public readonly salesTicketsDispatched?: SalesTicket[];
  public readonly tankMeasurements?: TankMeasurement[];

  static associate(models: AppModels) {
    // Un turno pertenece a un empleado
    this.belongsTo(models.Employee, {
      foreignKey: "employeeId",
      as: "employee",
    });
    // Un turno se realiza en una estación de servicio
    this.belongsTo(models.GasStation, {
      foreignKey: "gasStationId",
      as: "gasStation",
    });
    // Un turno de bombero puede tener muchas lecturas de surtidor
    this.hasMany(models.DispenserReading, {
      foreignKey: "employeeShiftId",
      as: "dispenserReadings",
    });
    this.hasMany(models.SalesTicket, {
      foreignKey: "cashierShiftId",
      as: "salesTicketsProcessed",
    });
    this.hasMany(models.SalesTicket, {
      foreignKey: "dispatcherShiftId",
      as: "salesTicketsDispatched",
    });
    this.hasMany(models.TankMeasurement, {
      foreignKey: "employeeShiftId",
      as: "tankMeasurements",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<EmployeeShift> {
  EmployeeShift.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      employeeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "employees", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No eliminar empleado si tiene turnos registrados
      },
      gasStationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "gas_stations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE", // Si se elimina la estación, sus turnos también
      },
      shiftStartTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      shiftEndTime: {
        type: DataTypes.DATE,
        allowNull: true, // Puede ser nulo hasta que el turno finalice
      },
      employeeRole: {
        type: DataTypes.ENUM(...Object.values(EmployeeRole)), // Usa el ENUM definido
        allowNull: false,
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
      tableName: "employee_shifts", // Nombre de la tabla en plural
      modelName: "EmployeeShift",
      indexes: [
        {
          // Índice para búsquedas rápidas por empleado y estación
          fields: ["employeeId", "gasStationId", "shiftStartTime"],
        },
        {
          // Índice para encontrar turnos activos fácilmente
          fields: ["employeeId", "shiftEndTime"],
          where: {
            shiftEndTime: null, // Para encontrar turnos que aún no han terminado
          },
        },
      ],
    }
  );
  return EmployeeShift;
}
