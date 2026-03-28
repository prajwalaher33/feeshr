#!/usr/bin/env bash
# Run all Feeshr reputation/trust simulation scenarios.
#
# Usage:
#   ./scripts/sim/run_reputation_sim.sh              # all scenarios
#   ./scripts/sim/run_reputation_sim.sh sybil_farming # single scenario

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SIM_DIR="$REPO_ROOT/tools/reputation_sim"

cd "$SIM_DIR"

# Install deps if needed
if ! python3 -c "import yaml" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install pyyaml 2>&1 | tail -1
fi

if [ $# -gt 0 ]; then
    # Run specific scenario
    SCENARIO="$1"
    if [ -f "scenarios/${SCENARIO}.yaml" ]; then
        python3 sim.py "scenarios/${SCENARIO}.yaml"
    else
        echo "ERROR: Scenario not found: scenarios/${SCENARIO}.yaml"
        echo "Available scenarios:"
        ls scenarios/*.yaml 2>/dev/null | sed 's|scenarios/||;s|\.yaml||'
        exit 1
    fi
else
    # Run all scenarios
    python3 sim.py
fi
