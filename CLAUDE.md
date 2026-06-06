# CLAUDE.md — FuelTrack Platform

## Identidad y comportamiento

Lee `CORE.md` en la raíz del proyecto. Ahí está definida tu identidad (CORE), tono, idioma y reglas de conducta. Este archivo es el spec técnico del proyecto — úsalo como fuente de verdad en cada sesión.

---

## 1. El proyecto

**FuelTrack** es una plataforma SaaS de gestión para estaciones de servicio de combustible, desarrollada por **Core Code Innovation (CCI)**. Permite a empresas propietarias de estaciones administrar operaciones de despacho, inventario de tanques, turnos de empleados, ventas y pagos.

**Modelo de negocio:** una empresa compra una licencia y gestiona sus propias estaciones desde un panel admin. El acceso es validado por `CCILicenseServer` (sistema propio de CCI, externo a este monorepo).

**Dos interfaces:**
- **Panel Admin** (`/admin`) — gestión completa: empresas, estaciones, usuarios, configuración
- **Panel Estación** (`/station`) — operación diaria: turnos, despachos, lecturas de dispensador

---

## 2. Arquitectura del sistema

```
project_fuelTrack/                ← raíz del monorepo (git)
├── apps/
│   ├── web/                      ← Next.js 16 frontend (puerto 3000)
│   └── api/                      ← GraphQL API Node.js (puerto 4000 en dev)
├── packages/
│   └── types/                    ← (futuro) tipos GraphQL compartidos
├── docker-compose.yml            ← stack completo: web + api + postgres
├── docker-compose.override.yml   ← overrides dev (git-ignored)
├── turbo.json                    ← orchestración Turborepo
├── pnpm-workspace.yaml           ← workspaces + allowBuilds
├── package.json                  ← root workspace
├── CLAUDE.md                     ← este archivo
└── CORE.md                       ← identidad y reglas del asistente

CCILicenseServer/                 ← servidor de licencias CCI (NO es parte del monorepo)
FuelTrack/                        ← frontend original (referencia, deprecado)
```

**CCILicenseServer** corre en un dominio/servidor independiente. La API lo consulta via `LICENSE_SERVER_URL` para validar el fingerprint de la máquina donde está desplegado.

### Flujo de datos

```
Browser → apps/web (Next.js) → GraphQL → apps/api (Apollo Server) → PostgreSQL
                                                      ↓
                                          CCILicenseServer (validación al arrancar)
```

---

## 3. Stack técnico

### Monorepo
| Tool | Versión | Notas |
|---|---|---|
| pnpm | 11.5.1 | `packageManager` en root package.json |
| Turborepo | ^2.5.4 | `turbo run dev/build/lint` |
| Node.js | ≥20 | Requerido en engines |

### apps/web
| Tool | Versión | Notas críticas |
|---|---|---|
| Next.js | 16.2.7 | App Router, React 19 |
| React | 19 | |
| TypeScript | 5.9 | strict mode |
| Tailwind CSS | **v4** | `@import "tailwindcss"` + `@theme inline` en CSS. **NO hay tailwind.config.ts** |
| shadcn/ui | **v4 base-nova** | Usa `@base-ui/react`, **NO Radix UI** — NO hay prop `asChild` |
| Apollo Client | **4.2.0** | Imports por subpath: `@apollo/client/react`, `/link/http`, `/link/context` |
| Zod | **3.x** | shadcn lo downgradeó a v3. `z.coerce.number()` tiene input type `unknown` en v3 |
| react-hook-form | ^7 | |
| @hookform/resolvers | ^3 | |
| @tanstack/react-table | ^8 | DataTable wrapper en `components/shared/DataTable.tsx` |
| lucide-react | latest | Iconos |
| sonner | ^2 | Toast notifications |
| date-fns | latest | |
| clsx + tailwind-merge | latest | Helper `cn()` en `lib/utils.ts` |

