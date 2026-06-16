# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only manifests first — Docker caches npm install until these change
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install deps (cached unless package.json changes)
RUN npm install --workspace=@cdc/web --include-workspace-root

# Now copy source (cache miss only when code changes, not deps)
COPY apps/web/ ./apps/web/

# API_URL must be set at build time for Next.js rewrites
ENV API_URL=http://api:3001

WORKDIR /app/apps/web
RUN npm run build

# ── Stage 2: Runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
