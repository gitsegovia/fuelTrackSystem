# syntax=docker/dockerfile:1
#
# Context de build: raíz del monorepo (ver docker-compose.yml — context: .,
# dockerfile: apps/station/Dockerfile). El código de la app se toma del context
# nombrado "appsrc" (apps/station), que respeta apps/station/.dockerignore.

# ---- Base Stage ----
FROM node:22-alpine AS base
WORKDIR /app
ENV CI=true
RUN corepack enable pnpm

# ---- Deps Stage ----
# Instala con el pnpm-lock.yaml raíz del monorepo, filtrado al paquete "station",
# para builds reproducibles (pnpm install --frozen-lockfile).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY --from=appsrc package.json apps/station/package.json
RUN pnpm install --frozen-lockfile --filter station... --ignore-scripts

# ---- Builder Stage ----
# VITE_GRAPHQL_URI se bake en el bundle en tiempo de build.
# Pásalo como build-arg: --build-arg VITE_GRAPHQL_URI=https://api.tudominio.com/graphql
FROM deps AS builder
ARG VITE_GRAPHQL_URI=http://localhost:4000/graphql
ENV VITE_GRAPHQL_URI=$VITE_GRAPHQL_URI

COPY --from=appsrc . apps/station/
RUN pnpm --filter station build

# ---- Production Stage ----
# Sirve el SPA estático con nginx. El SW y React Router requieren
# que todas las rutas respondan con index.html (ver nginx.conf).
FROM nginx:alpine AS production
COPY --from=builder /app/apps/station/dist /usr/share/nginx/html
COPY --from=appsrc nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ---- Development Stage ----
# Vite dev server con HMR. --host expone en 0.0.0.0 para ser
# accesible desde fuera del contenedor Docker.
FROM deps AS development
ENV NODE_ENV=development
COPY --from=appsrc . apps/station/
RUN pnpm --filter station rebuild esbuild
EXPOSE 3001
CMD ["pnpm", "--filter", "station", "exec", "vite", "--port", "3001", "--host"]