### apps/api
| Tool | Versión | Notas |
|---|---|---|
| Node.js | 20 | |
| TypeScript | ^5 | ESM con ts-node/esm |
| Apollo Server | 4.x | GraphQL |
| Sequelize | 6.x | ORM para PostgreSQL |
| PostgreSQL | 15 | Imagen Docker: postgres:15-alpine |
| bcryptjs | latest | Hash de passwords |
| jsonwebtoken | latest | JWT auth |
| express | 4.x | HTTP server base |

---

## 4. Gotchas críticos

Estos son problemas que ya se encontraron y resolvieron. No repetir:

### Apollo Client v4 — subpath imports OBLIGATORIOS
```typescript
// ✅ Correcto
import { useQuery, useMutation, useApolloClient } from '@apollo/client/react'
import { createHttpLink } from '@apollo/client/link/http'
import { setContext } from '@apollo/client/link/context'
import { ApolloClient, InMemoryCache, ApolloProvider, gql } from '@apollo/client'

// ❌ Incorrecto — export error en Apollo v4
import { useQuery } from '@apollo/client'
```

### Enums en Sequelize — valores SIEMPRE deben coincidir con GraphQL
```typescript
// ✅ Correcto — el valor del enum TypeScript = nombre del enum GraphQL
export enum SaleTypeName {
  REGULAR = "REGULAR",
  PREMIUM = "PREMIUM",
}

// ❌ Incorrecto — valor descriptivo que no coincide con el enum GraphQL
export enum SalesTicketStatus {
  PENDING_PAYMENT_DISPATCH = "Pending Payment and Dispatch",
}
```
Al crear un nuevo enum en `utils/types.ts` para usar con Sequelize+GraphQL,
el valor string DEBE ser idéntico al nombre del enum en el schema `.graphql`.
Si no coinciden, la DB guarda el valor descriptivo pero GraphQL no puede
deserializarlo al leer → error en runtime. Todos los enums del proyecto
ya fueron corregidos con este patrón.

### shadcn/ui v4 base-nova — NO asChild en ningún componente
```typescript
// ✅ Correcto — className directo en Trigger
<DropdownMenuTrigger className="...">
  <Avatar>...</Avatar>
</DropdownMenuTrigger>

// ✅ Correcto — Button que navega usa onClick + useRouter, NUNCA asChild + Link
<Button onClick={() => router.push('/ruta')}>Ir</Button>

// ❌ Incorrecto — asChild no existe en @base-ui/react (ni en Button ni en ningún primitivo)
<DropdownMenuTrigger asChild>
<Button asChild><Link href="/ruta">Ir</Link></Button>
```

### Zod v3 — numeric inputs en formularios
```typescript
// ✅ Correcto en Zod v3 con react-hook-form
costPerLiter: z.string()
  .min(1, 'Requerido')
  .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Debe ser > 0'),

// ❌ Incorrecto — z.coerce.number() tiene input type `unknown` en v3, rompe el Resolver type
costPerLiter: z.coerce.number({ invalid_type_error: '...' }).positive(...)
// invalid_type_error tampoco existe en v3, es API de v4
```

### Tailwind v4 — NO hay config file
```css
/* ✅ globals.css — Tailwind v4 syntax */
@import "tailwindcss";
@theme inline {
  --color-primary: var(--primary);
  /* ... */
}

/* ❌ No existe tailwind.config.ts en este proyecto */
```

### Next.js 16 en monorepo — lockfile warning
`apps/web/pnpm-workspace.yaml` fue generado por `npx shadcn` y causaba warning de múltiples lockfiles. Ya se eliminó. Si vuelve a aparecer, borrarlo.

### apps/api .git eliminado
`apps/api` tenía su propio `.git` (era repo separado). Se eliminó para incorporarlo al monorepo. El historial original se perdió, pero el código está completo.

---

## 5. Dominio de negocio — Entidades

### Jerarquía principal
```
Company (empresa)
  └── GasStation (estación)
        ├── User[] (usuarios asignados)
        ├── PumpIsland[] (islas)
        │     └── Dispenser[] (dispensadores)
        │           └── DispenserNozzle[] (pistolas) → FuelType
        ├── Tank[] (tanques) → TankModel
        │     └── TankAssignment → DispenserNozzle + FuelType
        ├── TankMeasurement[]
        └── EmployeeShift[] → Employee → User
```

