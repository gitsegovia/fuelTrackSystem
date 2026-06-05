# Guía de despliegue

## Entornos disponibles

| Entorno | Archivo compose | Archivo env | Descripción |
|---|---|---|---|
| Demo / Dev | `docker-compose.demo.yml` | `.env.demo` | Hot-reload, código montado como volumen |
| Producción | `docker-compose.prod.yml` | `.env.prod` | Builds optimizados, sin código fuente expuesto |

---

## Despliegue en producción

### 1. Preparar archivos de entorno

```bash
cp .env.prod.example .env.prod
cp apps/api/.env.docker.example apps/api/.env.docker
```

Editar `.env.prod`:
```env
DB_USER=postgres
DB_PASS=<contraseña muy segura, mínimo 32 caracteres>
DB_DATABASE=fueltrack
DB_HOST_PORT=5433
API_PORT=4000
```

Editar `apps/api/.env.docker`:
```env
NODE_ENV=production
PORT=3000
DB_DATABASE=fueltrack
DB_USER=postgres
DB_PASS=<mismo que DB_PASS arriba>
DB_HOST=db
DB_PORT=5432
JWT_SECRET=<cadena aleatoria de alta entropía, mínimo 64 caracteres>
LICENSE_KEY=<clave de licencia emitida por CCI>
LICENSE_SERVER_URL=<URL del CCILicenseServer de producción>
FINGERPRINT_PATH=/etc/fueltrack/fingerprint
```

### 2. Levantar el stack

```bash
docker compose \
  --env-file .env.prod \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up --build -d
```

### 3. Aplicar migraciones

```bash
docker compose exec api pnpm sequelize db:migrate
```

### 4. Verificar el estado

```bash
docker compose ps
docker compose logs api --tail 50
docker compose logs web --tail 50
```

---

## Variables de entorno — referencia completa

### `.env` (raíz del monorepo — para interpolación de docker-compose)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_USER` | Usuario de PostgreSQL | `postgres` |
| `DB_PASS` | Contraseña de PostgreSQL | `<generada>` |
| `DB_DATABASE` | Nombre de la base de datos | `fueltrack` |
| `DB_HOST_PORT` | Puerto externo de PostgreSQL | `5433` |
| `API_PORT` | Puerto externo de la API | `4000` |

### `apps/api/.env.docker`

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NODE_ENV` | Entorno Node | `production` |
| `PORT` | Puerto interno de la API | `3000` |
| `DB_DATABASE` | Base de datos | `fueltrack` |
| `DB_USER` | Usuario DB | `postgres` |
| `DB_PASS` | Contraseña DB | `<generada>` |
| `DB_HOST` | Host de PostgreSQL (en Docker: nombre del servicio) | `db` |
| `DB_PORT` | Puerto interno de PostgreSQL | `5432` |
| `JWT_SECRET` | Secreto para firmar los JWT | `<generada>` |
| `LICENSE_KEY` | Clave de licencia CCI | `PROD-LICENSE-...` |
| `LICENSE_SERVER_URL` | URL del servidor de licencias | `https://licenses.corecodeinnovation.com` |
| `FINGERPRINT_PATH` | Ruta al archivo de fingerprint | `/etc/fueltrack/fingerprint` |

### `apps/web/.env.local` (solo desarrollo local)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NEXT_PUBLIC_GRAPHQL_URI` | URL del endpoint GraphQL | `http://localhost:4000/graphql` |
| `NEXT_PUBLIC_JWT_SECRET` | Mismo secreto que `JWT_SECRET` de la API | `<generada>` |

> En Docker, el web recibe estas variables directamente del `docker-compose.yml` — no se usa `.env.local`.

---

## Generación de secretos

```powershell
# PowerShell — cadena aleatoria de alta entropía
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# OpenSSL
openssl rand -hex 48
```

Usar valores **distintos** para `DB_PASS` y `JWT_SECRET`.

---

## CCILicenseServer

El servidor de licencias es un proceso independiente operado por CCI. La API lo consulta al arrancar para validar que la instalación esté autorizada.

- En desarrollo: usar `LICENSE_KEY=DEV-LICENSE-KEY-12345` con el CCILicenseServer de desarrollo local en el puerto 4100
- En producción: CCI emite una `LICENSE_KEY` específica para cada cliente y proporciona la URL del servidor

El fingerprint es un hash derivado del hardware de la máquina donde corre la API. En Docker, se genera automáticamente desde archivos de referencia (`dev-machine-id.md`, `dev-mac-address.md`) por el `docker-entrypoint.sh`.

---

## Mantenimiento

### Actualizar la aplicación

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up --build -d
docker compose exec api pnpm sequelize db:migrate
```

### Backup de la base de datos

```bash
docker compose exec db pg_dump -U postgres fueltrack > backup_$(date +%Y%m%d).sql
```

### Restaurar backup

```bash
docker compose exec -T db psql -U postgres fueltrack < backup_20260604.sql
```

### Ver logs en tiempo real

```bash
docker compose logs -f api
docker compose logs -f web
```
