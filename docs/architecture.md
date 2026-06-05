# Arquitectura del sistema

## Visión general

FuelTrack es un monorepo con dos aplicaciones independientes que se comunican a través de GraphQL. Un servidor externo de licencias (`CCILicenseServer`) valida que la instancia de la API esté autorizada antes de arrancar.

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│   /admin-login  /admin/*  /login  /station/*            │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP
                        ▼
┌─────────────────────────────────────────────────────────┐
│              apps/web  (Next.js 16)                     │
│  App Router · React 19 · Apollo Client 4 · Tailwind v4  │
│  Puerto 3000                                            │
└───────────────────────┬─────────────────────────────────┘
                        │ GraphQL (HTTP / JWT Bearer)
                        ▼
┌─────────────────────────────────────────────────────────┐
│              apps/api  (Apollo Server 4)                │
│  Node.js 20 · TypeScript ESM · Sequelize 6              │
│  Puerto 4000                                            │
└──────────┬────────────────────────────┬─────────────────┘
           │ SQL                        │ HTTP (al arrancar)
           ▼                            ▼
┌──────────────────┐        ┌──────────────────────────┐
│   PostgreSQL 15  │        │    CCILicenseServer       │
│   Puerto 5432    │        │    Puerto 4100            │
└──────────────────┘        └──────────────────────────┘
```

---

## Estructura del monorepo

```
project_fuelTrack/
├── apps/
│   ├── web/                    ← Frontend Next.js
│   │   └── src/
│   │       ├── app/            ← Rutas (App Router)
│   │       ├── components/     ← UI reutilizable
│   │       ├── context/        ← AuthContext (JWT)
│   │       ├── hooks/          ← useAuth
│   │       ├── lib/            ← apollo-client, utils
│   │       ├── services/       ← GQL queries/mutations por módulo
│   │       └── types/          ← Tipos TypeScript
│   └── api/
│       └── src/
│           ├── graphql/
│           │   ├── schemas/    ← SDL .graphql por entidad
│           │   └── resolvers/  ← Resolvers por entidad
│           ├── models/         ← Modelos Sequelize
│           ├── middleware/     ← Auth JWT, autorización
│           └── utils/          ← licenseValidator, authUtils
├── packages/                   ← (futuro) tipos compartidos
├── docs/                       ← Esta documentación
├── docker-compose.yml          ← Stack completo
├── turbo.json                  ← Configuración Turborepo
├── pnpm-workspace.yaml         ← Workspaces
└── CLAUDE.md                   ← Spec técnico para el asistente de IA
```

---

## Flujo de autenticación

```
1. Usuario ingresa credenciales en /admin-login o /login
2. Frontend llama mutation `login(username, password)`
3. API valida credenciales → hashea password con bcryptjs → genera JWT
4. Frontend almacena JWT en localStorage
5. Apollo Client adjunta JWT como Bearer token en cada request
6. API middleware verifica JWT en cada resolver protegido
7. AuthContext en React mantiene el estado del usuario autenticado
```

### Roles de usuario

| Role | Acceso |
|---|---|
| `ADMIN` | Panel admin completo |
| `MANAGER` | Panel admin (parcial) + Panel estación |
| `EMPLOYEE` | Panel estación |

### Tipos de usuario (userType)

`Administrator`, `Supervisor`, `Cashier`, `FuelAttendant`, `Administrative`

El `userType` determina el rol en el turno (`employeeRole`): Cajero, Bombero, Supervisor, etc.

---

## Flujo de validación de licencia

Al arrancar la API:

```
1. apps/api lee FINGERPRINT_PATH (hash del hardware de la máquina)
2. Envía { licenseKey, fingerprint } a LICENSE_SERVER_URL
3. CCILicenseServer verifica que el fingerprint coincida con la licencia
4. Si no es válida → la API no arranca
5. En Docker: docker-entrypoint.sh genera el fingerprint desde
   dev-machine-id.md y dev-mac-address.md (valores fijos de desarrollo)
```

---

## Decisiones técnicas clave

### Apollo Client v4 — subpath imports obligatorios
```typescript
// ✅
import { useQuery, useMutation } from '@apollo/client/react'
import { gql } from '@apollo/client'
import { createHttpLink } from '@apollo/client/link/http'
// ❌ — causa errores en v4
import { useQuery } from '@apollo/client'
```

### Tailwind v4 — sin archivo de configuración
No existe `tailwind.config.ts`. El tema se define en `globals.css` con `@theme inline` y variables CSS custom properties.

### shadcn/ui base-nova — sin `asChild`
La variante base-nova usa `@base-ui/react` en lugar de Radix UI. No existe la prop `asChild`. Para botones que navegan, usar `onClick + useRouter`.

### Enums Sequelize + GraphQL — valores idénticos
El valor string del enum TypeScript **debe ser idéntico** al nombre del enum en el schema `.graphql`. Si difieren, la DB guarda el valor descriptivo pero GraphQL no puede deserializarlo.

```typescript
// ✅
export enum SalesTicketStatus {
  PENDING_PAYMENT_DISPATCH = "PENDING_PAYMENT_DISPATCH",
}
```

### Zod v3 — inputs numéricos en formularios
```typescript
// ✅ — usar string + refine en Zod v3
priceField: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0)
// ❌ — z.coerce.number() tiene input type `unknown` en v3, rompe el Resolver
priceField: z.coerce.number().positive()
```

---

## Gestión de monedas y tasas de cambio

El sistema permite operar en múltiples monedas simultáneamente. La convención de `exchangeRate`:

```
amount / exchangeRate = monto en moneda base
```

- La moneda con `exchangeRate = 1` es la moneda base implícita (típicamente USD)
- Cada **pago** guarda un snapshot `exchangeRateAtPayment` para preservar el historial de tasas
- Al comparar si un ticket está pagado, todos los montos se convierten a base usando sus snapshots