### Entidades y sus campos

**Company**
- id, name, address?, phone?, logo?, createdAt

**GasStation**
- id, name, code (único), address?, companyId, createdAt

**User**
- id, username (único), passwordHash (nunca retornado), role, userType, companyId, gasStationId?, createdAt
- `role`: `ADMIN | MANAGER | EMPLOYEE`
- `userType`: `Administrator | Supervisor | Cashier | FuelAttendant | Administrative`

**FuelType**
- id, name (único), costPerLiter (Decimal — el GraphQL lo retorna como string), createdAt

**PumpIsland**
- id, name, description?, gasStationId, createdAt

**Dispenser**
- id, name, gasStationId, pumpIslandId, tankId, fuelTypeId, isOperational (Boolean), createdAt
- ⚠ `fuelTypeId` es **derivado del tanque** — no se acepta en CreateInput/UpdateInput. El resolver lo lee de `tank.fuelTypeId` automáticamente. Cambiarlo implica editar el tanque.

**DispenserNozzle**
- id, name, dispenserId, initialMeterReading (Decimal), currentMeterReading (Decimal), isOperational (Boolean), createdAt

**TankModel**
- id, name, nominalCapacity (Decimal), shape (String), lengthCm?, diameterCm?, widthCm?, heightCm?, description?, createdAt

**Tank**
- id, name, gasStationId, fuelTypeId, tankModelId, maxCapacityLiters (Decimal), minOperatingVolumeLiters (Decimal), currentHeightCm? (Decimal), currentVolumeLiters? (Decimal), createdAt

**TankAssignment**
- id, tankId, dispenserNozzleId, fuelTypeId, createdAt

**TankMeasurement**
- id, tankId, value, measuredAt, createdAt

**TankCalibrationEntry**
- id, tankId, level, volume, createdAt

**Employee**
- id, userId (1:1), gasStationId, firstName, lastName, position (String), createdAt
- No tiene dni ni phone en el schema actual

**EmployeeShift**
- id, gasStationId, employeeId, startTime, endTime?, status, createdAt

**DispenserReading**
- id, dispenserNozzleId, shiftId, reading, createdAt

**SalesTicket**
- id, gasStationId, shiftId, fuelTypeId, liters (Decimal), totalAmount (Decimal), ...

**Payment**
- id, salesTicketId, method, amount (Decimal), createdAt

**Invoice** (despacho a estación)
- id, invoiceNumber, controlNumber, sealNumber, liters (Decimal), dispatchDate, dischargeDate, truckIdentifier, fuelKind (enum FuelKind: GASOLINE_91/GASOLINE_95/DIESEL/KEROSENE), totalAmount (Decimal), costPerLiter (Decimal), gasStationId, currencyId, createdAt
- ⚠ `fuelKind` es un enum local (no FK a FuelType) — representa el tipo de combustible en la factura del proveedor

**DispatchReception**
- id, invoiceId, tankId, liters (Decimal), createdAt

**Currency**
- id, name, symbol, exchangeRate (Decimal), createdAt
- No tiene campo `code` en el schema actual

**SaleTypeConfig**
- id, gasStationId, fuelTypeId, saleTypeName (enum: REGULAR | PREMIUM | SUBSIDIZED), salePricePerLiter (Decimal), percentage (Decimal), currencyId, createdAt
- Combinación única: gasStationId + fuelTypeId + saleTypeName

**InvoicePayment** (pago de factura de proveedor)
- id, invoiceId, amount (Decimal), paymentDate, bankName?, paymentMethod (enum: CASH/BANK_TRANSFER/CHECK/CARD), referenceNumber?, notes?, recordedById, createdAt
- Tabla: `invoice_payments`

