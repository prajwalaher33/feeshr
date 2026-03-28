#!/usr/bin/env bash
# gVisor sandbox runner for Feeshr CI.
#
# Runs untrusted code in a gVisor-isolated container (runsc runtime).
# gVisor intercepts syscalls in a user-space application kernel,
# reducing exposure to container escape exploits.
#
# All Docker-runner security flags apply, PLUS:
#   - --runtime=runsc (gVisor)
#   - Syscall filtering via gVisor's application kernel
#
# Prerequisites:
#   - gVisor installed: https://gvisor.dev/docs/user_guide/install/
#   - Docker configured with runsc runtime
#
# Usage:
#   ./infra/sandbox/gvisor-runner.sh <repo-clone-url> <branch> [image] [timeout] [memory]

set -euo pipefail

CLONE_URL="${1:?Usage: gvisor-runner.sh <clone-url> <branch> [image] [timeout] [memory]}"
BRANCH="${2:?Branch required}"
IMAGE="${3:-python:3.12-slim}"
TIMEOUT="${4:-60}"
MEMORY="${5:-512m}"

CONTAINER_NAME="feeshr-ci-gvisor-$(date +%s)-$$"

# Verify gVisor runtime is available
if ! docker info --format '{{.Runtimes}}' 2>/dev/null | grep -q runsc; then
    echo "[sandbox:gvisor] ERROR: gVisor (runsc) runtime not found."
    echo "Install gVisor: https://gvisor.dev/docs/user_guide/install/"
    echo "Configure Docker: https://gvisor.dev/docs/user_guide/quick_start/docker/"
    echo ""
    echo "Falling back to standard Docker isolation..."
    exec "$(dirname "$0")/docker-runner.sh" "$@"
fi

echo "[sandbox:gvisor] Starting CI for branch=$BRANCH image=$IMAGE timeout=${TIMEOUT}s memory=$MEMORY"

CI_SCRIPT=$(cat <<'EOSCRIPT'
set -e
cd /workspace
if [ -f pyproject.toml ] || [ -f setup.py ]; then
    pip install -e . --quiet 2>&1
    pip install ruff pytest pytest-cov --quiet 2>&1
    echo "=== LINT ==="
    ruff check . --output-format=json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'warnings: {len(d)}')" || echo "warnings: 0"
    echo "=== TEST ==="
    pytest -q --tb=short --cov=. --cov-report=term-missing 2>&1
elif [ -f package.json ]; then
    npm ci --silent 2>&1
    echo "=== LINT ==="
    npm run lint 2>&1 || true
    echo "=== TEST ==="
    npm test 2>&1
elif [ -f Cargo.toml ]; then
    echo "=== TEST ==="
    cargo test --quiet 2>&1
else
    echo "No recognized project structure found"
    exit 1
fi
EOSCRIPT
)

# Run with gVisor + all standard security flags
timeout "${TIMEOUT}" docker run \
    --rm \
    --name "$CONTAINER_NAME" \
    --runtime=runsc \
    --network=none \
    --memory="$MEMORY" \
    --cpus=1 \
    --security-opt=no-new-privileges \
    --cap-drop=ALL \
    --read-only \
    --tmpfs=/tmp:rw,noexec,nosuid,size=256m \
    --tmpfs=/workspace:rw,noexec,nosuid,size=512m \
    --tmpfs=/root:rw,noexec,nosuid,size=64m \
    --pids-limit=256 \
    --ulimit nproc=128 \
    --ulimit nofile=1024 \
    "$IMAGE" \
    bash -c "git clone --depth 1 --branch '$BRANCH' '$CLONE_URL' /workspace 2>&1 && $CI_SCRIPT"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 124 ]; then
    echo "[sandbox:gvisor] CI timed out after ${TIMEOUT}s"
    docker kill "$CONTAINER_NAME" 2>/dev/null || true
fi

echo "[sandbox:gvisor] CI exited with code $EXIT_CODE"
exit $EXIT_CODE
