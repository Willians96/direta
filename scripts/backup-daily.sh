#!/usr/bin/env bash
# ============================================================
# GESCOLA — backup diário (banco + documentos)
#
# Roda na VPS por cron (root), em /opt/gescola/app:
#   0 4 * * * /opt/gescola/app/scripts/backup-daily.sh
#
# Saída:
#   /opt/gescola/backups/gescola-AAAAMMDD-HHMM.sql.gz   dump do Postgres
#   /opt/gescola/backups/storage-AAAAMMDD-HHMM.tar.gz   documentos enviados
#   /var/log/gescola-backup.log                          histórico
#
# O dump sai de dentro do container do Postgres, então o script
# não precisa da senha do banco. Nada do FarmaVet é tocado.
# ============================================================

set -uo pipefail

BACKUP_DIR="/opt/gescola/backups"
STORAGE_DIR="/opt/gescola/storage"
LOG="/var/log/gescola-backup.log"
STATUS="$BACKUP_DIR/.ultimo-status"
RETENCAO_DIAS=14
DB_CONTAINER="gescola-postgres"
DB_USER="gescola_app"
DB_NAME="gescola"

STAMP="$(date +%Y%m%d-%H%M)"
DUMP="$BACKUP_DIR/gescola-$STAMP.sql.gz"
TAR="$BACKUP_DIR/storage-$STAMP.tar.gz"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

mkdir -p "$BACKUP_DIR" "$STORAGE_DIR"

log "--- inicio do backup ($STAMP) ---"

# ---------- 1. dump do banco ----------
# Sai para .parcial e só vira .sql.gz se o dump vier íntegro:
# um arquivo pela metade é pior do que nenhum arquivo.
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
      --no-owner --no-privileges 2>>"$LOG" | gzip -9 > "$DUMP.parcial"; then

  TAM="$(stat -c%s "$DUMP.parcial")"
  if [ "$TAM" -lt 10000 ]; then
    log "ERRO: dump muito pequeno ($TAM bytes) — arquivo descartado"
    echo "falha|dump pequeno|$STAMP" > "$STATUS"
    exit 1
  fi

  # Confere que a tabela de usuários está dentro do dump: um dump vazio
  # ou truncado passa no teste de tamanho e só quebra na hora de restaurar.
  if ! gunzip -c "$DUMP.parcial" | grep -q "COPY public.users"; then
    log "ERRO: dump sem a tabela users — arquivo descartado"
    echo "falha|dump sem users|$STAMP" > "$STATUS"
    exit 1
  fi

  mv "$DUMP.parcial" "$DUMP"
  log "dump do banco ok: $DUMP ($TAM bytes)"
else
  log "ERRO: pg_dump falhou"
  echo "falha|pg_dump|$STAMP" > "$STATUS"
  exit 1
fi

# ---------- 2. documentos enviados (storage) ----------
if tar -czf "$TAR.parcial" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")" 2>>"$LOG"; then
  mv "$TAR.parcial" "$TAR"
  log "storage ok: $TAR ($(stat -c%s "$TAR") bytes)"
else
  log "AVISO: tar do storage falhou (o backup do banco foi feito)"
fi

# ---------- 3. limpeza dos backups antigos ----------
find "$BACKUP_DIR" -name 'gescola-*.sql.gz*'   -mtime +"$RETENCAO_DIAS" -delete 2>>"$LOG"
find "$BACKUP_DIR" -name 'storage-*.tar.gz*'    -mtime +"$RETENCAO_DIAS" -delete 2>>"$LOG"
log "retencao aplicada: ${RETENCAO_DIAS} dias"

# ---------- 4. status para o script de conferência ----------
echo "ok|$STAMP|$(stat -c%s "$DUMP")" > "$STATUS"
log "--- backup concluido ($STAMP) ---"
exit 0
