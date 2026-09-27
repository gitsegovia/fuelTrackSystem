# syntax=docker/dockerfile:1
#
# Context de build: raíz del monorepo (ver docker-compose.yml — context: .,
# dockerfile: apps/web/Dockerfile). El código de la app se toma del context
# nombrado "appsrc" (apps/web), que respeta apps/web/.dockerignore.

# ---- Base Stage ----
FROM node:22-alpine AS base
WORKDIR /app
ENV CI=true
RUN corepack enable pnpm

# ---- Deps Stage ----
# Instala con el pnpm-lock.yaml raíz del monorepo, filtrado al paquete "web",
# para builds reproducibles (pnpm install --frozen-lockfile).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY --from=appsrc package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter web... --ignore-scripts

# ---- Builder Stage ----
FROM deps AS builder
COPY --from=appsrc . apps/web/
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

# ---- Production Stage ----
# output: 'standalone' (next.config.ts) traza dependencias desde la raíz del
# monorepo (encuentra pnpm-lock.yaml en /app), por eso .next/standalone
# reproduce la ruta apps/web/server.js con node_modules ya hoisted.
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]

# ---- Development Stage ----
FROM deps AS development
ENV NODE_ENV=development
COPY --from=appsrc . apps/web/
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "dev"]
