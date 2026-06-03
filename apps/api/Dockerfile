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
COPY package*.json ./
RUN npm install
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

CMD ["npm", "start"]


# ---- Development Stage ----
FROM base AS development
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "start:dev"]