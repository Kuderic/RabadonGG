#!/usr/bin/env bash
#
# Redeploy the Rabadon.GG frontend.
#
# nginx serves the static build directly from frontend/dist
# (root /srv/rabadon/frontend/dist in /etc/nginx/conf.d/rabadon.conf),
# so deploying just means rebuilding into that folder. No copy or
# nginx reload is needed — the new files are live as soon as the build finishes.
#
# Usage:
#   ./scripts/deploy-frontend.sh            # pull latest main, install, build
#   ./scripts/deploy-frontend.sh --no-pull  # build whatever is checked out now

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_DIR/frontend"

PULL=1
if [[ "${1:-}" == "--no-pull" ]]; then
  PULL=0
fi

cd "$REPO_DIR"

if [[ "$PULL" == "1" ]]; then
  echo "==> Pulling latest main..."
  git pull --ff-only origin main
fi

cd "$FRONTEND_DIR"

echo "==> Installing dependencies (npm ci)..."
npm ci

echo "==> Building..."
npm run build

echo "==> Done. New build is live at frontend/dist (served by nginx)."
