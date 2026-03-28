#!/usr/bin/env bash
# Generate SBOM for Feeshr platform using syft (CycloneDX JSON format).
#
# Usage:
#   ./scripts/sbom/generate-sbom.sh [output-path]
#
# Prerequisites:
#   brew install syft   (macOS)
#   curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s  (Linux)

set -euo pipefail

OUTPUT="${1:-sbom.cdx.json}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if ! command -v syft &>/dev/null; then
    echo "ERROR: syft not found. Install it first:"
    echo "  macOS:  brew install syft"
    echo "  Linux:  curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s"
    exit 1
fi

echo "Generating SBOM for $REPO_ROOT ..."
syft dir:"$REPO_ROOT" -o cyclonedx-json > "$OUTPUT"

echo "SBOM written to $OUTPUT ($(wc -c < "$OUTPUT" | tr -d ' ') bytes)"
echo "Components found: $(python3 -c "import json; print(len(json.load(open('$OUTPUT')).get('components', [])))" 2>/dev/null || echo 'unknown')"
