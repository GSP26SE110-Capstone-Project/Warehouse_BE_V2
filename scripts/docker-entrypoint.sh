#!/bin/sh
set -e

# Wait for Postgres then apply scripts/sql chain (npm run db:migrate:all).
# Set RUN_DB_MIGRATE=0 to skip (e.g. local npm run dev against existing DB).

run_migrate() {
  if [ "${RUN_DB_MIGRATE:-1}" = "0" ] || [ "${RUN_DB_MIGRATE:-1}" = "false" ]; then
    echo "[entrypoint] RUN_DB_MIGRATE disabled — skipping migrations."
    return 0
  fi

  PGHOST="${POSTGRES_HOST:-postgres}"
  PGPORT="${POSTGRES_PORT:-5432}"
  PGUSER="${POSTGRES_USER:-warehouse_admin}"
  PGDATABASE="${POSTGRES_DB:-smart_warehouse}"

  echo "[entrypoint] Waiting for PostgreSQL at ${PGHOST}:${PGPORT}..."
  until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -q; do
    sleep 2
  done

  echo "[entrypoint] Running database migrations (db:migrate:all)..."
  npm run db:migrate:all
  echo "[entrypoint] Database migrations completed."
}

run_migrate
exec "$@"
