#!/usr/bin/env bash
# ============================================================
# GESCOLA — Migração de dados: Neon (cloud) -> PostgreSQL da VPS
#
# Executa NA VPS (ela tem postgresql-client e acesso à internet).
# Requer: as duas connection strings no ambiente.
#
# Uso:
#   export NEON_DATABASE_URL="postgresql://...neon.tech/gescola?sslmode=require"
#   export DATABASE_URL="postgresql://gescola_app:SENHA@127.0.0.1:5432/gescola?schema=public"
#   bash scripts/migrate-db-neon-to-vps.sh
#
# Flags:
#   --dump-only     só gera o dump, não restaura
#   --restore-only  pula o dump e restaura o arquivo já baixado
#
# Variáveis opcionais:
#   DUMP_DIR  (padrão /var/backups/pg)
#   DUMP_FILE (padrão $DUMP_DIR/neon-to-vps-<timestamp>.sql.gz)
#
# Observações:
#   - O dump inclui a tabela _prisma_migrations, então o
#     `prisma migrate deploy` não repete migrations já aplicadas.
#   - A senha no comando aparece no `ps` da VPS por alguns segundos;
#     mantenha o arquivo .env.production com permissão 600.
# ============================================================

set -euo pipefail

DUMP_DIR="${DUMP_DIR:-/var/backups/pg}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${DUMP_FILE:-${DUMP_DIR}/neon-to-vps-${STAMP}.sql.gz}"

DUMP_ONLY=0
RESTORE_ONLY=0
case "${1:-}" in
  --dump-only) DUMP_ONLY=1 ;;
  --restore-only) RESTORE_ONLY=1 ;;
esac

log() { echo -e "\n\033[1;33m==> $1\033[0m"; }
fail() { echo -e "\n\033[1;31mERRO: $1\033[0m" >&2; exit 1; }

command -v pg_dump >/dev/null || fail "pg_dump não encontrado (instale postgresql-client)"
[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL (Postgres da VPS) não definida"
[ -n "${NEON_DATABASE_URL:-}" ] || fail "NEON_DATABASE_URL (origem) não definida"

mkdir -p "$DUMP_DIR"

# --- 1. Dump da origem ------------------------------------------------------
if [ "$RESTORE_ONLY" -eq 0 ]; then
  log "Gerando dump da origem (Neon) -> $DUMP_FILE"
  pg_dump "$NEON_DATABASE_URL" \
    --no-owner --no-acl --format=plain --no-comments \
    | gzip > "$DUMP_FILE"
  SIZE=$(du -h "$DUMP_FILE" | cut -f1)
  echo "    dump gerado ($SIZE)"
  gzip -t "$DUMP_FILE" || fail "arquivo de dump corrompido"
fi

[ -f "$DUMP_FILE" ] || fail "dump não encontrado: $DUMP_FILE"
[ "$DUMP_ONLY" -eq 1 ] && { log "Modo --dump-only: encerrando"; exit 0; }

# --- 2. Restauração no banco da VPS ---------------------------------------
log "Restaurando no PostgreSQL da VPS"
gunzip -c "$DUMP_FILE" | psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --quiet

# --- 3. Verificação (contagem de linhas nas tabelas principais) ------------
log "Verificando a migração"
TABELAS="User Lead Followup Enrollment Goal LeadMessage EnrollmentAudit Document"

contar() { # $1 = url
  local url="$1" tabela="$2" saida
  saida=$(psql "$url" -tAc "SELECT count(*) FROM \"$tabela\"" 2>/dev/null || echo "n/a")
  echo "$saida"
}

printf "    %-20s %12s %12s\n" "TABELA" "NEON" "VPS"
FALHAS=0
for t in $TABELAS; do
  A=$(contar "$NEON_DATABASE_URL" "$t")
  B=$(contar "$DATABASE_URL" "$t")
  printf "    %-20s %12s %12s" "$t" "$A" "$B"
  if [ "$A" = "$B" ]; then
    echo "   ✅"
  else
    echo "   ⚠️  divergente"
    FALHAS=$((FALHAS+1))
  fi
done

# --- 4. Migrations pendentes ------------------------------------------------
log "Conferindo migrations do Prisma"
PENDENTES=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM \"_prisma_migrations\" WHERE finished_at IS NULL" 2>/dev/null || echo 0)
if [ "$PENDENTES" != "0" ]; then
  echo "    $PENDENTES migration(s) sem finalização — rode: pnpm prisma migrate deploy"
fi

log "Resumo"
echo "    dump: $DUMP_FILE"
echo "    tabelas com divergência: $FALHAS"
if [ "$FALHAS" -gt 0 ]; then
  echo -e "\n\033[1;33m    Revise as divergências antes de cortar o Neon.\033[0m"
  exit 2
fi
echo -e "\n\033[1;32m    Migração concluída com sucesso ✅\033[0m"
