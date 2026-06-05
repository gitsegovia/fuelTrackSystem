# Configuración del entorno de desarrollo

## Prerrequisitos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | 20 | Motor requerido por ambas apps |
| pnpm | 11 | Gestor de paquetes del monorepo |
| Docker + Docker Compose | — | Para levantar el stack completo |
| CCILicenseServer | — | Servidor de licencias CCI (proceso separado) |

---

## Opción A — Docker (recomendado)

La forma más rápida de tener el stack completo funcionando.

### 1. Copiar templates de entorno

```bash
cp .env.demo.example     .env.demo
cp apps/api/.env.docker.example  apps/api/.env.docker
```

### 2. Editar `.env.demo`

```env
DB_USER=postgres
DB_PASS=<contraseña segura>
DB_DATABASE=fueltrack
DB_HOST_PORT=5433
API_PORT=4000
```

### 3. Editar `apps/api/.env.docker`

```env
NODE_ENV=development
PORT=3000
DB_DATABASE=fueltrack
DB_USER=postgres
DB_PASS=<mismo que DB_PASS arriba>
DB_HOST=db
DB_PORT=5432
JWT_SECRET=<cadena aleatoria larga>
LICENSE_KEY=DEV-LICENSE-KEY-12345
LICENSE_SERVER_URL=http://host.docker.internal:4100
FINGERPRINT_PATH=/etc/fueltrack/fingerprint
```

### 4. Generar secretos

```powershell
# PowerShell — genera una cadena aleatoria de alta entropía
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Usar valores distintos para `DB_PASS` y `JWT_SECRET`.

### 5. Levantar el stack

```bash
# Entorno demo (desarrollo con hot-reload)
docker compose --env-file .env.demo -f docker-compose.yml -f docker-compose.demo.yml up --build

# Entorno producción
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up --build
```

El stack levanta:
- `web` → http://localhost:3000
- `api` → http://localhost:4000/graphql
- `db` (PostgreSQL) → localhost:5433

---

## Opción B — Desarrollo local (sin Docker)

Requiere PostgreSQL instalado localmente y el CCILicenseServer corriendo.

### 1. Variables de entorno

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_GRAPHQL_URI=http://localhost:4000/graphql
NEXT_PUBLIC_JWT_SECRET=<mismo valor que JWT_SECRET de la API>
```

**`apps/api/.env`**
```env
NODE_ENV=development
PORT=4000
DB_DATABASE=fueltrack
DB_USER=postgres
DB_PASS=<tu contraseña local>
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=<cadena aleatoria larga>
LICENSE_KEY=DEV-LICENSE-KEY-12345
LICENSE_SERVER_URL=http://localhost:4100
FINGERPRINT_PATH=C:\ProgramData\fueltrack\fingerprint
```

### 2. Fingerprint de desarrollo

El archivo de fingerprint contiene el hash que el CCILicenseServer espera para la clave `DEV-LICENSE-KEY-12345`:

```powershell
New-Item -ItemType Directory -Force "C:\ProgramData\fueltrack" | Out-Null
Set-Content -Path "C:\ProgramData\fueltrack\fingerprint" `
  -Value "ead4940f77dacd63b34342249f66ed228c7f4692d84ea455548bc9692de88281" `
  -NoNewline
```

### 3. Crear la base de datos

```bash
# Con psql o pgAdmin, crear la base:
CREATE DATABASE fueltrack;
```

### 4. Correr migraciones y seeds

```bash
cd apps/api
pnpm sequelize db:migrate
pnpm sequelize db:seed:all
```

### 5. Levantar las apps

```bash
# Terminal 1 — API (http://localhost:4000/graphql)
cd apps/api && pnpm dev

# Terminal 2 — Web (http://localhost:3000)
cd apps/web && pnpm dev

# CCILicenseServer debe estar corriendo en localhost:4100
```

---

## Migraciones de base de datos

```bash
cd apps/api

pnpm sequelize db:migrate          # Aplicar migraciones pendientes
pnpm sequelize db:migrate:undo     # Revertir última migración
pnpm sequelize db:seed:all         # Cargar todos los seeds
pnpm sequelize db:seed:undo:all    # Revertir todos los seeds
```

Las migraciones están en `apps/api/sequelize/migrations/` y los seeds en `apps/api/sequelize/seeders/`.

---

## Puertos de referencia

| Servicio | Desarrollo local | Docker externo |
|---|---|---|
| apps/web | 3000 | 3000 |
| apps/api | 4000 | 4000 |
| PostgreSQL | 5432 (local) | 5433 |
| CCILicenseServer | 4100 | 4100 |
