# FuelTrack Platform

Sistema de gestión para estaciones de servicio de combustible. Desarrollado por [Core Code Innovation (CCI)](https://corecodeinnovation.com).

## Descripción

FuelTrack permite a empresas propietarias de estaciones administrar sus operaciones: despacho de combustible, inventario de tanques, turnos de empleados, ventas y pagos. El acceso al sistema se valida mediante licencias emitidas por el servidor CCILicenseServer de CCI.

## Arquitectura

```
Monorepo (pnpm workspaces + Turborepo)
├── apps/web    → Panel de administración y estación (Next.js 16)
├── apps/api    → API GraphQL (Apollo Server + Sequelize + PostgreSQL)
└── packages/   → (futuro) tipos compartidos

Externo al monorepo:
└── CCILicenseServer  → Validación de licencias (CCI, servidor independiente)
```

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4 |
| UI | shadcn/ui v4 (base-nova, @base-ui/react) |
| GraphQL client | Apollo Client 4.2 |
| Backend | Node.js 20, Apollo Server 4, TypeScript |
| ORM | Sequelize 6 + PostgreSQL 15 |
| Auth | JWT (localStorage en web, Bearer en API) |
| Orquestación | Turborepo 2, pnpm 11 |
| Contenedores | Docker, docker-compose |

## Requisitos

- Node.js 20+
- pnpm 11+
- Docker (para levantar el stack completo)

## Instalación

```bash
# Clonar y entrar al directorio
git clone <repo>
cd project_fuelTrack

# Instalar dependencias de todos los workspaces
pnpm install
```

## Desarrollo

### Con Turborepo (recomendado)

```bash
# Desde la raíz — levanta web y api en paralelo
pnpm dev
```

> **Nota de puertos:** La API usa `PORT=3000` por defecto y el web también corre en 3000. Para desarrollo local sin Docker, cambiar `PORT=4000` en `apps/api/.env` para evitar conflicto.

### Por separado

```bash
pnpm --filter web dev   # http://localhost:3000
pnpm --filter api dev   # configurar PORT=4000 en apps/api/.env
```

### Variables de entorno

**apps/web/.env.local**
```
NEXT_PUBLIC_GRAPHQL_URI=http://localhost:4000
NEXT_PUBLIC_JWT_SECRET=<mismo que JWT_SECRET de la API>
```

**apps/api/.env** — copiar desde `apps/api/.env.example` y completar.

## Docker

```bash
# Stack completo en producción
docker-compose up --build

# Con overrides de desarrollo (hot-reload)
docker-compose up
```

Los overrides de desarrollo (`docker-compose.override.yml`) montan el código fuente como volumen y usan los archivos `dev-machine-id.md` / `dev-mac-address.md` en lugar del hardware real para la validación de licencia.

## Base de datos

```bash
cd apps/api

# Correr migraciones
pnpm sequelize db:migrate

# Cargar datos iniciales
pnpm sequelize db:seed:all
```

## Estructura del proyecto

```
apps/web/src/
├── app/                    → rutas (App Router)
│   ├── (auth)/             → login admin, login estación
│   ├── admin/              → panel de administración
│   └── station/            → panel de estación (en desarrollo)
├── components/
│   ├── ui/                 → componentes shadcn/ui
│   ├── layout/             → sidebar, topbar, providers
│   └── shared/             → DataTable, PageHeader
├── context/                → AuthContext (JWT)
├── hooks/                  → useAuth
├── lib/                    → apollo-client, utils (cn)
├── services/graphql/gql/   → queries y mutations por módulo
└── types/                  → tipos TypeScript (auth, etc.)

apps/api/src/
├── graphql/
│   ├── schemas/            → .graphql SDL por entidad
│   └── resolvers/          → resolvers por entidad
├── models/                 → modelos Sequelize
├── middleware/             → auth JWT, autorización
└── utils/                  → licenseValidator, authUtils
```

## Módulos admin disponibles

| Módulo | Ruta |
|---|---|
| Dashboard | `/admin/dashboard` |
| Empresas | `/admin/companies` |
| Estaciones | `/admin/gas-stations` |
| Tipos de combustible | `/admin/fuel-types` |
| Usuarios | `/admin/users` |

## Licencia

Propietario — Core Code Innovation. Todos los derechos reservados.
