# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# All workspace manifests (needed for npm ci workspace integrity)
COPY package.json package-lock.json ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY apps/api/package.json         ./apps/api/
COPY apps/web/package.json         ./apps/web/

RUN npm ci

COPY tsconfig.base.json ./
COPY apps/web ./apps/web

# VITE_API_URL is baked into the JS bundle at build time
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build -w apps/web

# ── Stage 2: Nginx ───────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