**AuditPeriodClose** (cierre de período de auditoría — inmutable)
- id, gasStationId, closedById, periodStart, periodEnd, closeType (MONTHLY|MANUAL), status (DRAFT|CLOSED)
- 7 snapshots JSONB: invoiceSnapshot, shiftSnapshot, dispatcherSnapshot, tankSnapshot, financialSnapshot, driverSnapshot, marginSnapshot
- Tabla: `audit_period_closes`

---

## 6. Estado actual del frontend

### Módulos admin completados (CRUD completo)
| Módulo | Ruta | GQL service | Fase |
|---|---|---|---|
| Login admin | `/admin-login` | `gql/login` | 1-5 |
| Dashboard operacional | `/admin/dashboard` | queries de todos los módulos + Recharts | 1-5/9 |
| Empresas | `/admin/companies` | `gql/company` | 1-5 |
| Estaciones | `/admin/gas-stations` | `gql/gasStation` | 1-5 |
| Tipos de combustible | `/admin/fuel-types` | `gql/fuelType` | 1-5 |
| Usuarios | `/admin/users` | `gql/user` | 1-5 |
| Modelos de tanque | `/admin/tank-models` | `gql/tankModel` | 6 |
| Equipamiento de estación | `/admin/gas-stations/[id]/equipment` | `gql/pumpIsland` + `gql/dispenser` + `gql/dispenserNozzle` + `gql/tank` | 6 |
| Empleados | `/admin/employees` | `gql/employee` | 7 |
| Monedas | `/admin/currencies` | `gql/currency` | 7 |
| Tipos de venta | `/admin/sale-type-configs` | `gql/saleTypeConfig` | 7 |
| Facturas (despachos) | `/admin/invoices` | `gql/invoice` + `gql/dispatchReception` | 8 |
| Pagos de facturas | `/admin/invoice-payments` | `gql/invoicePayment` | 8 |
| Auditoría (6 tabs) | `/admin/audit/recepciones,turnos,bomberos,tanques,financiero,cierres` | `gql/audit` + `gql/auditPeriodClose` | 8-9 |

### Panel Estación — módulos completados
| Módulo | Ruta | GQL service |
|---|---|---|
| Login estación | `/(auth)/login` | `gql/login` |
| Dashboard | `/station/dashboard` | shifts + tickets |
| Turnos | `/station/shifts` | `gql/employeeShift` |
| Iniciar turno | `/station/shifts/new` | `gql/employeeShift` |
| Detalle de turno | `/station/shifts/[id]` | shift + tickets + readings |
| Lecturas surtidor | `/station/shifts/[id]/readings/new` | `gql/dispenserReading` |
| Reporte de turno | `/station/shifts/[id]/report` | shift + tickets + payments |
| Tickets | `/station/tickets` | `gql/salesTicket` |
| Nuevo ticket | `/station/tickets/new` | `gql/salesTicket` |
| Detalle ticket | `/station/tickets/[id]` | ticket + payments + dispatch |
| Tanques | `/station/tanks` | `gql/tank` + mediciones |

