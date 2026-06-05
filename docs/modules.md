# Módulos del frontend

## Panel de Administración (`/admin`)

Acceso: usuarios con `role = ADMIN` o `MANAGER`. Login en `/admin-login`.

### Dashboard
**Ruta:** `/admin/dashboard`

Vista gerencial con:
- Contadores del sistema (empresas, estaciones, usuarios, combustibles)
- Selector de estación + rango de fechas (7 / 30 / 90 días)
- KPIs del período: tickets completados, litros despachados, recaudación base — con % de tendencia vs período anterior
- BarChart: litros despachados por día, apilado por tipo de combustible
- Donut: distribución de litros por combustible
- LineChart: tickets por día

---

### Empresas
**Rutas:** `/admin/companies` · `/admin/companies/new` · `/admin/companies/[id]/edit`

CRUD completo de empresas. Cada empresa es el tenant raíz que agrupa sus estaciones.

---

### Estaciones de servicio
**Rutas:** `/admin/gas-stations` · `/admin/gas-stations/new` · `/admin/gas-stations/[id]/edit`
**Equipamiento:** `/admin/gas-stations/[id]/equipment`

CRUD de estaciones. La página de equipamiento muestra un acordeón jerárquico:
- **Islas** → **Dispensadores** → **Boquillas** (con lecturas de medidor)
- **Tanques** (tabla separada dentro de la misma página)

El `fuelTypeId` del dispensador es derivado del tanque asignado — no se configura directamente en el dispensador.

---

### Tipos de combustible
**Rutas:** `/admin/fuel-types` · `/admin/fuel-types/new` · `/admin/fuel-types/[id]/edit`

CRUD de combustibles base (Gasolina 91, Gasolina 95, Diesel, etc.) con precio de costo por litro.

---

### Usuarios
**Rutas:** `/admin/users` · `/admin/users/new` · `/admin/users/[id]/edit`

CRUD de usuarios del sistema. Asignación de rol, tipo y estación. La contraseña se hashea con bcryptjs.

---

### Modelos de tanque
**Rutas:** `/admin/tank-models` · `/admin/tank-models/new` · `/admin/tank-models/[id]/edit`
**Calibración:** `/admin/tank-models/[id]`

CRUD de modelos de tanque con dimensiones (forma, capacidad nominal, longitud, diámetro). La página de detalle permite:
- Ver la tabla de calibración existente (altura cm → volumen L)
- Descargar un CSV template con el formato requerido
- Importar un CSV del fabricante (reemplaza todas las entradas existentes)

**Formato CSV esperado:**
```csv
heightCm,volumeLiters
0,0
10,95
20,210
```

---

### Empleados
**Rutas:** `/admin/employees` · `/admin/employees/new` · `/admin/employees/[id]/edit`

CRUD de perfiles de empleado. Vincula un `User` con sus datos laborales (nombre, apellido, posición, estación).

---

### Monedas
**Rutas:** `/admin/currencies` · `/admin/currencies/new` · `/admin/currencies/[id]/edit`

CRUD de monedas con su tasa de cambio. Ver [docs/architecture.md](architecture.md) para la convención de `exchangeRate`.

---

### Tipos de venta
**Rutas:** `/admin/sale-type-configs` · `/admin/sale-type-configs/new` · `/admin/sale-type-configs/[id]/edit`

Configuración de precios por combinación única de estación + combustible + tipo de venta (Regular / Premium / Subsidiado). Cada configuración tiene su propia moneda.

---

### Facturas de proveedor
**Rutas:** `/admin/invoices` · `/admin/invoices/new` · `/admin/invoices/[id]` · `/admin/invoices/[id]/edit`
**Descarga:** `/admin/invoices/[id]/reception/new`

Registro de facturas de compra de combustible. Incluye:
- Datos del documento: N° factura, N° control, N° precinto
- Datos del vehículo: placa del camión + placa del tanque/cisterna
- Datos del chofer: nombre y cédula
- Detalles de combustible: tipo, litros, costo/litro, monto total, moneda
- Registro de descargas en tanques (`DispatchReception`) con lecturas de nivel

