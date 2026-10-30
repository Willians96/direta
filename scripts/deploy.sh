#!/usr/bin/env bash
# ============================================================
# GESCOLA — Deploy da aplicação na VPS
# Executa na VPS, dentro de $APP_DIR (/var/app)
#
# Uso:
#   cd /var/app && bash scripts/deploy.sh
#
# O que faz:
#   1. git pull da main
#   2. pnpm install --frozen-lockfile
#   3. pnpm prisma migrate deploy
#   4. pnpm build
#   5. pm2 reload (com --update-env) + pm2 save
#   6. health check em /api/health (aguarda subir)
#
# Variáveis opcionais:
#   APP_DIR  (padrão /var/app)
#   SKIP_BUILD=1  pula o build (ex.: só rodar migrations)
# ============================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/var/app}"
APP_NAME="gescola"
APP_USER="${APP_USER:-deploy}"
HEALTH_URL="http://127.0.0.1:3000/api/health"
MAX_TENTATIVAS=12

cd "$APP_DIR"

log() { echo -e "\n\033[1;33m==> $1\033[0m"; }

# PM2 sempre como o usuário de serviço (o app não roda como root)
run_pm2() {
  if [ "$(id -u)" -eq 0 ]; then
    sudo -u "$APP_USER" -H pm2 "$@"
  else
    pm2 "$@"
  fi
}

log "Atualizando código"
git pull --ff-only origin main

log "Preparando pnpm (corepack)"
corepack enable 2>/dev/null || true
corepack prepare pnpm@12.4.1 --activate 2>/dev/null || true
pnpm --version

log "Instalando dependências"
pnpm install --frozen-lockfile

log "Aplicando migrations do Prisma"
pnpm prisma migrate deploy

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  log "Buildando a aplicação"
  pnpm build
fi

log "Recarregando o PM2"
if run_pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  run_pm2 reload ecosystem.config.js --update-env
else
  run_pm2 start ecosystem.config.js --update-env
fi
run_pm2 save

log "Health check ($HEALTH_URL)"
for i in $(seq 1 $MAX_TENTATIVAS); do
  sleep 3
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo -e "\033[1;32m    aplicação saudável (tentativa $i)\033[0m"
    run_pm2 status
    exit 0
  fi
  echo "    aguardando... ($i/$MAX_TENTATIVAS)"
done

echo -e "\n\033[1;31mA aplicação não respondeu ao health check.\033[0m"
echo "Logs recentes:"
run_pm2 logs "$APP_NAME" --lines 40 --nostream || true
exit 1
