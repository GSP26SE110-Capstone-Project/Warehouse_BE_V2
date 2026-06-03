#!/bin/sh
set -e

# Wait for Postgres → migrate → seed demo data → start app.
# RUN_DB_MIGRATE=0 / RUN_DB_SEED=0 to skip either step.

wait_for_postgres() {
  PGHOST="${POSTGRES_HOST:-postgres}"
  PGPORT="${POSTGRES_PORT:-5432}"
  PGUSER="${POSTGRES_USER:-warehouse_admin}"
  PGDATABASE="${POSTGRES_DB:-smart_warehouse}"

  echo "[entrypoint] Waiting for PostgreSQL at ${PGHOST}:${PGPORT}..."
  until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -q; do
    sleep 2
  done
}

run_migrate() {
  if [ "${RUN_DB_MIGRATE:-1}" = "0" ] || [ "${RUN_DB_MIGRATE:-1}" = "false" ]; then
    echo "[entrypoint] RUN_DB_MIGRATE disabled — skipping migrations."
    return 0
  fi

  echo "[entrypoint] Running database migrations (db:migrate:all)..."
  npm run db:migrate:all
  echo "[entrypoint] Database migrations completed."
}

run_seed() {
  if [ "${RUN_DB_SEED:-1}" = "0" ] || [ "${RUN_DB_SEED:-1}" = "false" ]; then
    echo "[entrypoint] RUN_DB_SEED disabled — skipping seed."
    return 0
  fi

  echo "[entrypoint] Running demo seed (seed:all)..."
  npm run seed:all
  echo "[entrypoint] Demo seed completed."
}

wait_for_postgres
run_migrate
run_seed
exec "$@"
