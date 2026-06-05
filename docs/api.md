# API GraphQL

La API corre en `http://localhost:4000/graphql` (desarrollo local) o en el puerto configurado en producción.

## Autenticación

Todas las queries y mutations (excepto `login`) requieren un JWT en el header:

```http
Authorization: Bearer <token>
```

El token se obtiene con la mutation `login` y tiene una validez configurable (por defecto 7 días).

---

## Mutation de login

```graphql
mutation Login($username: String!, $password: String!) {
  login(username: $username, password: $password) {
    token
    user {
      id
      username
      role
      userType
      company { id name }
      assignedGasStation { id name }
    }
  }
}
```

---

## Queries principales por módulo

### Usuarios y auth

```graphql
query Me { me { id username role userType company { id name } assignedGasStation { id name } } }
query Users { users { id username role userType gasStationId createdAt } }
query User($id: UUID!) { user(id: $id) { id username role userType } }
```

### Estaciones

```graphql
query GasStations { gasStations { id name code address company { id name } } }
query GasStation($id: UUID!) { gasStation(id: $id) { id name code pumpIslands { ... } tanks { ... } } }
```

### Tickets de venta

```graphql
query SalesTicketsByGasStation($gasStationId: UUID!, $date: DateTime) {
  salesTicketsByGasStation(gasStationId: $gasStationId, date: $date) {
    id ticketNumber status requestedLiters actualLitersDispatched
    totalAmountExpected ticketIssueTime
    fuelType { id name }
    assignedSaleTypeConfig { saleTypeName currency { id symbol exchangeRate } }
    dispatcherEmployee { id firstName lastName }
    payments { id amount paymentMethod exchangeRateAtPayment currency { id symbol } }
  }
}

query SalesTicketsByCashierShift($cashierShiftId: UUID!) {
  salesTicketsByCashierShift(cashierShiftId: $cashierShiftId) { ... }
}
```

### Turnos

```graphql
query ActiveEmployeeShift($employeeId: UUID!) {
  activeEmployeeShift(employeeId: $employeeId) {
    id employeeRole shiftStartTime shiftEndTime gasStation { id name }
  }
}

query EmployeeShiftsByGasStation($gasStationId: UUID!, $startDate: DateTime, $endDate: DateTime) {
  employeeShiftsByGasStation(gasStationId: $gasStationId, startDate: $startDate, endDate: $endDate) { ... }
}
```

### Tanques

```graphql
query TanksByGasStation($gasStationId: UUID!) {
  tanksByGasStation(gasStationId: $gasStationId) {
    id name maxCapacityLiters minOperatingVolumeLiters currentVolumeLiters currentHeightCm
    fuelType { id name }
    tankModel { id name nominalCapacity }
    measurements { id manualLevelReadingCm volumeInLiters measurementTime employee { firstName lastName } }
  }
}
```

### Lecturas de surtidores

```graphql
query DispenserReadingsByShift($employeeShiftId: UUID!) {
  dispenserReadingsByShift(employeeShiftId: $employeeShiftId) {
    id meterReading readingType readingTime dispenserNozzle { id name }
  }
}
```

### Calibración de tanques

```graphql
query TankCalibrationEntriesByModel($tankModelId: UUID!) {
  tankCalibrationEntriesByModel(tankModelId: $tankModelId) {
    id heightCm volumeLiters
  }
}
```

---

## Mutations principales por módulo

### Auth

```graphql
mutation Login($username: String!, $password: String!) { login(...) { token user { ... } } }
```

### Tickets

```graphql
mutation CreateSalesTicket($input: CreateSalesTicketInput!) {
  createSalesTicket(input: $input) { id ticketNumber status totalAmountExpected }
}

# Registra el despacho y recalcula el monto si los litros difieren
mutation ProcessSalesTicketDispatch(
  $id: UUID!
  $dispatcherEmployeeId: UUID!
  $dispenserNozzleId: UUID!
  $actualLitersDispatched: Decimal!
) {
  processSalesTicketDispatch(...) { id status actualLitersDispatched totalAmountExpected }
}

mutation CancelSalesTicket($id: UUID!) { cancelSalesTicket(id: $id) { id status } }
mutation CompleteSalesTicketPayment($id: UUID!) { completeSalesTicketPayment(id: $id) { id status } }
```

### Pagos

```graphql
# Multi-pago en una sola transacción
mutation CreatePayments($salesTicketId: UUID!, $paymentTime: DateTime!, $payments: [PaymentLineInput!]!) {
  createPayments(salesTicketId: $salesTicketId, paymentTime: $paymentTime, payments: $payments) {
    id amount paymentMethod exchangeRateAtPayment currency { id symbol }
  }
}
```

### Turnos

```graphql
mutation CreateEmployeeShift($input: CreateEmployeeShiftInput!) {
  createEmployeeShift(input: $input) { id shiftStartTime employeeRole }
}

mutation EndEmployeeShift($id: UUID!, $shiftEndTime: DateTime!) {
  endEmployeeShift(id: $id, shiftEndTime: $shiftEndTime) { id shiftEndTime }
}
```

### Lecturas de surtidores

```graphql
mutation CreateDispenserReading($input: CreateDispenserReadingInput!) {
  createDispenserReading(input: $input) { id meterReading readingType readingTime }
}
```

### Mediciones de tanque

```graphql
# Si hay tabla de calibración, calcula volumeInLiters automáticamente.
# Si no, usa el valor ingresado manualmente.
mutation CreateTankMeasurement($input: CreateTankMeasurementInput!) {
  createTankMeasurement(input: $input) { id manualLevelReadingCm volumeInLiters measurementTime }
}
```

### Calibración de tanques (importación CSV)

```graphql
# Reemplaza TODAS las entradas existentes del modelo en una transacción
mutation BulkCreateTankCalibrationEntries($tankModelId: UUID!, $entries: [CalibrationRowInput!]!) {
  bulkCreateTankCalibrationEntries(tankModelId: $tankModelId, entries: $entries) {
    id heightCm volumeLiters
  }
}
```

### Facturas de proveedor

```graphql
mutation CreateInvoice($input: CreateInvoiceInput!) {
  createInvoice(input: $input) {
    id invoiceNumber status truckPlate tankPlate driverName driverIdNumber
  }
}

mutation CloseInvoice($id: UUID!) { closeInvoice(id: $id) { id status } }
```

---

## Tipos escalares personalizados

| Scalar | Descripción | Ejemplos de valores |
|---|---|---|
| `UUID` | UUID v4 | `"550e8400-e29b-41d4-a716-446655440000"` |
| `DateTime` | ISO 8601 con timezone | `"2026-06-04T10:30:00.000Z"` |
| `Decimal` | Número decimal de alta precisión | `"1500.50"` o `1500.50` |
| `Date` | Fecha sin hora | `"2026-06-04"` |

Los `Decimal` se retornan como strings desde la API (para evitar pérdida de precisión flotante) pero el scalar acepta tanto strings como números como entrada.

---

## Manejo de errores

La API retorna errores GraphQL estándar. Los mensajes están en inglés (internamente) y se propagan al cliente como `ApolloError`. El frontend muestra el `error.message` en los toasts de error.

Errores comunes:
- `"Sales ticket not found."` — el ticket no existe
- `"Cannot add payments to a ticket with status: CANCELED."` — ticket cancelado
- `"A reading of this type already exists for this nozzle and shift."` — lectura duplicada
- `"Final meter reading cannot be less than initial meter reading."` — validación de lecturas
