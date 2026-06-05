# Dominio de negocio

## Jerarquía de entidades

```
Company (empresa)
  └── GasStation (estación de servicio)
        ├── User[] (usuarios asignados a la estación)
        ├── Employee[] (perfiles de empleado)
        │     └── EmployeeShift[] (turnos de trabajo)
        │           └── DispenserReading[] (lecturas de medidor)
        ├── PumpIsland[] (islas de surtidores)
        │     └── Dispenser[] (surtidores/dispensadores)
        │           └── DispenserNozzle[] (boquillas)
        ├── Tank[] (tanques de combustible)
        │     ├── TankModel (modelo/fabricante del tanque)
        │     │     └── TankCalibrationEntry[] (tabla altura→volumen)
        │     ├── TankAssignment[] (asignación de boquillas a tanques)
        │     ├── TankMeasurement[] (mediciones de nivel)
        │     └── DispatchReception[] (recepciones de combustible)
        ├── SaleTypeConfig[] (precios por combustible y tipo de venta)
        └── Invoice[] (facturas de proveedor)
```

---

## Entidades principales

### Company — Empresa
La empresa propietaria de una o varias estaciones de servicio. Adquiere la licencia de FuelTrack.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `name` | String | Nombre de la empresa |
| `address` | String? | Dirección opcional |
| `phone` | String? | Teléfono opcional |
| `logo` | String? | URL del logo |

---

### GasStation — Estación de servicio

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `name` | String | Nombre de la estación |
| `code` | String | Código único de la estación |
| `address` | String? | Dirección |
| `companyId` | UUID | FK → Company |

---

### User — Usuario del sistema

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `username` | String | Único en el sistema |
| `role` | Enum | `ADMIN` \| `MANAGER` \| `EMPLOYEE` |
| `userType` | Enum | `Administrator` \| `Supervisor` \| `Cashier` \| `FuelAttendant` \| `Administrative` |
| `companyId` | UUID | FK → Company |
| `gasStationId` | UUID? | FK → GasStation (si está asignado) |

---

### Employee — Perfil de empleado
Extiende a `User` con datos laborales. Un `User` puede no tener `Employee` (si es admin puro).

| Campo | Tipo | Notas |
|---|---|---|
| `userId` | UUID | FK → User (1:1) |
| `gasStationId` | UUID | FK → GasStation |
| `firstName` | String | Nombre |
| `lastName` | String | Apellido |
| `position` | String | Cargo/posición |

---

### EmployeeShift — Turno de trabajo

| Campo | Tipo | Notas |
|---|---|---|
| `employeeId` | UUID | FK → Employee |
| `gasStationId` | UUID | FK → GasStation |
| `employeeRole` | Enum | `CASHIER` \| `DISPATCHER` \| `SUPERVISOR` \| ... |
| `shiftStartTime` | DateTime | Inicio del turno |
| `shiftEndTime` | DateTime? | Cierre del turno (null = activo) |

---

### DispenserReading — Lectura de surtidor
Registro del medidor de cada boquilla al inicio y cierre de turno. Permite auditar litros reales despachados.

| Campo | Tipo | Notas |
|---|---|---|
| `dispenserNozzleId` | UUID | FK → DispenserNozzle |
| `employeeShiftId` | UUID | FK → EmployeeShift |
| `meterReading` | Decimal | Lectura del odómetro en litros |
| `readingType` | Enum | `INITIAL` \| `FINAL` |
| `readingTime` | DateTime | Momento de la lectura |

**Restricción:** una sola lectura INITIAL y una FINAL por boquilla por turno (índice único).

---

### SalesTicket — Ticket de venta

El documento central de la operación. Representa una solicitud de despacho de combustible.

| Campo | Tipo | Notas |
|---|---|---|
| `ticketNumber` | Int | Secuencial por estación |
| `cashierShiftId` | UUID | Turno del cajero que emite |
| `fuelTypeId` | UUID | Combustible solicitado |
| `requestedLiters` | Decimal | Litros solicitados al crear |
| `actualLitersDispatched` | Decimal? | Litros reales (se llena al despachar) |
| `assignedSaleTypeConfigId` | UUID | Precio/tipo de venta aplicado |
| `totalAmountExpected` | Decimal | Monto calculado (se recalcula al despachar si difiere) |
| `dispatcherEmployeeId` | UUID? | Bombero que despachó |
| `dispenserNozzleId` | UUID? | Boquilla usada |
| `status` | Enum | Ver flujo de estados abajo |

#### Flujo de estados del SalesTicket

```
PENDING_PAYMENT_DISPATCH ──── processSalesTicketDispatch ────► PAID_PENDING_DISPATCH
         │                                                              │
         │                                                   completeSalesTicketPayment
         │                                                              │
         └──────────── cancelSalesTicket ──────► CANCELED              ▼
                                                                   COMPLETED
```

