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
  GASOLINE_91 = "Gasoline91", // Gasolina 91 Octanos
  GASOLINE_95 = "Gasoline95", // Gasolina 95 Octanos
  DIESEL = "Diesel", // Diésel
  KEROSENE = "Kerosene", // Kerosene (si aplica)
}

// ENUM para los diferentes tipos de venta si son fijos
export enum SaleTypeName {
  REGULAR = "REGULAR",
  PREMIUM = "PREMIUM",
  SUBSIDIZED = "SUBSIDIZED",
}

// Definimos un ENUM para los roles de empleado en el turno
export enum EmployeeRole {
  ADMINISTRATOR = "Administrator", // Bombero (quien despacha combustible)
  CASHIER = "Cashier", // Cajero (quien procesa los pagos)
  FUEL_ATTENDANT = "FuelAttendant", // Opcional, si hay turnos de administración
  // Puedes añadir más roles según sea necesario
  DISPATCHER = "Dispatcher",
  MANAGER = "Manager",
  SUPERVISOR = "Supervisor",
  ACCOUNTANT = "Accountant", //Contador/a
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
