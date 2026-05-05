# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root manifests
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/ ./packages/

# Install dependencies
RUN npm install --workspace=@cdc/web --include-workspace-root

# Copy web source
COPY apps/web/ ./apps/web/

# API_URL must be available at build time so Next.js compiles the correct
# rewrite destination into the route manifest (rewrites are evaluated during
# next build, not at runtime)
ENV API_URL=http://api:3001

# Build Next.js (output: standalone)
WORKDIR /app/apps/web
RUN npm run build

# ── Stage 2: Runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output already bundles only needed node_modules
COPY --from=builder /app/apps/web/.next/standalone ./

# In a monorepo, server.js lives at apps/web/server.js and expects
# static + public relative to that path, NOT the container root
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