**Nota importante:** `totalAmountExpected` se recalcula en `processSalesTicketDispatch` usando `actualLitersDispatched × salePricePerLiter`, para cubrir el caso de despacho parcial.

---

### Payment — Pago

| Campo | Tipo | Notas |
|---|---|---|
| `salesTicketId` | UUID | FK → SalesTicket |
| `paymentMethod` | Enum | `CASH` \| `DEBIT_CARD` \| `CREDIT_CARD` \| `MOBILE_PAYMENT` \| `BANK_TRANSFER` |
| `amount` | Decimal | Monto en la moneda del pago |
| `currencyId` | UUID | FK → Currency |
| `exchangeRateAtPayment` | Decimal | Snapshot de la tasa al momento del pago |
| `paymentTime` | DateTime | Momento del cobro |
| `transactionReference` | String? | Número de referencia opcional |

El ticket se marca como `COMPLETED` cuando la suma de pagos (convertida a moneda base usando `exchangeRateAtPayment`) ≥ `totalAmountExpected` (convertido a base con la tasa actual de su moneda).

---

### Tank — Tanque de combustible

| Campo | Tipo | Notas |
|---|---|---|
| `name` | String | Identificador del tanque |
| `fuelTypeId` | UUID | Combustible que contiene |
| `tankModelId` | UUID | Modelo/fabricante |
| `maxCapacityLiters` | Decimal | Capacidad máxima |
| `minOperatingVolumeLiters` | Decimal | Umbral de alerta de nivel bajo |
| `currentVolumeLiters` | Decimal? | Nivel actual (actualizado al medir) |
| `currentHeightCm` | Decimal? | Altura actual en cm |

---

### TankCalibrationEntry — Tabla de calibración

Tabla de referencia provista por el fabricante del modelo de tanque. Mapea altura (cm) → volumen (litros). Importable desde CSV.

| Campo | Tipo | Notas |
|---|---|---|
| `tankModelId` | UUID | FK → TankModel |
| `heightCm` | Decimal | Altura del líquido en cm |
| `volumeLiters` | Decimal | Volumen correspondiente en litros |

Cuando existe, el resolver de `createTankMeasurement` usa interpolación para calcular el volumen automáticamente. Si no existe, usa el valor manual ingresado por el operador.

---

### Invoice — Factura de proveedor

Registra la compra de combustible al proveedor (entrega del camión cisterna).

| Campo | Tipo | Notas |
|---|---|---|
| `invoiceNumber` | String | N° de factura del proveedor |
| `controlNumber` | String | N° de control fiscal |
| `sealNumber` | String | N° de precinto/sello |
| `truckPlate` | String | Placa del camión/tractocamión |
| `tankPlate` | String | Placa del tanque/cisterna |
| `driverName` | String | Nombre del chofer |
| `driverIdNumber` | String | Cédula/DNI del chofer |
| `fuelKind` | Enum | `GASOLINE_91` \| `GASOLINE_95` \| `DIESEL` \| `KEROSENE` |
| `liters` | Decimal | Litros facturados |
| `costPerLiter` | Decimal | Costo por litro |
| `totalAmount` | Decimal | Monto total |
| `status` | Enum | `PENDING` \| `CLOSED` |
| `dispatchDate` | DateTime | Fecha/hora de despacho del proveedor |
| `dischargeDate` | DateTime | Fecha/hora de descarga en la estación |

#### Flujo de estado de Invoice

```
PENDING ──── createDispatchReception (al registrar descarga en tanque) ──── PENDING/CLOSED
          (puede haber múltiples recepciones hasta cerrar la factura)
```

---

### Currency — Moneda

| Campo | Tipo | Notas |
|---|---|---|
| `name` | String | Nombre de la moneda (único) |
| `symbol` | String | Símbolo, ej. `$`, `Bs`, `€` (único) |
| `exchangeRate` | Decimal | Unidades de esta moneda por 1 unidad base |

**Convención:** `amount / exchangeRate = monto en base`. La moneda con `exchangeRate = 1` es la base.

---

### SaleTypeConfig — Configuración de precio de venta

| Campo | Tipo | Notas |
|---|---|---|
| `gasStationId` | UUID | FK → GasStation |
| `fuelTypeId` | UUID | FK → FuelType |
| `saleTypeName` | Enum | `REGULAR` \| `PREMIUM` \| `SUBSIDIZED` |
| `salePricePerLiter` | Decimal | Precio de venta al público |
| `percentage` | Decimal | % del combustible bajo esta modalidad |
| `currencyId` | UUID | Moneda en que se expresa el precio |

**Restricción:** combinación única `(gasStationId, fuelTypeId, saleTypeName)`.
