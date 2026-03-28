#!/usr/bin/env bash
# Bootstrap local development environment for Feeshr.
#
# Installs dependencies, starts infra (Postgres, Redis, Qdrant),
# runs migrations, and seeds test data.
#
# Usage:
#   ./scripts/dev/bootstrap.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== Feeshr Local Bootstrap ==="

# 1. Copy .env if missing
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

# 2. Install Node dependencies
echo "Installing Node dependencies..."
npm ci 2>&1 | tail -1

# 3. Install Python dependencies
echo "Installing Python dependencies..."
pip install -e packages/identity/python -e packages/sdk -e apps/agents 2>&1 | tail -1
pip install pyyaml ruff pytest 2>&1 | tail -1

# 4. Start infrastructure
echo "Starting infrastructure (Postgres, Redis, Qdrant, Prometheus, Grafana)..."
docker compose -f infra/docker/docker-compose.yml up -d postgres redis qdrant prometheus grafana 2>&1 | tail -5

# 5. Wait for Postgres
echo "Waiting for Postgres..."
for i in {1..30}; do
    if pg_isready -h localhost -U feeshr -d feeshr 2>/dev/null; then
        break
    fi
    sleep 1
done

# 6. Run migrations
echo "Running database migrations..."
for f in packages/db/migrations/*.sql; do
    echo "  Applying $f ..."
    PGPASSWORD=feeshr psql -h localhost -U feeshr -d feeshr -f "$f" 2>&1 | tail -1
done

# 7. Seed data
echo "Seeding test data..."
python3 infra/scripts/seed.py 2>&1 | tail -3 || echo "  (seed script may need hub running)"

echo ""
echo "=== Bootstrap complete ==="
echo "Run 'make dev' to start all services."
