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
  INITIAL = "Initial",
  FINAL = "Final",
}

// Definimos un ENUM para el estado del SalesTicket
export enum SalesTicketStatus {
  PENDING_PAYMENT_DISPATCH = "Pending Payment and Dispatch", // Creado, esperando pago y despacho
  PAID_PENDING_DISPATCH = "Paid - Dispatch Pending", // Pago recibido, esperando despacho
  COMPLETED = "Completed", // Despacho y pago finalizados
  CANCELED = "Canceled", // Ticket cancelado
}

// Definimos un ENUM para los métodos de pago
export enum PaymentMethod {
  CASH = "Cash", // Efectivo
  DEBIT_CARD = "Debit Card", // Tarjeta de Débito
  CREDIT_CARD = "Credit Card", // Tarjeta de Crédito
  MOBILE_PAYMENT = "Mobile Payment", // Pago móvil (ej. Zelle, Pago Móvil en Venezuela)
  BANK_TRANSFER = "Bank Transfer", // Transferencia bancaria
  // Puedes añadir más métodos según sea necesario
}

// Definimos un ENUM para el motivo de la medición del tanque
export enum MeasurementReason {
  SHIFT_CLOSURE = "Shift Closure", // Cierre de turno del bombero
  DISPATCH_RECEPTION = "Dispatch Reception", // Recepción de despacho de combustible
  DAILY_CLOSING = "Daily Closing", // Cierre diario de inventarios
  AFTER_RECEPTION = "After Reception", // Después de una descarga de combustible
  INVENTORY_ADJUSTMENT = "Inventory Adjustment", // Ajuste de inventario, Auditoría o verificación manual
  OTHER = "Other", // Otro motivo no especificado
}

export type ParentType = any;
export type ArgsType = any;
