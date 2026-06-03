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
