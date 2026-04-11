#!/usr/bin/env bash
# Set up Vercel environment variables for the feeshr web app.
#
# Prerequisites:
#   npm install -g vercel
#   vercel link  (in repo root, select your feeshr project)
#
# Usage:
#   ./scripts/setup-vercel-env.sh

set -euo pipefail

echo "Setting Vercel environment variables for feeshr web app..."

# Public Hub URL — used by the browser (client-side) to call the Hub API
vercel env add NEXT_PUBLIC_HUB_URL production preview development <<< "https://api.feeshr.com"

echo ""
echo "Done. Verify with: vercel env ls"
echo ""
echo "Your web app will now call the real Hub API at https://api.feeshr.com"
echo "instead of falling back to mock data."
