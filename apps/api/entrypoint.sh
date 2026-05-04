#!/bin/sh
set -e

echo "▶ Running Prisma migrations..."
# Passa DATABASE_URL explicitamente para ignorar prisma.config.ts
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "▶ Starting API server..."
exec node dist/server.js
