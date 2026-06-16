# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only manifests first — Docker caches npm install until these change
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install deps (cached unless package.json changes)
RUN npm install --workspace=@cdc/api --include-workspace-root

# Copy schema separately so prisma generate is cached independently of npm install
COPY apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
RUN cd apps/api && npx prisma generate

# Now copy source (cache miss only when code changes, not deps)
COPY apps/api/ ./apps/api/

# Compile TypeScript
RUN cd apps/api && npm run build

# ── Stage 2: Runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "entrypoint.sh"]