### GQL services en apps/web
```
services/graphql/gql/
├── login/                ✅ MUTATIONS.login, QUERIES.me
├── company/              ✅ QUERIES.companies/company, MUTATIONS.create/update/delete
├── gasStation/           ✅ QUERIES.gasStations/gasStation, MUTATIONS.create/update/delete
├── fuelType/             ✅ QUERIES.fuelTypes/fuelType, MUTATIONS.create/update/delete
├── user/                 ✅ QUERIES.users/user, MUTATIONS.create/update/delete
├── tankModel/            ✅ QUERIES.tankModels/tankModel, MUTATIONS.create/update/delete
├── pumpIsland/           ✅ QUERIES.pumpIslands/pumpIsland/pumpIslandsByGasStation, MUTATIONS.create/update/delete
├── dispenser/            ✅ QUERIES.dispenser/dispensersByGasStation/dispensersByPumpIsland, MUTATIONS.create/update/delete
├── dispenserNozzle/      ✅ QUERIES.dispenserNozzle/dispenserNozzlesByDispenser, MUTATIONS.create/update/delete
├── tank/                 ✅ QUERIES.tank/tanksByGasStation, MUTATIONS.create/update/delete
├── employee/             ✅ QUERIES.employees/employee, MUTATIONS.create/update/delete
├── currency/             ✅ QUERIES.currencies/currency, MUTATIONS.create/update/delete
├── saleTypeConfig/       ✅ QUERIES.saleTypeConfigs/saleTypeConfig, MUTATIONS.create/update/delete
├── employeeShift/        ✅ QUERIES.employeeShifts/employeeShift/employeeShiftsByGasStation/activeEmployeeShift, MUTATIONS.create/end/update/delete
├── dispenserReading/     ✅ QUERIES.dispenserReadingsByShift, MUTATIONS.createDispenserReading
├── salesTicket/          ✅ QUERIES.salesTicket/salesTicketsByGasStation/salesTicketsByCashierShift, MUTATIONS.create/processDispatch/completePayment/cancel
├── payment/              ✅ QUERIES.paymentsBySalesTicket, MUTATIONS.createPayments
├── invoice/              ✅ QUERIES.invoices/invoice/invoicesByGasStation, MUTATIONS.create/update/delete
├── dispatchReception/    ✅ QUERIES.dispatchReceptionsByTank/byInvoice, MUTATIONS.create/delete
├── tankMeasurement/      ✅ QUERIES.tankMeasurementsByTank, MUTATIONS.createTankMeasurement
├── tankCalibrationEntry/ ✅ QUERIES.tankCalibrationEntriesByModel, MUTATIONS.bulkCreate/delete
├── tankAssignment/       ✅ MUTATIONS.create/delete
├── audit/                ✅ QUERIES.6 dimensiones (invoice/shift/dispatcher/tank/financial/driver) + profitMargin
├── invoicePayment/       ✅ QUERIES.invoicePayment/invoiceBalance/unpaidInvoices/invoiceProfitMargin, MUTATIONS.create/update/delete
└── auditPeriodClose/     ✅ QUERIES.auditPeriodCloses/auditPeriodClose, MUTATIONS.create/confirm/recalculate/delete
```

---

## 7. Estructura de archivos — apps/web

