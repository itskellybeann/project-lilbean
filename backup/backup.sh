#!/bin/sh
set -eu

STAMP=$(date +%Y%m%d-%H%M%S)
FILE="/backups/${POSTGRES_DB}-${STAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

echo "[backup] dumping ${POSTGRES_DB} to ${FILE}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${PGHOST}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${FILE}"

echo "[backup] pruning backups older than ${RETENTION_DAYS} days"
find /backups -name "${POSTGRES_DB}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "[backup] done: $(ls -lh "${FILE}")"
