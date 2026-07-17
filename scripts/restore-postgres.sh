#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/restore-postgres.sh path/to/backup.sql" >&2
  exit 2
fi

: "${POSTGRES_DB:=pingguard}"
: "${POSTGRES_USER:=pingguard}"

docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < "$1"
