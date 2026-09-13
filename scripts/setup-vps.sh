#!/usr/bin/env bash
# ============================================================
# GESCOLA — Script de setup inicial da VPS Hostinger
# Executar UMA VEZ em uma VPS Ubuntu 22.04/24.04 LTS limpa
#
# Uso:
#   chmod +x scripts/setup-vps.sh
#   sudo ./scripts/setup-vps.sh
#
# Pré-requisitos:
#   - Acesso SSH com sudo
#   - DNS do domínio apontando para o IP da VPS (A record)
# ============================================================

set -euo pipefail

# Configurações (ajuste conforme necessário)
APP_USER="deploy"
APP_NAME="gescola"
APP_DIR="/var/app"
DOMAIN="${DOMAIN:-app.seudominio.com}"   # ajuste aqui
DB_NAME="gescola"
DB_USER="gescola_app"
DB_PASSWORD="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)"

echo ""
echo "🚀 Iniciando setup do $APP_NAME na VPS"
echo "   Usuário: $APP_USER"
echo "   Diretório: $APP_DIR"
echo "   Domínio: $DOMAIN"
echo ""

# --- 1. Criar usuário deploy (se não existir) ---
if ! id "$APP_USER" &>/dev/null; then
  echo "👤 Criando usuário $APP_USER..."
  adduser --disabled-password --gecos "" "$APP_USER"
  echo "$APP_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$APP_USER
  chmod 440 /etc/sudoers.d/$APP_USER
fi

# --- 2. Atualizar sistema ---
echo "📦 Atualizando sistema..."
apt update && apt upgrade -y

# --- 3. Instalar pacotes essenciais ---
echo "📦 Instalando pacotes essenciais..."
apt install -y curl wget git ufw fail2ban nginx certbot python3-certbot-nginx \
               postgresql postgresql-contrib build-essential

# --- 4. Instalar Node.js 20 LTS ---
echo "📦 Instalando Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

# --- 5. Instalar PM2 ---
echo "📦 Instalando PM2..."
sudo -u "$APP_USER" bash -c 'npm install -g pm2'

# --- 6. Configurar PostgreSQL ---
echo "🗄️ Configurando PostgreSQL..."
sudo -u postgres psql <<EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF

# Permitir conexão via 127.0.0.1 (NÃO expor externamente)
PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
if ! grep -q "host $DB_NAME $DB_USER 127.0.0.1/32" "$PG_HBA"; then
  echo "host    $DB_NAME    $DB_USER    127.0.0.1/32    scram-sha-256" >> "$PG_HBA"
fi
systemctl restart postgresql

# --- 7. Criar estrutura de diretórios ---
echo "📁 Criando estrutura..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/storage"
mkdir -p /var/backups/pg
mkdir -p /var/log/pm2
chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/log/pm2

# --- 8. Firewall ---
echo "🔒 Configurando firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# --- 9. Fail2ban ---
echo "🔒 Configurando fail2ban..."
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
EOF
systemctl restart fail2ban

# --- 10. Configurar Nginx (placeholder — ajustar após primeiro deploy) ---
echo "🌐 Configurando Nginx..."
cat > /etc/nginx/sites-available/$APP_NAME <<EOF
server {
    server_name $DOMAIN;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /storage/ { deny all; }
}
EOF

ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# --- 11. Backup automático do banco ---
echo "💾 Configurando backup diário..."
cat > /etc/cron.daily/backup-pg <<EOF
#!/bin/bash
pg_dump -U $DB_USER -h 127.0.0.1 $DB_NAME | gzip > /var/backups/pg/gescola-\$(date +\%Y\%m\%d-\%H\%M).sql.gz
find /var/backups/pg -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/backup-pg

# --- 12. Logrotate para PM2 ---
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

echo ""
echo "✅ Setup da VPS concluído!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Copie sua aplicação para $APP_DIR (git clone ou scp)"
echo "   2. Crie o arquivo $APP_DIR/.env.production com base em .env.example"
echo "   3. Execute: cd $APP_DIR && pnpm install && pnpm prisma migrate deploy"
echo "   4. Execute: cd $APP_DIR && pnpm prisma db seed"
echo "   5. Execute: cd $APP_DIR && pnpm build"
echo "   6. Inicie: pm2 start ecosystem.config.js && pm2 save"
echo "   7. Gere o SSL: sudo certbot --nginx -d $DOMAIN"
echo ""
echo "🔐 Senha do banco gerada (salve em local seguro!):"
echo "   DB_PASSWORD=$DB_PASSWORD"
echo "   DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME"
