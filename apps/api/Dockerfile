# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root manifests and workspace manifests
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/ ./packages/

# Install ALL dependencies (dev included for tsc + prisma generate)
RUN npm ci --workspace=@cdc/api --include-workspace-root

# Copy API source
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Compile TypeScript
RUN cd apps/api && npm run build

# ── Stage 2: Runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Copy compiled output
COPY --from=builder /app/apps/api/dist ./dist

# Copy prisma schema + migrations (needed for migrate deploy)
COPY --from=builder /app/apps/api/prisma ./prisma

# Copy node_modules (hoisted — contains @prisma/client, etc.)
COPY --from=builder /app/node_modules ./node_modules

# Copy api-level node_modules if any local ones exist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true

# Copy entrypoint
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3001

# dumb-init handles PID 1 and signal forwarding properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "entrypoint.sh"]
