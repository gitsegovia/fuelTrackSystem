import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
  ModelStatic,
  Op, // Para el uso del operador en beforeCreate
  BelongsToGetAssociationMixin, // Para relaciones belongsTo
  HasManyGetAssociationsMixin,
} from "sequelize";
import type { AppModels } from "../interfaces/models"; // Ruta ajustada
import { SalesTicketStatus } from "../utils/types";
import { GasStation } from "./gasStation";
import { EmployeeShift } from "./employeeShift";
import { Employee } from "./employee";
import { DispenserNozzle } from "./dispenserNozzle";
import { FuelType } from "./fuelType";
import { SaleTypeConfig } from "./saleTypeConfig";
import { Payment } from "./payment";

export interface SalesTicketAttributes {
  id: string;
  gasStationId: string; // FK a GasStation (para el secuencial diario)
  ticketNumber: number; // Número secuencial diario del ticket (reinicia cada día por estación)
  cashierShiftId: string; // FK a EmployeeShift (el turno del cajero que procesó el ticket)
  dispatcherEmployeeId?: string; // FK a Employee (el bombero que realizó el despacho) - Opcional al inicio, se llena al despachar
  dispenserNozzleId?: string; // FK a DispenserNozzle (la boquilla usada para el despacho) - Opcional al inicio, se llena al despachar
  fuelTypeId: string; // FK a FuelType (el tipo de combustible solicitado)
  requestedLiters: number; // Litros que se solicitaron despachar
  actualLitersDispatched?: number; // Litros realmente despachados (se llena después del despacho)
  assignedSaleTypeConfigId: string; // FK a SaleTypeConfig (la configuración de precio/tipo de venta aplicada)
  ticketIssueTime: Date; // Fecha y hora de emisión/creación del ticket
  totalAmountExpected: number; // Monto total que se espera cobrar por este ticket
  status: SalesTicketStatus; // Estado actual del ticket
  createdAt: Date;
  updatedAt: Date;
}

interface SalesTicketCreationAttributes
  extends Optional<
    SalesTicketAttributes,
    | "id"
    | "dispatcherEmployeeId"
    | "dispenserNozzleId"
    | "actualLitersDispatched"
    | "status"
  > {}

export class SalesTicket
  extends Model<SalesTicketAttributes, SalesTicketCreationAttributes>
  implements SalesTicketAttributes
{
  public id!: string;
  public gasStationId!: string;
  public ticketNumber!: number;
  public cashierShiftId!: string;
  public dispatcherEmployeeId?: string;
  public dispenserNozzleId?: string;
  public fuelTypeId!: string;
  public requestedLiters!: number;
  public actualLitersDispatched?: number;
  public assignedSaleTypeConfigId!: string;
  public ticketIssueTime!: Date;
  public totalAmountExpected!: number;
  public status!: SalesTicketStatus;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Mixins de Sequelize para las relaciones ---
  public getGasStation!: BelongsToGetAssociationMixin<GasStation>;
  public getCashierShift!: BelongsToGetAssociationMixin<EmployeeShift>;
  public getDispatcherEmployee!: BelongsToGetAssociationMixin<Employee>;
  public getDispenserNozzle!: BelongsToGetAssociationMixin<DispenserNozzle>;
  public getFuelType!: BelongsToGetAssociationMixin<FuelType>;
  public getAssignedSaleTypeConfig!: BelongsToGetAssociationMixin<SaleTypeConfig>;
  public getPayments!: HasManyGetAssociationsMixin<Payment>;

  // --- Propiedades de solo lectura para las relaciones (si se usan con `include`) ---
  public readonly gasStation?: GasStation;
  public readonly cashierShift?: EmployeeShift;
  public readonly dispatcherEmployee?: Employee;
  public readonly dispenserNozzle?: DispenserNozzle;
  public readonly fuelType?: FuelType;
  public readonly assignedSaleTypeConfig?: SaleTypeConfig;
  public readonly payments?: Payment[];

  static associate(models: AppModels) {
    // Un SalesTicket pertenece a una estación de servicio
    this.belongsTo(models.GasStation, {
      foreignKey: "gasStationId",
      as: "gasStation",
    });
    // Un SalesTicket es procesado por un cajero en un turno específico
    this.belongsTo(models.EmployeeShift, {
      foreignKey: "cashierShiftId",
      as: "cashierShift",
      // Agrega un scope si deseas asegurarte de que el EmployeeShift es de un cajero,
      // aunque esto es mejor validarlo a nivel de lógica de negocio.
      // scope: { employeeRole: EmployeeRole.CASHIER }
    });
    // Un SalesTicket es despachado por un bombero
    this.belongsTo(models.Employee, {
      foreignKey: "dispatcherEmployeeId",
      as: "dispatcherEmployee",
    });
    // Un SalesTicket se despacha a través de una boquilla de surtidor
    this.belongsTo(models.DispenserNozzle, {
      foreignKey: "dispenserNozzleId",
      as: "dispenserNozzle",
    });
    // Un SalesTicket es de un tipo de combustible
    this.belongsTo(models.FuelType, {
      foreignKey: "fuelTypeId",
      as: "fuelType",
    });
    // Un SalesTicket utiliza una configuración de tipo de venta (precio)
    this.belongsTo(models.SaleTypeConfig, {
      foreignKey: "assignedSaleTypeConfigId",
      as: "assignedSaleTypeConfig",
    });
    // Un SalesTicket puede tener uno o muchos pagos asociados
    this.hasMany(models.Payment, {
      foreignKey: "salesTicketId",
      as: "payments",
    });
  }
}

