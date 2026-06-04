export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  EMPLOYEE = "EMPLOYEE",
}

export enum UserType {
  ADMINISTRATOR = "Administrator",
  SUPERVISOR = "Supervisor",
  CASHIER = "Cashier",
  FUEL_ATTENDANT = "FuelAttendant",
  ADMINISTRATIVE = "Administrative",
}

export enum FuelType {
  GASOLINE_91 = "GASOLINE_91",
  GASOLINE_95 = "GASOLINE_95",
  DIESEL = "DIESEL",
  KEROSENE = "KEROSENE",
}

// ENUM para los diferentes tipos de venta si son fijos
export enum SaleTypeName {
  REGULAR = "REGULAR",
  PREMIUM = "PREMIUM",
  SUBSIDIZED = "SUBSIDIZED",
}

export enum EmployeeRole {
  CASHIER = "CASHIER",
  DISPATCHER = "DISPATCHER",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  SUPERVISOR = "SUPERVISOR",
  ACCOUNTANT = "ACCOUNTANT",
}

export enum ReadingType {
  INITIAL = "INITIAL",
  FINAL = "FINAL",
}

export enum SalesTicketStatus {
  PENDING_PAYMENT_DISPATCH = "PENDING_PAYMENT_DISPATCH",
  PAID_PENDING_DISPATCH = "PAID_PENDING_DISPATCH",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED",
}

export enum PaymentMethod {
  CASH = "CASH",
  DEBIT_CARD = "DEBIT_CARD",
  CREDIT_CARD = "CREDIT_CARD",
  MOBILE_PAYMENT = "MOBILE_PAYMENT",
  BANK_TRANSFER = "BANK_TRANSFER",
}

export enum MeasurementReason {
  SHIFT_CLOSURE = "SHIFT_CLOSURE",
  DISPATCH_RECEPTION = "DISPATCH_RECEPTION",
  DAILY_CLOSING = "DAILY_CLOSING",
  AFTER_RECEPTION = "AFTER_RECEPTION",
  INVENTORY_ADJUSTMENT = "INVENTORY_ADJUSTMENT",
  OTHER = "OTHER",
}

export type ParentType = any;
export type ArgsType = any;