```
apps/web/src/
├── app/
│   ├── layout.tsx               ← root layout (AppProviders, Geist fonts, lang="es")
│   ├── page.tsx                 ← redirect a /admin-login
│   ├── icon.tsx                 ← favicon generado: cuadrado amber + icono Gauge
│   ├── globals.css              ← Tailwind v4 + tema zinc/amber
│   ├── (auth)/
│   │   ├── admin-login/page.tsx ← formulario login admin
│   │   └── login/page.tsx       ← formulario login estación
│   ├── admin/
│   │   ├── layout.tsx           ← guard de auth (useEffect + redirect)
│   │   ├── dashboard/page.tsx   ← stats en vivo
│   │   ├── companies/           ← CRUD completo
│   │   ├── gas-stations/        ← CRUD completo + botón Equipamiento (Wrench)
│   │   │   └── [id]/equipment/  ← página de equipamiento con acordeón
│   │   │       ├── pump-islands/new/ y [islandId]/edit/
│   │   │       ├── dispensers/new/ y [dispenserId]/edit/
│   │   │       ├── nozzles/new/ y [nozzleId]/edit/
│   │   │       └── tanks/new/ y [tankId]/edit/
│   │   ├── fuel-types/          ← CRUD completo
│   │   ├── tank-models/         ← CRUD completo
│   │   ├── users/               ← CRUD completo
│   │   ├── employees/           ← CRUD completo
│   │   ├── currencies/          ← CRUD completo
│   │   ├── sale-type-configs/   ← CRUD completo
│   │   ├── invoices/            ← CRUD + historial de recepciones por tanque
│   │   │   └── [id]/            ← detalle de factura con recepciones
│   │   ├── invoice-payments/    ← KPIs de margen + tabla de facturas pendientes
│   │   │   └── [invoiceId]/     ← balance + historial de pagos + formulario de pago
│   │   └── audit/               ← 6 tabs de auditoría + cierres de período
│   │       ├── layout.tsx       ← tab nav + selector de estación
│   │       ├── recepciones/     ← auditoría de facturas vs recepciones
│   │       ├── turnos/          ← auditoría de turnos
│   │       ├── bomberos/        ← rendimiento por bombero
│   │       ├── tanques/         ← balance de inventario de tanques
│   │       ├── financiero/      ← cuadre financiero por turno
│   │       └── cierres/         ← cierres de período (snapshots inmutables)
│   └── station/
│       ├── layout.tsx           ← layout con sidebar de estación
│       ├── page.tsx             ← redirect a /station/dashboard
│       ├── dashboard/           ← turno activo + stats del día
│       ├── shifts/              ← lista + nuevo turno
│       │   ├── new/             ← iniciar turno
│       │   └── [id]/            ← detalle + cierre de turno
│       │       ├── readings/new/ ← lecturas iniciales/finales de surtidores
│       │       └── report/      ← reporte completo de cierre de turno
│       ├── tickets/             ← lista de tickets
│       │   ├── new/             ← crear ticket con cálculo de precio
│       │   └── [id]/            ← detalle: cobro + despacho
│       └── tanks/               ← inventario de tanques con mediciones
├── components/
│   ├── ui/                      ← componentes shadcn/ui (base-nova, auto-generados)
│   ├── layout/
│   │   ├── AdminSidebar.tsx     ← sidebar dark zinc con nav activo
│   │   ├── AdminTopbar.tsx      ← topbar con dropdown de usuario
│   │   └── AppProviders.tsx     ← ApolloProvider + AuthProvider + Toaster
│   └── shared/
│       ├── DataTable.tsx        ← wrapper TanStack Table v8 con skeleton
│       └── PageHeader.tsx       ← título + descripción + slot de acción
├── context/
│   └── AuthContext.tsx          ← JWT en localStorage, query `me` al init
├── hooks/
│   └── useAuth.ts               ← useContext(AuthContext)
├── lib/
│   ├── apollo-client.ts         ← makeApolloClient() con authLink + httpLink
│   └── utils.ts                 ← cn() = clsx + twMerge
├── services/graphql/gql/        ← ver sección 6
└── types/
    └── auth.ts                  ← AuthUser, LoginParams, AuthContextValue, UserRole, UserType
```

---

## 8. Entorno de desarrollo

### Generación de secretos

Antes de configurar los `.env`, generar los valores sensibles con uno de estos comandos:

**JWT_SECRET y DB_PASS** — usar cualquiera de los tres según lo disponible:

```powershell
# PowerShell (Windows, siempre disponible)
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))

# Node.js (disponible en cualquier máquina del proyecto)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# OpenSSL (si está instalado)
openssl rand -hex 48
```

Cualquiera genera una cadena aleatoria de alta entropía. Usar una distinta para `JWT_SECRET` y para `DB_PASS`.

**Fingerprint (solo dev local, sin Docker)**

El archivo de fingerprint contiene el hash que el CCILicenseServer espera para la clave `DEV-LICENSE-KEY-12345`. Es un valor fijo de desarrollo, no se genera aleatoriamente:

```powershell
# PowerShell — crear directorio y archivo
New-Item -ItemType Directory -Force "C:\ProgramData\fueltrack" | Out-Null
Set-Content -Path "C:\ProgramData\fueltrack\fingerprint" `
  -Value "ead4940f77dacd63b34342249f66ed228c7f4692d84ea455548bc9692de88281" `
  -NoNewline
```

En Docker este archivo lo genera automáticamente `docker-entrypoint.sh` a partir de los archivos `apps/api/dev-machine-id.md` y `apps/api/dev-mac-address.md`.

**LICENSE_KEY** — no se genera, la provee CCI al entregar la licencia al cliente. En dev usar `DEV-LICENSE-KEY-12345` con el CCILicenseServer local.

---

### Variables de entorno

**apps/web/.env.local**
```
NEXT_PUBLIC_GRAPHQL_URI=http://localhost:4000/graphql
NEXT_PUBLIC_JWT_SECRET=<mismo valor que JWT_SECRET de la API>
```

