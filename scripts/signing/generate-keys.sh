#!/usr/bin/env bash
# Generate cosign key pair for local development SBOM signing.
#
# Usage:
#   ./scripts/signing/generate-keys.sh
#
# This creates keys in secrets/cosign/ (git-ignored).
# For CI, use cosign's keyless/OIDC signing instead.
#
# Prerequisites:
#   brew install cosign   (macOS)
#   go install github.com/sigstore/cosign/v2/cmd/cosign@latest   (Linux)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KEY_DIR="$REPO_ROOT/secrets/cosign"

mkdir -p "$KEY_DIR"

if [ -f "$KEY_DIR/cosign.key" ]; then
    echo "Keys already exist at $KEY_DIR/cosign.key"
    echo "Delete them first if you want to regenerate."
    exit 0
fi

if ! command -v cosign &>/dev/null; then
    echo "ERROR: cosign not found. Install it first:"
    echo "  macOS:  brew install cosign"
    echo "  Linux:  go install github.com/sigstore/cosign/v2/cmd/cosign@latest"
    exit 1
fi

echo "Generating cosign key pair..."
echo "You will be prompted for a password (can be empty for dev)."
cd "$KEY_DIR"
cosign generate-key-pair

echo ""
echo "Keys generated:"
echo "  Private: $KEY_DIR/cosign.key"
echo "  Public:  $KEY_DIR/cosign.pub"
echo ""
echo "IMPORTANT: Never commit cosign.key to version control."
echo "The secrets/ directory is git-ignored."
