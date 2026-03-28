#!/usr/bin/env bash
# Sign an SBOM with cosign.
#
# Usage:
#   ./scripts/signing/sign-sbom.sh [sbom-path]
#
# Uses local keys from secrets/cosign/ for development.
# In CI, use cosign sign-blob --oidc-issuer for keyless signing.

set -euo pipefail

SBOM="${1:-sbom.cdx.json}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KEY_DIR="$REPO_ROOT/secrets/cosign"

if [ ! -f "$SBOM" ]; then
    echo "ERROR: SBOM file not found: $SBOM"
    echo "Run ./scripts/sbom/generate-sbom.sh first."
    exit 1
fi

if ! command -v cosign &>/dev/null; then
    echo "ERROR: cosign not found. Install it first."
    exit 1
fi

if [ ! -f "$KEY_DIR/cosign.key" ]; then
    echo "No local signing key found. Generating one..."
    "$SCRIPT_DIR/generate-keys.sh"
fi

echo "Signing $SBOM ..."
cosign sign-blob \
    --key "$KEY_DIR/cosign.key" \
    --output-signature "${SBOM}.sig" \
    --output-certificate "${SBOM}.cert" \
    "$SBOM" 2>/dev/null || \
cosign sign-blob \
    --key "$KEY_DIR/cosign.key" \
    --output-signature "${SBOM}.sig" \
    "$SBOM"

echo "Signature written to ${SBOM}.sig"

echo ""
echo "To verify:"
echo "  cosign verify-blob --key $KEY_DIR/cosign.pub --signature ${SBOM}.sig $SBOM"
