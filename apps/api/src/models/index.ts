import sequelize from "../config/datatabase";
import { AppModels } from "../interfaces/models";

//Import models
import { initialize as initUser } from "./user";
import { initialize as initCompany } from "./company";
import { initialize as initEmployee } from "./employee";
import { initialize as initGasStation } from "./gasStation";
import { initialize as initInvoice } from "./invoice";
import { initialize as initFuelType } from "./fuelType";
import { initialize as initSaleTypeConfig } from "./saleTypeConfig";
import { initialize as initCurrency } from "./currency";
import { initialize as initTankModel } from "./tankModel";
import { initialize as initTankCalibrationEntry } from "./tankCalibrationEntry";
import { initialize as initTank } from "./tank";
import { initialize as initDispatchReception } from "./dispatchReception";
import { initialize as initTankAssignment } from "./tankAssignment";
import { initialize as initPumpIsland } from "./pumpIsland";
import { initialize as initDispenser } from "./dispenser";
import { initialize as initDispenserNozzle } from "./dispenserNozzle";
import { initialize as initEmployeeShift } from "./employeeShift";
import { initialize as initDispenserReading } from "./dispenserReading";
import { initialize as initSalesTicket } from "./salesTicket";
import { initialize as initPayment } from "./payment";
import { initialize as initTankMeasurement } from "./tankMeasurement";

const models: AppModels = {
  Company: initCompany(sequelize),
  User: initUser(sequelize),
  Employee: initEmployee(sequelize),
  GasStation: initGasStation(sequelize),
  Invoice: initInvoice(sequelize),
  FuelType: initFuelType(sequelize),
  SaleTypeConfig: initSaleTypeConfig(sequelize),
  Currency: initCurrency(sequelize),
  TankModel: initTankModel(sequelize),
  TankCalibrationEntry: initTankCalibrationEntry(sequelize),
  Tank: initTank(sequelize),
  DispatchReception: initDispatchReception(sequelize),
  TankAssignment: initTankAssignment(sequelize),
  PumpIsland: initPumpIsland(sequelize),
  Dispenser: initDispenser(sequelize),
  DispenserNozzle: initDispenserNozzle(sequelize),
  EmployeeShift: initEmployeeShift(sequelize),
  DispenserReading: initDispenserReading(sequelize),
  SalesTicket: initSalesTicket(sequelize),
  Payment: initPayment(sequelize),
  TankMeasurement: initTankMeasurement(sequelize),
};

//Defined associations
// --- EL PASO CRÍTICO: Definir Asociaciones ---
// Llama al método `associate` en cada modelo, pasándoles todos los modelos.
// Esto permite que cada modelo establezca sus relaciones con los otros.
Object.values(models).forEach((model) => {
  if (model && typeof (model as any).associate === "function") {
    (model as any).associate(models);
  }
});

export { sequelize, models };