export function initialize(sequelize: Sequelize): ModelStatic<SalesTicket> {
  SalesTicket.init(
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
        onDelete: "RESTRICT", // No eliminar estación si tiene tickets
      },
      ticketNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      cashierShiftId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "employee_shifts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT", // No eliminar turno si tiene tickets
      },
      dispatcherEmployeeId: {
        type: DataTypes.UUID,
        allowNull: true, // Puede ser nulo al inicio
        references: { model: "employees", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      dispenserNozzleId: {
        type: DataTypes.UUID,
        allowNull: true, // Puede ser nulo al inicio
        references: { model: "dispenser_nozzles", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      fuelTypeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "fuel_types", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      requestedLiters: {
        type: DataTypes.DECIMAL(10, 2), // Litros solicitados, ej. 50.00
        allowNull: false,
      },
      actualLitersDispatched: {
        type: DataTypes.DECIMAL(10, 2), // Litros reales despachados
        allowNull: true, // Nulo hasta que se complete el despacho
      },
      assignedSaleTypeConfigId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "sale_type_configs", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      ticketIssueTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      totalAmountExpected: {
        type: DataTypes.DECIMAL(18, 2), // Monto total calculado esperado
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(SalesTicketStatus)),
        allowNull: false,
        defaultValue: SalesTicketStatus.PENDING_PAYMENT_DISPATCH,
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
      tableName: "sales_tickets", // Nombre de la tabla en plural
      modelName: "SalesTicket",
    }
  );

  SalesTicket.beforeCreate(async (salesTicket, options) => {
    // Extrae la fecha sin la hora para la unicidad diaria
    const ticketDate = new Date(salesTicket.ticketIssueTime)
      .toISOString()
      .split("T")[0];

    // Consulta el número de ticket más alto para esa estación y esa fecha
    const latestTicket = await SalesTicket.findOne({
      attributes: ["ticketNumber"],
      where: {
        gasStationId: salesTicket.gasStationId,
        // Usamos una expresión de fecha para comparar solo la fecha
        ticketIssueTime: {
          [Op.gte]: `${ticketDate} 00:00:00.000Z`, // Inicio del día
          [Op.lt]: `${ticketDate} 23:59:59.999Z`, // Fin del día
        },
      },
      order: [["ticketNumber", "DESC"]],
      transaction: options.transaction, // Importante para que el hook sea parte de la misma transacción
    });

    // Asigna el siguiente número de ticket
    salesTicket.ticketNumber = latestTicket ? latestTicket.ticketNumber + 1 : 1;
  });

  return SalesTicket;
}
