#!/usr/bin/env bash
# Deploy the docs/demo/landing site to zipgo on raspy2 (internet HTTPS).
#
# The site lives at ui.gabvdl.xyz — an apex-level subdomain of gabvdl.xyz, so
# zipgo files it under domains/gabvdl.xyz/ui.  Run `npm run build` (or
# `npm run deploy`, which builds first) so apps/docs/dist exists.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/apps/docs/dist"
HOST="ui.gabvdl.xyz"
URL="https://$HOST"
SSH_DEST="gabrielvidal@100.74.118.12:/home/gabrielvidal/services/domains"

if [ ! -d "$DIST" ]; then
  echo "error: $DIST not found — run 'npm run build' first." >&2
  exit 1
fi

# Mirror the build to the remote subdomain folder (--delete by default).
zipgo deploy "$DIST/" -d "$HOST" --ssh "$SSH_DEST"
echo "✓ Synced build to raspy2: $HOST"

# A brand-new subdomain folder: nudge Caddy (zipgo) to pick it up. Harmless if
# the folder already existed.
ssh gabrielvidal@100.74.118.12 'cd ~/services && docker compose restart zipgo >/dev/null 2>&1' \
  && echo "✓ zipgo restarted (picks up new ui. folder)" \
  || echo "  (could not restart zipgo remotely — may already serve the folder)"

# og:image + social meta (best-effort). Screenshot the live page, patch tags,
# re-sync. A failure here must not fail the deploy.
if command -v og-screenshot >/dev/null 2>&1; then
  if og-screenshot "$URL" --project "$ROOT/apps/docs"; then
    zipgo deploy "$DIST/" -d "$HOST" --ssh "$SSH_DEST"
    echo "✓ og:image + social meta updated and re-synced"
  else
    echo "  (og:image step skipped — screenshot failed)"
  fi
fi

echo ""
echo "  Deployed URL : $URL   (via raspy2, Let's Encrypt HTTPS)"