---

## Panel de Estación (`/station`)

Acceso: usuarios con `gasStationId` asignado. Login en `/login`.

### Dashboard operacional
**Ruta:** `/station/dashboard`

Vista rápida con:
- Estado del turno activo del empleado (con acceso directo)
- Contadores de tickets del día (abiertos y completados)
- Lista de tickets pendientes con acceso directo

---

### Turnos
**Rutas:** `/station/shifts` · `/station/shifts/new` · `/station/shifts/[id]`
**Lecturas:** `/station/shifts/[id]/readings/new?type=INITIAL|FINAL`
**Reporte:** `/station/shifts/[id]/report`

#### Flujo operacional de un turno

```
1. Iniciar turno (/shifts/new)
      ↓
2. Registrar lecturas INICIALES de boquillas (?type=INITIAL)
      ↓
3. Operar: crear tickets → despachar → cobrar
      ↓
4. Registrar lecturas FINALES (?type=FINAL)
      ↓
5. Ver reporte de cierre (/shifts/[id]/report)
      ↓
6. Cerrar turno
```

#### Página de lecturas (`/readings/new`)

- Muestra todas las boquillas operativas de la estación
- `INITIAL`: muestra la lectura actual del sistema como referencia
- `FINAL`: muestra la lectura inicial del turno + calcula la diferencia en tiempo real
- Bloquea nozzles que ya tienen lectura del tipo solicitado
- Valida que la lectura FINAL ≥ INICIAL

#### Reporte de cierre

Incluye:
- Info del turno (empleado, rol, duración)
- Tabla de lecturas de surtidores (inicial / final / diferencia en litros)
- Contadores de tickets (completados / cancelados / pendientes)
- Varianza medidores vs tickets (auditoría)
- Despacho por boquilla (tickets y litros por nozzle)
- Despacho por bombero (tickets y litros por dispatcher)
- Recaudación por moneda (con equivalente en base)
- Por método de pago (agrupado con montos en cada moneda)
- Por tipo de combustible

---

### Tickets de venta
**Rutas:** `/station/tickets` · `/station/tickets/new` · `/station/tickets/[id]`

#### Crear un ticket (`/tickets/new`)

1. Seleccionar combustible
2. Seleccionar tipo de venta (filtra por combustible y estación)
3. Ingresar litros solicitados
4. Vista previa del total esperado antes de confirmar

#### Detalle del ticket (`/tickets/[id]`)

**Sección de despacho:**
- Seleccionar el bombero despachador
- Seleccionar la boquilla (filtrada por combustible operativo)
- Ingresar litros reales despachados (puede diferir de los solicitados)
- Al confirmar, el sistema recalcula `totalAmountExpected = litros reales × precio/litro`

**Sección de pago (multi-línea):**
- Varias líneas de pago (diferentes métodos y monedas)
- Cada línea bloqueada al agregar la siguiente ("confirmada por el cajero")
- Hint: muestra en tiempo real el monto pendiente en la moneda seleccionada
- Panel de resumen: total a cobrar vs total ingresado vs falta
- Al confirmar: crea todos los pagos en una transacción, guardando el snapshot de la tasa

---

### Inventario de tanques
**Ruta:** `/station/tanks`

Vista de todos los tanques de la estación:
- Barra de nivel visual (verde/ámbar/rojo según nivel vs mínimo operativo)
- Porcentaje de llenado y litros actuales/máximos
- Nivel en cm
- Historial de últimas 5 mediciones (fecha, volumen, empleado)
- Alertas en la parte superior (nivel crítico ≤ 50% del mínimo, nivel bajo ≤ mínimo)
- Formulario inline para registrar una nueva medición (nivel cm + volumen L + motivo + notas)

Si existe tabla de calibración para el modelo del tanque, el sistema calcula automáticamente el volumen a partir de la altura. Si no, usa el valor ingresado manualmente.
