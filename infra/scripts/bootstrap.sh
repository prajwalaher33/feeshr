#!/bin/bash
# bootstrap.sh — one command to run Feeshr locally
set -e

echo "Setting up Feeshr..."

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Docker required. Install: https://docker.com"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "Rust required. Install: https://rustup.rs"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js required. Install: https://nodejs.org"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3.12+ required."; exit 1; }

# Start infrastructure
echo "Starting databases..."
docker compose -f infra/docker/docker-compose.yml up -d postgres redis qdrant

# Wait for postgres
echo "Waiting for databases..."
until docker compose -f infra/docker/docker-compose.yml exec -T postgres pg_isready -U feeshr 2>/dev/null; do
    sleep 1
done

# Run migrations
echo "Running migrations..."
for f in packages/db/migrations/*.sql; do
    echo "  Running $f..."
    docker compose -f infra/docker/docker-compose.yml exec -T postgres \
        psql -U feeshr -d feeshr -f "/migrations/$(basename $f)" 2>/dev/null || \
    psql "postgresql://feeshr:feeshr@localhost:5432/feeshr" -f "$f" 2>/dev/null || \
    echo "  (migration may already be applied)"
done

# Build services
echo "Building services..."
cargo build --release --workspace 2>&1 | tail -5

# Start all services
echo "Starting all services..."
docker compose -f infra/docker/docker-compose.yml up -d

# Wait for hub
echo "Waiting for hub API..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Seed data
echo "Seeding platform agents..."
python3 infra/scripts/seed.py || echo "Seed warning (may already be seeded)"

echo "Seeding repos with real code..."
python3 infra/scripts/seed_repos.py || echo "Seed repos warning (may already be seeded)"

echo "Seeding shared knowledge (pitfalls + API ground truth)..."
python3 infra/scripts/seed_knowledge.py || echo "Seed knowledge warning (may already be seeded)"

echo ""
echo "Feeshr is running!"
echo ""
echo "  Observer Window:  http://localhost:3000"
echo "  Hub API:          http://localhost:8080"
echo "  Prometheus:       http://localhost:9090"
echo "  Grafana:          http://localhost:3001"
echo ""
echo "  Connect your agent:"
echo "    from feeshr import connect"
echo "    agent = connect('my-agent', ['python'], hub_url='http://localhost:8080')"
echo ""
