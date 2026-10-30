#!/usr/bin/env bash
# ============================================================
# GESCOLA — Setup inicial da VPS (Hostinger KVM · Ubuntu 22.04 / 24.04 LTS)
# Executar UMA VEZ em uma VPS limpa, como root.
#
# Uso (sem domínio, fase atual — acesso por IP):
#   chmod +x scripts/setup-vps.sh
#   sudo env DOMAIN="" ./scripts/setup-vps.sh
#
# Uso (quando tiver domínio):
#   sudo env DOMAIN="app.seudominio.com.br" ./scripts/setup-vps.sh
#
# Variáveis de ambiente opcionais:
#   DOMAIN      — domínio do app; vazio = acesso por IP temporário
#   APP_USER    — usuário de sistema do app (padrão: deploy)
#   APP_DIR     — diretório da aplicação (padrão: /var/app)
#   DB_NAME     — nome do banco (padrão: gescola)
#   DB_USER     — usuário do banco (padrão: gescola_app)
#   DB_PASSWORD — senha do banco (padrão: gerada automaticamente)
#
# Stack instalada (nativa, SEM Docker — mais leve para VPS de 2–4 GB):
#   Node.js 20 LTS + pnpm 12 + PM2 + Nginx + PostgreSQL 16 + UFW + Fail2ban
#
# Idempotente: pode rodar de novo sem quebrar o que já existe.
# ============================================================

set -euo pipefail

APP_USER="${APP_USER:-deploy}"
APP_NAME="gescola"
APP_DIR="${APP_DIR:-/var/app}"
DOMAIN="${DOMAIN:-}"                 # vazio => acesso por IP temporário
SERVER_NAME="${DOMAIN:-_}"           # server_name do Nginx
DB_NAME="${DB_NAME:-gescola}"
DB_USER="${DB_USER:-gescola_app}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)}"
PG_MAJOR_DEFAULT="16"
NODE_MAJOR="20"
PNPM_VERSION="12.4.1"

log()  { echo -e "\n\033[1;33m==> $1\033[0m"; }
info() { echo "    $1"; }
fail() { echo -e "\n\033[1;31mERRO: $1\033[0m" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail " rode como root (sudo)"

log "GESCOLA — Setup da VPS ($APP_NAME)"
info "usuário: $APP_USER | app: $APP_DIR | domínio: ${DOMAIN:-(temporário por IP)}"

# --- 1. Usuário de sistema do app -------------------------------------------
if ! id "$APP_USER" &>/dev/null; then
  log "1/13 Criando usuário '$APP_USER'"
  adduser --disabled-password --gecos "" "$APP_USER"
  echo "$APP_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$APP_USER
  chmod 440 /etc/sudoers.d/$APP_USER
else
  log "1/13 Usuário '$APP_USER' já existe"
fi

# --- 2. Sistema -------------------------------------------------------------
log "2/13 Atualizando o sistema"
export DEBIAN_FRONTEND=noninteractive
apt update -qq && apt upgrade -y -qq

# --- 3. Pacotes -------------------------------------------------------------
log "3/13 Instalando pacotes (nginx, postgres, certbot, fail2ban...)"
apt install -y -qq curl wget git ufw fail2ban nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib postgresql-client build-essential gzip rsync

# --- 4. Node.js + pnpm ------------------------------------------------------
log "4/13 Instalando Node.js $NODE_MAJOR LTS + pnpm $PNPM_VERSION"
if ! command -v node &>/dev/null; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt install -y -qq nodejs
fi
info "node $(node --version)"
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate
info "pnpm $(pnpm --version)"

# --- 5. PM2 -----------------------------------------------------------------
log "5/13 Instalando PM2"
sudo -u "$APP_USER" bash -c "npm install -g pm2@latest"
# PM2 como usuário de serviço (o app roda como "$APP_USER", não como root)
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null 2>&1 || true
systemctl enable "pm2-${APP_USER}" >/dev/null 2>&1 || true
sudo -u "$APP_USER" -H pm2 save >/dev/null 2>&1 || true

# --- 6. Swap (VPS pequena: Postgres + build do Next.js) --------------------
log "6/13 Configurando swap"
RAM_MB=$(free -m | awk '/^Mem:/ {print $2}')
if [ "$RAM_MB" -lt 4096 ] && [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  info "swap de 2GB criado (RAM detectada: ${RAM_MB}MB)"
else
  info "swap dispensado (RAM: ${RAM_MB}MB ou swap já existente)"
fi

# --- 7. PostgreSQL ----------------------------------------------------------
log "7/13 Configurando PostgreSQL"
PG_MAJOR=$(ls /etc/postgresql 2>/dev/null | sort -V | tail -1)
PG_MAJOR="${PG_MAJOR:-$PG_MAJOR_DEFAULT}"
if ! systemctl is-active --quiet postgresql; then
  systemctl enable --now postgresql
fi

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "ALTER USER ${DB_USER} CREATEDB;" >/dev/null

# Só aceita conexão local com senha (nunca expor a porta 5432 na internet)
PG_HBA="/etc/postgresql/${PG_MAJOR}/main/pg_hba.conf"
if ! grep -q "host ${DB_NAME} ${DB_USER} 127.0.0.1/32" "$PG_HBA"; then
  echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    scram-sha-256" >> "$PG_HBA"
fi

# Tuning conforme a RAM da VPS
PG_CONF_DIR="/etc/postgresql/${PG_MAJOR}/main/conf.d"
mkdir -p "$PG_CONF_DIR"
SHARED_BUFFERS=$(( RAM_MB / 4 )); [ "$SHARED_BUFFERS" -gt 2048 ] && SHARED_BUFFERS=2048
[ "$SHARED_BUFFERS" -lt 128 ] && SHARED_BUFFERS=128
EFFECTIVE_CACHE=$(( RAM_MB / 2 ))
WORK_MEM=$(( RAM_MB / 32 )); [ "$WORK_MEM" -lt 4 ] && WORK_MEM=4
[ "$WORK_MEM" -gt 32 ] && WORK_MEM=32
cat > "${PG_CONF_DIR}/99-gescola.conf" <<EOF
# Gerado por scripts/setup-vps.sh — RAM detectada: ${RAM_MB} MB
shared_buffers = ${SHARED_BUFFERS}MB
effective_cache_size = ${EFFECTIVE_CACHE}MB
work_mem = ${WORK_MEM}MB
maintenance_work_mem = 64MB
max_connections = 50
listen_addresses = 'localhost'
timezone = 'America/Sao_Paulo'
EOF
systemctl restart postgresql
info "PostgreSQL ${PG_MAJOR} pronto (shared_buffers=${SHARED_BUFFERS}MB)"

# --- 8. Diretórios ----------------------------------------------------------
log "8/13 Criando diretórios"
mkdir -p "$APP_DIR" "$APP_DIR/storage" /var/backups/pg /var/backups/storage /var/log/pm2
chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/log/pm2 /var/backups

# --- 9. Firewall ------------------------------------------------------------
log "9/13 Configurando firewall (UFW)"
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# --- 10. Fail2ban -----------------------------------------------------------
log "10/13 Configurando Fail2ban"
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/auth.log
EOF
systemctl restart fail2ban

# --- 11. Nginx (proxy reverso) ---------------------------------------------
log "11/13 Configurando Nginx"
cat > /etc/nginx/sites-available/$APP_NAME <<EOF
# Gerado por scripts/setup-vps.sh
# Acesso temporário por IP. Quando tiver domínio, troque 'server_name _;'
# por 'server_name ${DOMAIN};' e rode: certbot --nginx -d ${DOMAIN}
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SERVER_NAME};

    client_max_body_size 20M;              # upload de documentos
    server_tokens off;

    # cabeçalhos de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }

    # documentos ficam fora do webroot público
    location /storage/ { deny all; }
}
EOF
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/$APP_NAME
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl enable nginx

