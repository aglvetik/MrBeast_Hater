#!/usr/bin/env sh
set -eu

: "${POSTGRES_DB:=pingguard}"
: "${POSTGRES_USER:=pingguard}"
: "${BACKUP_DIR:=./backups}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_DIR/pingguard-$timestamp.sql"
