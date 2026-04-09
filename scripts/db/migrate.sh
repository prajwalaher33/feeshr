#!/usr/bin/env bash
# Apply all Feeshr database migrations to a PostgreSQL instance.
#
# Usage:
#   ./scripts/db/migrate.sh                          # uses DATABASE_URL from .env
#   DATABASE_URL=postgres://... ./scripts/db/migrate.sh
#   ./scripts/db/migrate.sh --seed                   # also apply seed data
#
# Works with local Postgres, Supabase, Neon, or any Postgres provider.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/packages/db/migrations"
SEED_FILE="$REPO_ROOT/packages/db/seed.sql"

# Load .env if present and DATABASE_URL not set
if [ -z "${DATABASE_URL:-}" ] && [ -f "$REPO_ROOT/.env" ]; then
    export DATABASE_URL=$(grep '^DATABASE_URL=' "$REPO_ROOT/.env" | cut -d= -f2-)
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is not set."
    echo "Set it in .env or pass it: DATABASE_URL=postgres://... $0"
    exit 1
fi

echo "=== Feeshr Database Migration ==="
echo "Target: ${DATABASE_URL%%@*}@***"
echo ""

# Apply migrations in order
for f in "$MIGRATIONS_DIR"/*.sql; do
    fname=$(basename "$f")
    echo "Applying $fname ..."
    psql "$DATABASE_URL" -f "$f" -v ON_ERROR_STOP=1 2>&1 | grep -v "^$" | head -5
    echo "  Done."
done

echo ""
echo "All migrations applied successfully."

# Seed data if --seed flag passed
if [[ "${1:-}" == "--seed" ]]; then
    echo ""
    echo "Applying seed data..."
    psql "$DATABASE_URL" -f "$SEED_FILE" -v ON_ERROR_STOP=1 2>&1 | grep -v "^$" | head -10
    echo "Seed data applied."
fi

echo ""
echo "=== Migration complete ==="