# --- 12. Backup automático --------------------------------------------------
log "12/13 Configurando backup diário (banco + documentos)"
cat > /etc/cron.daily/backup-gescola <<EOF
#!/bin/bash
set -euo pipefail
STAMP=\$(date +\%Y\%m\%d-\%H\%M)
pg_dump -U ${DB_USER} -h 127.0.0.1 ${DB_NAME} | gzip > /var/backups/pg/gescola-\${STAMP}.sql.gz
tar -czf /var/backups/storage/storage-\${STAMP}.tar.gz -C ${APP_DIR} storage
find /var/backups/pg -mtime +30 -delete
find /var/backups/storage -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/backup-gescola

cat > /etc/logrotate.d/pm2-$APP_NAME <<EOF
/var/log/pm2/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $APP_USER $APP_USER
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# --- 13. Modelo de .env.production -----------------------------------------
log "13/13 Gerando modelo de .env.production"
if [ ! -f "$APP_DIR/.env.production" ]; then
  cat > "$APP_DIR/.env.production" <<EOF
# ===== GESCOLA — ambiente de produção na VPS =====
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"
AUTH_SECRET="TROQUE_POR_$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 40)"
AUTH_URL="http://SEU_IP_DA_VPS:3000"
AUTH_TRUST_HOST="true"
STORAGE_PATH="${APP_DIR}/storage"
NODE_ENV="production"
EOF
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env.production"
  chmod 600 "$APP_DIR/.env.production"
  info "criado $APP_DIR/.env.production (ajuste AUTH_URL com o IP público)"
fi

log "Setup concluído ✅"
cat <<EOF

📋 Próximos passos
   1. Publique o código:
        cd $APP_DIR
        git clone https://github.com/Willians96/direta.git .
   2. Ajuste o .env.production (AUTH_URL com o IP público da VPS)
   3. Instale as dependências e rode as migrations:
        cd $APP_DIR
        corepack enable && pnpm install --frozen-lockfile
        pnpm prisma migrate deploy
   4. Suba a aplicação:
        pnpm build
        pm2 start ecosystem.config.js --update-env && pm2 save
   5. Teste:
        curl http://127.0.0.1:3000/api/health
        (e via navegador: http://SEU_IP_DA_VPS/api/health)

🔐 Credenciais geradas (guarde em local seguro)
   DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"
   DB_PASSWORD=${DB_PASSWORD}

🔒 Sua senha de root do MySQL/Postgres do painel Hostinger NÃO é usada aqui:
   esta é a senha do PostgreSQL do sistema (rodando dentro da VPS).
EOF