> ⚠ En modo dev Next.js lee las env vars en runtime (no las bake en build). El valor de
> `docker-compose.yml` pisa `.env.local` cuando corre en Docker — ambos archivos deben coincidir.

**apps/api/.env** (ver apps/api/.env.example para referencia)
```
NODE_ENV=development
PORT=3000               ← API corre en 3000 internamente (Docker expone 4000→3000)
DB_DATABASE=fueltrack
DB_USER=postgres
DB_PASS=<generado arriba>
DB_HOST=db              ← en Docker; cambiar a 'localhost' para dev local
DB_PORT=5432
DB_HOST_PORT=5433       ← puerto externo del DB en docker-compose.override
JWT_SECRET=<generado arriba>
LICENSE_KEY=DEV-LICENSE-KEY-12345
LICENSE_SERVER_URL=http://host.docker.internal:4100   ← en Docker
                        ← cambiar a http://localhost:4100 para dev local
FINGERPRINT_PATH=/etc/fueltrack/fingerprint           ← en Docker
                        ← cambiar a C:\ProgramData\fueltrack\fingerprint para dev local
```

**`.env` raíz del monorepo** (para interpolación de docker-compose)
```
DB_USER=postgres
DB_PASS=<mismo que apps/api/.env>
DB_DATABASE=fueltrack
DB_HOST_PORT=5433
API_PORT=4000
```

> ⚠ `docker-compose.yml` usa `${DB_PASS}` para la contraseña del contenedor de PostgreSQL.
> Si este archivo no existe, el contenedor de DB arranca con contraseña `postgres` mientras
> la API intenta conectar con el valor de `apps/api/.env` → falla la conexión.

### Puertos
| Servicio | Puerto dev local | Puerto docker externo |
|---|---|---|
| apps/web | 3000 | 3000 |
| apps/api | 4000* | 4000 |
| PostgreSQL | — | 5433 |

*La API tiene `PORT=3000` en su .env, pero en desarrollo se ejecuta en 4000 cambiando PORT o usando docker-compose. Si se corre con `turbo dev` ambos conflictan en 3000 — ajustar `PORT=4000` en `apps/api/.env` para desarrollo local.

### Comandos
```bash
# Desarrollo local (3 terminales separadas)
cd apps/api && pnpm dev      # API en localhost:4000
cd apps/web && pnpm dev      # Web en localhost:3000
# CCILicenseServer debe estar corriendo en localhost:4100

# Docker — entorno demo (builds de desarrollo, hot-reload)
docker compose --env-file .env.demo -f docker-compose.yml -f docker-compose.demo.yml up --build

# Docker — entorno producción
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up --build

# Copiar templates de env antes del primer uso:
# .env.demo.example → .env.demo
# .env.prod.example → .env.prod
# apps/api/.env.docker.example → apps/api/.env.docker
```

### Migraciones de DB (Sequelize)
```bash
cd apps/api
pnpm sequelize db:migrate
pnpm sequelize db:seed:all
```

---

## 9. Patrones de código establecidos

### Patrón de página de lista (CRUD)
Referencia: `apps/web/src/app/admin/companies/page.tsx`

```tsx
'use client'
// useQuery<{ entityName: Entity[] }>(QUERIES.entities)
// useMutation(MUTATIONS.deleteEntity)
// ColumnDef<Entity>[] con columns para DataTable
// AlertDialog para confirmar delete
// PageHeader con botón "Nueva entidad"
```

### Patrón de formulario de creación
Referencia: `apps/web/src/app/admin/companies/new/page.tsx`

```tsx
'use client'
// useForm<FormData> + zodResolver
// useMutation con refetchQueries
// companyId auto-fill desde useAuth() → user.company.id
// Inputs con aria-invalid + mensaje de error
// Botón disabled durante loading
```

### Patrón de formulario de edición
Referencia: `apps/web/src/app/admin/companies/[id]/edit/page.tsx`

