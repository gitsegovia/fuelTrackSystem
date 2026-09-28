# ---- Base Stage ----
# Usado para instalar dependencias y configuraciones comunes a dev y prod.
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Instala las herramientas de cliente de PostgreSQL, que incluyen pg_isready.
# 'apk add --no-cache' es el comando para Alpine Linux.
RUN apk update && apk add --no-cache postgresql-client

# Copia el entrypoint y dale permisos de ejecución.
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]


# ---- Builder Stage ----
# Etapa dedicada a construir la aplicación TypeScript a JavaScript.
FROM base AS builder
COPY package*.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build


# ---- Production Stage ----
# Etapa final y ligera para producción.
FROM base AS production
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

# Copia el código compilado desde la etapa 'builder'.
COPY --from=builder /usr/src/app/dist ./dist

# docker-entrypoint.sh corre "npx sequelize-cli db:migrate" (y el seed) ANTES de
# arrancar la app, usando esta imagen — sequelize-cli no lee TypeScript, así
# que necesita el .sequelizerc y el directorio sequelize/ (config/migrations/
# seeders) tal cual, no lo que compila tsc a dist/. Sin esto, "db:migrate"
# falla con "Cannot find config/config.json" (T-028).
COPY --from=builder /usr/src/app/.sequelizerc ./.sequelizerc
COPY --from=builder /usr/src/app/sequelize ./sequelize

# ⚠ "npm start" (= "node dist/app.js") falla con ERR_UNSUPPORTED_DIR_IMPORT
# ("import './config'" sin extensión) — verificado en T-028, ver el reporte y
# el hallazgo nuevo para ft-api/ft-core. --experimental-specifier-resolution
# ya no tiene efecto en Node 20.20 (probado, no lo arregla), y el fix real
# requiere tocar tsconfig/imports de apps/api/src, fuera de mi área. No se
# toca el CMD aquí para no esconder el bug con un flag que no hace nada.
CMD ["npm", "start"]


# ---- Development Stage ----
FROM base AS development
ENV NODE_ENV=development
COPY package*.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "start:dev"]