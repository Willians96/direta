#!/usr/bin/env bash
# Deploy manual (usado pelo GitHub Actions ou manualmente via SSH)
# Uso: ./scripts/deploy.sh

set -euo pipefail

APP_DIR="/var/app"
cd "$APP_DIR"

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo "🗄️ Running migrations..."
pnpm prisma migrate deploy

echo "🔨 Building..."
pnpm build

echo "♻️  Reloading PM2..."
pm2 reload ecosystem.config.js

echo "✅ Deploy concluído!"
pm2 status
