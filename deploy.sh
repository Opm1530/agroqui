#!/bin/sh
# Deploy sequencial — evita OOM em VPS com pouca RAM.
# Uso: ./deploy.sh
set -e

echo "==> Pulling latest code..."
git pull

echo "==> Building API..."
docker compose build api

echo "==> Building Web..."
docker compose build web

echo "==> Starting services..."
docker compose up -d

echo "==> Done."
