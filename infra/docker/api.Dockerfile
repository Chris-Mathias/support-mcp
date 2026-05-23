# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Workspace manifests first (cache layer)
COPY package.json package-lock.json ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY apps/api/package.json         ./apps/api/

RUN npm ci

# Source code
COPY tsconfig.base.json ./
COPY prisma/ ./prisma/
COPY apps/mcp-server/src         ./apps/mcp-server/src
COPY apps/mcp-server/tsconfig.json ./apps/mcp-server/
COPY apps/api/src                ./apps/api/src
COPY apps/api/tsconfig.json      ./apps/api/

# Generate Prisma client (must match the node/alpine env for native binaries)
RUN npx prisma generate

# Build order matters: mcp-server → api (api imports from mcp-server dist)
RUN npm run build -w apps/mcp-server
RUN npm run build -w apps/api

# ── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Workspace manifests
COPY package.json package-lock.json ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY apps/api/package.json         ./apps/api/

# Install production deps only.
# npm workspaces creates the symlink:
#   node_modules/@support-mvp/mcp-server → ../../apps/mcp-server
# The mcp-server dist is copied below, so imports resolve correctly.
RUN npm ci --omit=dev

# Compiled artifacts
COPY --from=builder /app/apps/mcp-server/dist ./apps/mcp-server/dist
COPY --from=builder /app/apps/api/dist         ./apps/api/dist

# Prisma schema (needed by migrate deploy)
COPY --from=builder /app/prisma ./prisma

# Generated Prisma client (schema-specific files not produced by npm ci)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Startup script: runs migrations then starts the server
COPY infra/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /uploads

EXPOSE 3333

ENTRYPOINT ["/entrypoint.sh"]
