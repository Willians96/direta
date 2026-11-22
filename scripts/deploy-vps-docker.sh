#!/usr/bin/env bash
# ============================================================
# GESCOLA — deploy na VPS compartilhada (Docker + Traefik)
#
# Executa na VPS, dentro de /opt/gescola/app:
#   bash scripts/deploy-vps-docker.sh
#
# Fluxo:
#   1. git pull da main
#   2. docker compose build (rebuild da imagem)
#   3. prisma migrate deploy
#   4. docker compose up -d (recria o container do app)
#   5. health check em http://127.0.0.1:3000/api/health
#
# O banco (container gescola-postgres) NUNCA é recriado aqui:
# ele vive em /opt/gescola/db/pgdata e é preservado.
# ============================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/gescola/app}"
COMPOSE="docker compose -f docker-compose.vps.yml --env-file .env.vps"
HEALTH_URL="http://127.0.0.1:3000/api/health"
MAX_TENTATIVAS=15

cd "$APP_DIR"

log() { echo -e "\n==> $1"; }

log "atualizando codigo"
git pull --ff-only origin main
echo "    commit: $(git rev-parse --short HEAD)"

log "build da imagem"
$COMPOSE build app

log "migrations do Prisma"
$COMPOSE run --rm migrate

log "subindo o app"
$COMPOSE up -d app

log "health check ($HEALTH_URL)"
for i in $(seq 1 $MAX_TENTATIVAS); do
  sleep 4
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo -e "\n    aplicacao saudavel (tentativa $i)"
    $COMPOSE ps
    exit 0
  fi
  echo "    aguardando... ($i/$MAX_TENTATIVAS)"
done

echo -e "\nA aplicacao nao respondeu ao health check."
$COMPOSE logs app --tail 40 || true
exit 1
