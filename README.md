# FuelTrack

**Plataforma SaaS de gestión para estaciones de servicio de combustible**
Desarrollada por [Core Code Innovation (CCI)](https://corecodeinnovation.com)

---

## ¿Qué es FuelTrack?

FuelTrack es un sistema de gestión integral para empresas que operan estaciones de servicio. Permite administrar desde un panel central las operaciones diarias de cada estación: turnos de empleados, despacho de combustible, cobros, inventario de tanques y análisis de ventas.

El sistema opera bajo un modelo de licencias: cada instalación es validada por el servidor **CCILicenseServer** de CCI antes de arrancar, garantizando que sólo instancias autorizadas puedan operar.

---

## Características principales

### Panel de Administración (`/admin`)
- **Gestión de empresas y estaciones** — configuración completa de la estructura organizacional
- **Gestión de usuarios** — roles (Admin, Manager, Employee) y tipos (Cajero, Bombero, Supervisor, etc.)
- **Equipamiento de estación** — islas, dispensadores, boquillas y tanques por estación
- **Configuración de precios** — tipos de venta (Regular, Premium, Subsidiado) por combustible, estación y moneda
- **Registro de facturas de proveedor** — con datos del chofer, placa del camión y placa del tanque para auditorías
- **Modelos de tanque** — catálogo con tablas de calibración importables desde CSV (altura → volumen)
- **Gestión de monedas** — tasas de cambio configurables (USD, EUR, Bs, etc.)
- **Dashboard con gráficos** — litros por día, distribución por combustible, tickets por período, comparativo con período anterior

### Panel de Estación (`/station`)
- **Turnos operacionales** — inicio, gestión y cierre de turno por empleado
- **Lecturas de surtidores** — registro de lectura inicial y final del medidor por boquilla
- **Tickets de venta** — creación, despacho (con litros reales), cobro multi-moneda y multi-método
- **Pagos con tasa histórica** — cada pago guarda el snapshot de la tasa de cambio al momento del pago
- **Pagos en varios métodos simultáneos** — el cajero puede combinar efectivo + pago móvil + transferencia en un solo cierre
- **Inventario de tanques** — nivel actual, alertas de mínimo operativo, historial de mediciones
- **Reporte de cierre de turno** — resumen de lecturas, litros por boquilla, ventas por bombero, recaudación por moneda y método de pago

---

## Arquitectura

```
Monorepo (pnpm workspaces + Turborepo)
├── apps/web      →  Next.js 16  |  Panel Admin + Panel Estación  |  :3000
├── apps/api      →  Apollo Server 4 + Sequelize 6  |  API GraphQL  |  :4000
└── packages/     →  (futuro) tipos compartidos entre apps

Externo al monorepo:
└── CCILicenseServer  →  Validación de licencias (CCI, servidor independiente)  |  :4100
```

**Flujo de datos:**
```
Browser  →  apps/web (Next.js)  →  GraphQL  →  apps/api (Apollo)  →  PostgreSQL 15
                                                        ↓
                                          CCILicenseServer (validación al arrancar)
```

---

## Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Next.js · React · TypeScript | 16 · 19 · 5.9 |
| UI | Tailwind CSS v4 · shadcn/ui base-nova (@base-ui/react) | 4 · 4 |
| GraphQL client | Apollo Client | 4.2 |
| Backend | Node.js · Apollo Server · TypeScript | 20 · 4.x · 5 |
| ORM | Sequelize + PostgreSQL | 6 · 15 |
| Auth | JWT (localStorage / Bearer token) | — |
| Gráficos | Recharts | 3 |
| Monorepo | Turborepo · pnpm | 2 · 11 |
| Contenedores | Docker · docker-compose | — |

---

## Inicio rápido

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd project_fuelTrack

# 2. Instalar dependencias (todos los workspaces)
pnpm install

# 3. Configurar variables de entorno
#    Ver docs/setup.md para instrucciones detalladas
cp apps/api/.env.example apps/api/.env
# Editar apps/api/.env y apps/web/.env.local

# 4. Levantar el stack con Docker (forma más rápida)
docker compose --env-file .env.demo -f docker-compose.yml -f docker-compose.demo.yml up --build
```

Para desarrollo local sin Docker, ver → [docs/setup.md](docs/setup.md)

---

## Documentación

| Documento | Descripción |
|---|---|
| [docs/setup.md](docs/setup.md) | Configuración de entorno local y Docker |
| [docs/architecture.md](docs/architecture.md) | Arquitectura detallada, flujos de autenticación y decisiones técnicas |
| [docs/business-domain.md](docs/business-domain.md) | Entidades del negocio, relaciones y flujos de estado |
| [docs/modules.md](docs/modules.md) | Módulos del frontend — rutas, funcionalidad y flujo operacional |
| [docs/api.md](docs/api.md) | API GraphQL — queries, mutations y autenticación |
| [docs/deployment.md](docs/deployment.md) | Guía de despliegue en producción |
| [docs/offline-first-pending.md](docs/offline-first-pending.md) | Offline-first — estado, limitaciones y plan de migración futura |

---

## Licencia

Propietario — Core Code Innovation. Todos los derechos reservados.
