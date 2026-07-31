#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/ueat/backups/postgres}"
DATABASE_URL="${DATABASE_URL:-postgresql:///ueat?host=/var/run/postgresql}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/ueat-$timestamp.dump"

pg_dump "$DATABASE_URL" --format=custom --file="$target"
find "$BACKUP_DIR" -type f -name "ueat-*.dump" -mtime +"$RETENTION_DAYS" -delete

echo "PostgreSQL backup written to $target"
