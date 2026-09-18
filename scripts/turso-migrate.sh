#!/usr/bin/env bash
# Aplica todas as migrations locais no banco Turso remoto.
# Uso:
#   export TURSO_DB_NAME=arcoplay
#   ./scripts/turso-migrate.sh
set -euo pipefail

DB_NAME="${TURSO_DB_NAME:-arcoplay}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../prisma/migrations" && pwd)"

if ! command -v turso >/dev/null 2>&1; then
  echo "Instale o Turso CLI: https://docs.turso.tech/cli/installation"
  exit 1
fi

shopt -s nullglob
for dir in "$MIGRATIONS_DIR"/*/; do
  sql="$dir/migration.sql"
  if [[ -f "$sql" ]]; then
    echo "→ Aplicando $(basename "$dir")"
    turso db shell "$DB_NAME" < "$sql"
  fi
done

echo "OK — schema aplicado em $DB_NAME"