```tsx
'use client'
// useQuery<{ entity: Entity | null }>(QUERIES.entity, { variables: { id }, skip: !id })
// useEffect para reset() cuando llegan los datos
// useMutation con refetchQueries
// Skeleton mientras fetching
```

### Select nativo (para enums/relaciones en formularios)
En Zod v3 con react-hook-form, usar `<select>` nativo con clase:
```tsx
const selectClass = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)
<select {...register('field')} className={selectClass}>
```

### GQL service pattern
```typescript
// Fragment para reutilizar campos
const ENTITY_FRAGMENT = gql`fragment EntityFields on Entity { id name ... }`

export const QUERIES = {
  entities: gql`query Entities { entities { ...EntityFields } } ${ENTITY_FRAGMENT}`,
  entity: gql`query Entity($id: UUID!) { entity(id: $id) { ...EntityFields } } ${ENTITY_FRAGMENT}`,
}
export const MUTATIONS = {
  createEntity: gql`mutation CreateEntity($input: CreateEntityInput!) { createEntity(input: $input) { ...EntityFields } } ${ENTITY_FRAGMENT}`,
  updateEntity: gql`mutation UpdateEntity($id: UUID!, $input: UpdateEntityInput!) { updateEntity(id: $id, input: $input) { ...EntityFields } } ${ENTITY_FRAGMENT}`,
  deleteEntity: gql`mutation DeleteEntity($id: UUID!) { deleteEntity(id: $id) }`,
}
```

---

## 10. Tema visual

- **Base:** zinc (grises oscuros para sidebar y neutrales)
- **Primario:** amber `oklch(0.769 0.188 70)` — acciones, activos en sidebar
- **Sidebar:** dark zinc `oklch(0.145 0.005 285)` con texto `oklch(0.985 0.001 286)`
- Definido en `apps/web/src/app/globals.css` como CSS custom properties + `@theme inline`
- shadcn base-nova (componentes en `components/ui/`)

---

## 11. Roadmap — fases

### ✅ Fase 6 — Equipamiento de estación (admin) — COMPLETADA
- `/admin/tank-models` — CRUD modelos de tanque
- `/admin/gas-stations/[id]/equipment` — acordeón jerárquico: Islas → Dispensadores → Boquillas + tabla de Tanques
- `?expandIsland=<id>` en la URL para auto-expandir y resaltar la isla activa al regresar de un formulario
- `fuelType` del dispensador es derivado del tanque (no se configura independientemente)

### ✅ Fase 7 — Configuración admin — COMPLETADA
- `/admin/employees` — CRUD perfiles de empleado (userId + gasStationId + firstName/lastName/position)
- `/admin/currencies` — CRUD monedas (name, symbol, exchangeRate)
- `/admin/sale-type-configs` — CRUD configuración de precios por estación+combustible+tipo (REGULAR/PREMIUM/SUBSIDIZED)

### ✅ Fase 8 — Panel Estación + Operaciones — COMPLETADA
- Panel `/station`: login, dashboard, turnos, tickets, lecturas de surtidor, inventario de tanques
- Facturas de proveedor: CRUD Invoice + DispatchReception con historial por tanque
- Pagos de facturas (cuentas por pagar): InvoicePayment con trazabilidad bancaria
- Margen operacional: query `invoiceProfitMargin` (ingresos vs costos pagados)

### ✅ Fase 9 — Auditoría y Reportes — COMPLETADA
- 6 dimensiones de auditoría en `/admin/audit`: recepciones, turnos, bomberos, tanques, financiero, driver
- Dashboard operacional con gráficos Recharts (litros por día, distribución por combustible, tickets por día)
- Reporte de cierre de turno (`/station/shifts/[id]/report`)
- Cierres de período inmutables (`AuditPeriodClose`): snapshots JSONB, modos Mensual/Manual

### Fase 10 — Producción
- CI/CD (GitHub Actions ya tiene estructura en apps/api/.github)
- SSL, dominio, environment de staging
- Test de integración CCILicenseServer
- Offline-first para panel estación: Service Worker + IndexedDB + sync queue (pendiente)
