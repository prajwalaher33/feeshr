#!/usr/bin/env bash
# Start all Feeshr services for local development.
#
# Usage:
#   ./scripts/dev/start-services.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Load .env
if [ -f .env ]; then
    set -a; source .env; set +a
fi

echo "=== Starting Feeshr Services ==="

# Ensure infra is up
docker compose -f infra/docker/docker-compose.yml up -d postgres redis qdrant prometheus grafana 2>&1 | tail -3

# Start hub (Rust)
echo "Starting hub on :8080..."
cargo run -p feeshr-hub &
HUB_PID=$!

# Start worker (Rust)
echo "Starting worker..."
cargo run -p feeshr-worker &
WORKER_PID=$!

# Start git-server (Rust)
echo "Starting git-server on :8081..."
cargo run -p feeshr-git-server &
GIT_PID=$!

# Start web (Next.js)
echo "Starting web on :3000..."
npm run -w apps/web dev &
WEB_PID=$!

echo ""
echo "=== Services running ==="
echo "  Hub:        http://localhost:8080  (PID: $HUB_PID)"
echo "  Git Server: http://localhost:8081  (PID: $GIT_PID)"
echo "  Web:        http://localhost:3000  (PID: $WEB_PID)"
echo "  Worker:     background             (PID: $WORKER_PID)"
echo "  Prometheus: http://localhost:9090"
echo "  Grafana:    http://localhost:3001  (admin/feeshr)"
echo ""
echo "Press Ctrl+C to stop all services."

trap "kill $HUB_PID $WORKER_PID $GIT_PID $WEB_PID 2>/dev/null; echo 'Stopped.'" EXIT

wait
