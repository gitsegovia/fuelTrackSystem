# ---- Base Stage ----
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable pnpm

# ---- Builder Stage ----
FROM base AS builder
COPY package.json ./
RUN pnpm install --no-frozen-lockfile --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- Production Stage ----
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]

# ---- Development Stage ----
FROM base AS development
ENV NODE_ENV=development
COPY package.json ./
RUN pnpm install --no-frozen-lockfile --ignore-scripts
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]
