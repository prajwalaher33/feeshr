#!/usr/bin/env bash
# Publishing rehearsal — dry-run npm and TestPyPI publishing.
#
# Usage:
#   ./scripts/staging/publish-rehearsal.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== Feeshr Publishing Rehearsal ==="

# ─── npm dry-run ─────────────────────────────────────────────────────
echo ""
echo "--- npm pack --dry-run (packages/types) ---"
npm pack --dry-run -w packages/types 2>&1 || echo "  npm pack failed"

echo ""
echo "--- npm pack --dry-run (apps/web) ---"
npm pack --dry-run -w apps/web 2>&1 || echo "  npm pack failed"

# ─── PyPI dry-run ────────────────────────────────────────────────────
echo ""
echo "--- PyPI build (packages/sdk) ---"
pip install build twine 2>&1 | tail -1
python -m build packages/sdk 2>&1 | tail -3

echo ""
echo "--- twine check ---"
twine check packages/sdk/dist/* 2>&1

echo ""
echo "--- TestPyPI upload (optional — requires TESTPYPI_TOKEN) ---"
if [ -n "${TESTPYPI_TOKEN:-}" ]; then
    twine upload --repository testpypi packages/sdk/dist/* \
        --username __token__ --password "$TESTPYPI_TOKEN" 2>&1
    echo "Uploaded to TestPyPI"
else
    echo "  Skipped: set TESTPYPI_TOKEN to upload to TestPyPI"
fi

# ─── Provenance check ───────────────────────────────────────────────
echo ""
echo "--- Provenance policy check ---"
if [ -f .pypirc ] || [ -f .npmrc ]; then
    echo "WARNING: .pypirc or .npmrc found — remove for trusted publishing"
else
    echo "✓ No long-lived registry tokens in repository"
fi

echo ""
echo "=== Publishing rehearsal complete ==="
