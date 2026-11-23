#!/usr/bin/env bash
# ============================================================
# GESCOLA — prova de restauração do backup
#
# Pega o dump mais recente, restaura num banco de teste (dentro do
# próprio container do Postgres) e compara as contagens com o banco
# de produção. O banco de teste é descartado no final.
#
#   bash /opt/gescola/app/scripts/backup-verify.sh
#
# Serve para provar que o backup não é só "um arquivo": é um dump
# que volta. Rodar depois de criar o cron e de tempos em tempos.
# ============================================================

set -uo pipefail

BACKUP_DIR="/opt/gescola/backups"
LOG="/var/log/gescola-backup.log"
DB_CONTAINER="gescola-postgres"
DB_USER="gescola_app"
DB_NAME="gescola"
TEST_DB="gescola_backup_teste"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

DUMP="$(ls -1t "$BACKUP_DIR"/gescola-*.sql.gz 2>/dev/null | head -1)"
if [ -z "$DUMP" ]; then
  echo "ERRO: nenhum dump encontrado em $BACKUP_DIR"
  exit 1
fi

echo "dump em teste: $DUMP ($(stat -c%s "$DUMP") bytes)"

echo "preparando o banco de teste..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q \
  -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null 2>>"$LOG"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q \
  -c "CREATE DATABASE $TEST_DB;" >>"$LOG" 2>&1 || {
    echo "ERRO: nao foi possivel criar o banco de teste"
    exit 1
  }

echo "restaurando..."
if ! gunzip -c "$DUMP" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -q -v ON_ERROR_STOP=1 >/dev/null 2>>"$LOG"; then
  echo "ERRO: a restauracao falhou (detalhes em $LOG)"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null 2>&1
  exit 1
fi

echo
echo "tabela        producao   restaurado"
FALHOU=0
for T in users leads lead_messages courses classes; do
  A="$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM $T;" 2>/dev/null || echo '?')"
  B="$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -tAc "SELECT count(*) FROM $T;" 2>/dev/null || echo '?')"
  MARCA="ok"
  if [ "$A" != "$B" ]; then
    MARCA="DIVERGE"
    FALHOU=1
  fi
  printf "%-14s %-10s %-12s %s\n" "$T" "$A" "$B" "$MARCA"
done

echo
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q -c "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null 2>&1

if [ "$FALHOU" -eq 0 ]; then
  echo "RESULTADO: backup confere — o dump restaura com os mesmos dados."
  log "verificacao de backup ok ($DUMP)"
  exit 0
fi

echo "RESULTADO: divergencia entre o dump e a producao — revisar."
log "verificacao de backup FALHOU ($DUMP)"
exit 1
