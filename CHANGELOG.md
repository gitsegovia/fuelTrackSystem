# Changelog

Todos los cambios notables del proyecto FuelTrack están documentados aquí.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versioning basado en [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Pendiente
- Equipamiento de estación: PumpIsland → Dispenser → DispenserNozzle
- Gestión de tanques: TankModel, Tank, TankAssignment, TankMeasurement
- Empleados y turnos: Employee, EmployeeShift
- Operaciones: DispenserReading, SalesTicket, Payment
- Despachos: Invoice, DispatchReception
- Configuración: Currency, SaleTypeConfig
- Panel Estación (`/station`) — operación diaria con modo offline-first
- Reportes y gráficos operacionales
- CI/CD y ambiente de producción

---

## [0.1.1] - 2026-06-03

Correcciones de infraestructura: Docker funcional y bug de login resuelto.

### Corregido

#### API
- **Login resolver**: retornaba objeto plano `{ id, username, role }` en vez del modelo Sequelize,
  lo que causaba que `User.company` fallara al llamar `parent.getCompany()` — el frontend
  recibía un error GraphQL y mostraba "credenciales incorrectas" aunque el usuario fuera válido.

#### Frontend
- **`NEXT_PUBLIC_GRAPHQL_URI`**: faltaba el sufijo `/graphql` en `.env.local` y en `docker-compose.yml`.
  Apollo Client enviaba peticiones a la raíz `/` en vez de `/graphql`.
- En modo dev, Next.js lee env vars en **runtime** (no las bake en build), así que la variable
  del compose pisaba la de `.env.local`. Ambos archivos ahora apuntan a `http://localhost:4000/graphql`.

#### Docker
- **Imagen base del web**: `node:20-alpine` → `node:22-alpine`. pnpm 11.5.1 requiere Node ≥ 22
  (usa el módulo built-in `node:sqlite` introducido en Node 22).
- **`pnpm install --ignore-scripts`**: pnpm 11 bloquea scripts de build de dependencias externas
  (`sharp`, `msw`, `unrs-resolver`) con `ERR_PNPM_IGNORED_BUILDS` cuando no hay `pnpm-workspace.yaml`
  en el contexto. `--ignore-scripts` bypasea el check; sharp no es requerido en dev (Next.js fallbackea).
- **`.dockerignore` del web**: no existía → Docker enviaba ~1 GB de contexto (`node_modules` + `.next`).
  Añadido `.dockerignore`, el contexto bajó a ~5 KB.
- **`.env` raíz**: `docker-compose.yml` usa `${DB_PASS}` para la contraseña de PostgreSQL pero no
  había `.env` en la raíz del monorepo → el contenedor de DB arrancaba con contraseña `postgres`
  mientras la API se conectaba con `mysecretpassword`. Creado `.env` raíz con los valores correctos.

#### Lockfile
- `apps/web/pnpm-lock.yaml`: el specifier de `zod` era `^4.4.3` pero el código usa v3 (bajado por
  shadcn). Corregido a `^3` para que pnpm 11 no rechace el lockfile como desactualizado.

### Dev local sin Docker

Para levantar sin Docker, ajustar `apps/api/.env`:
```
DB_HOST=localhost
DB_PASS=<contraseña_local_postgres>
LICENSE_SERVER_URL=http://localhost:4100
FINGERPRINT_PATH=C:\ProgramData\fueltrack\fingerprint
```
Y crear el archivo de fingerprint:
```powershell
New-Item -ItemType Directory -Force "C:\ProgramData\fueltrack"
Set-Content "C:\ProgramData\fueltrack\fingerprint" "ead4940f77dacd63b34342249f66ed228c7f4692d84ea455548bc9692de88281" -NoNewline
```
Luego arrancar en orden: `CCILicenseServer` (puerto 4100) → API → Web.

---

## [0.1.0] - 2026-06-02

Primera versión funcional del monorepo. Panel admin con gestión de maestros completada.

### Agregado

**Infraestructura — Monorepo**
- Estructura pnpm workspaces + Turborepo v2
- `apps/api` (FuelTrackApi existente) incorporado al monorepo como workspace
- Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- `.gitattributes` con normalización LF
- `.gitignore` global cubriendo todos los workspaces
- Git unificado en la raíz del monorepo

**apps/web — Frontend nuevo**
- Next.js 16.2.7 con App Router, React 19, TypeScript 5.9
- Tailwind CSS v4 (`@import "tailwindcss"` + `@theme inline`)
- shadcn/ui v4 base-nova (`@base-ui/react`) — reemplaza MUI v5
- Tema FuelTrack: zinc base + amber primario (`oklch(0.769 0.188 70)`)
- Apollo Client 4.2.0 con subpath imports (`@apollo/client/react`, `/link/http`, `/link/context`)
- Autenticación JWT: `AuthContext`, `useAuth`, query `me` al iniciar sesión
- Soporte react-hook-form + Zod v3 + @hookform/resolvers
- TanStack Table v8 — `DataTable` reutilizable con skeleton de carga
- Componentes compartidos: `PageHeader`, `DataTable`
- Sidebar oscuro zinc con navegación activa por ruta

**apps/web — Páginas admin completadas**
- Login admin (`/admin-login`) con toggle de contraseña
- Login estación (`/login`) — placeholder
- Dashboard (`/admin/dashboard`) con conteos reales vía Apollo queries
- **Empresas** CRUD completo (`/admin/companies`)
- **Estaciones** CRUD completo (`/admin/gas-stations`)
- **Tipos de combustible** CRUD completo (`/admin/fuel-types`)
- **Usuarios** CRUD completo (`/admin/users`) con selects de rol/tipo/estación

**GQL services migrados**
- `gql/login` — MUTATIONS.login, QUERIES.me
- `gql/company` — CRUD completo con fragment
- `gql/gasStation` — CRUD completo con fragment
- `gql/fuelType` — CRUD completo con fragment (Decimal como string)
- `gql/user` — CRUD completo con fragment (role, userType, assignedGasStation)

**Docker**
- `apps/web/Dockerfile` — multi-stage: base, builder, production (standalone), development
- `docker-compose.yml` en raíz — servicios: web + api + db
- `docker-compose.override.yml` en raíz — overrides dev con hot-reload y dev-machine-id
- `next.config.ts` — `output: 'standalone'` para imagen Docker ligera

### Cambiado
- `apps/api/package.json` — agregado script `"dev"` para compatibilidad con Turborepo
- Frontend migrado completamente de Next.js 13 + MUI v5 → Next.js 16 + shadcn/ui v4

### Decisiones técnicas
- **shadcn v4 usa `@base-ui/react`** en lugar de Radix UI — no hay prop `asChild`, selects como `<select>` nativo
- **Apollo v4 requiere subpath imports** — `@apollo/client/react` para hooks
- **Zod v3** (shadcn lo instala así) — `z.coerce.number()` no compatible con react-hook-form en v3; usar `z.string().refine()`
- **CCILicenseServer** permanece fuera del monorepo — servidor y dominio independiente
- **FuelTrack/** (frontend original MUI) mantenido como referencia, no es parte del workspace
