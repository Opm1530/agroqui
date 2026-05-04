#!/bin/bash
set -e

echo "🚜 Contador do Campo — Deploy"
echo "================================"

# Garante que o .env existe
if [ ! -f .env ]; then
  echo "❌ Arquivo .env não encontrado. Copie .env.example e preencha."
  exit 1
fi

echo "▶ Baixando atualizações..."
git pull origin main

echo "▶ Fazendo build das imagens..."
docker compose build --no-cache

echo "▶ Subindo serviços (banco e redis primeiro)..."
docker compose up -d postgres redis

echo "▶ Aguardando banco ficar saudável..."
docker compose run --rm api sh -c "
  until pg_isready -h postgres -U \$POSTGRES_USER -d \$POSTGRES_DB; do
    echo 'Aguardando postgres...'
    sleep 2
  done
" 2>/dev/null || sleep 10

echo "▶ Subindo todos os serviços..."
docker compose up -d

echo "▶ Verificando status..."
docker compose ps

echo ""
echo "✅ Deploy concluído!"
echo "   Web: https://\$(grep FRONTEND_URL .env | cut -d= -f2 | sed 's/https:\/\///')"
echo "   API: https://\$(grep NEXT_PUBLIC_API_URL .env | cut -d= -f2 | sed 's/https:\/\///')"
echo ""
echo "📋 Logs em tempo real: docker compose logs -f"
