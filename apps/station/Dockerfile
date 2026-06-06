# ---- Base Stage ----
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable pnpm

# ---- Builder Stage ----
# VITE_GRAPHQL_URI se bake en el bundle en tiempo de build.
# Pásalo como build-arg: --build-arg VITE_GRAPHQL_URI=https://api.tudominio.com/graphql
FROM base AS builder
ARG VITE_GRAPHQL_URI=http://localhost:4000/graphql
ENV VITE_GRAPHQL_URI=$VITE_GRAPHQL_URI

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build

# ---- Production Stage ----
# Sirve el SPA estático con nginx. El SW y React Router requieren
# que todas las rutas respondan con index.html (ver nginx.conf).
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ---- Development Stage ----
# Vite dev server con HMR. --host expone en 0.0.0.0 para ser
# accesible desde fuera del contenedor Docker.
FROM base AS development
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
EXPOSE 3001
CMD ["pnpm", "exec", "vite", "--port", "3001", "--host"]
