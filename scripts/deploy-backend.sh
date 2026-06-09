#!/usr/bin/env bash
#
# Redeploy the Rabadon.GG backend safely.
#
# Safety model (the outage on 2026-06-05 happened because none of this existed):
#   1. Update Python deps.
#   2. PRE-FLIGHT GATE — prove the new code imports BEFORE touching the running
#      service. If it can't import, abort and leave the current (healthy)
#      backend untouched. Broken code never causes downtime.
#   3. Restart via systemd (preferred — auto-restart, journald logs) or fall
#      back to raw uvicorn if the unit isn't installed.
#   4. HEALTH GATE — poll /health and fail loudly if it doesn't come up.
#
# Usage:
#   ./scripts/deploy-backend.sh             # pull latest main, install, gate, restart
#   ./scripts/deploy-backend.sh --no-pull   # deploy whatever is checked out now

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
PY="$BACKEND_DIR/venv/bin/python"
PIP="$BACKEND_DIR/venv/bin/pip"
UVICORN="$BACKEND_DIR/venv/bin/uvicorn"
HEALTH_URL="http://127.0.0.1:8000/health"
SERVICE="rabadon"

PULL=1
[[ "${1:-}" == "--no-pull" ]] && PULL=0

cd "$REPO_DIR"

if [[ "$PULL" == "1" ]]; then
  echo "==> Pulling latest main..."
  git pull --ff-only origin main
fi

echo "==> Installing backend dependencies..."
"$PIP" install -q -r "$BACKEND_DIR/requirements.txt"

echo "==> Pre-flight: verifying the app imports..."
if ! ( cd "$BACKEND_DIR" && "$PY" -c "import main" ); then
  echo "!! ABORT: backend fails to import. The running process was left untouched (no downtime)." >&2
  exit 1
fi
echo "   import OK."

echo "==> Restarting backend..."
# NOTE: detect the unit with `systemctl cat` (no pipe). The old check
# `systemctl list-unit-files | grep -q ...` races under `set -o pipefail`:
# grep -q closes the pipe on first match, systemctl dies with SIGPIPE (141),
# and pipefail reports the pipeline as failed → it wrongly took the raw-uvicorn
# fallback, pkill'd the systemd process, and orphaned uvicorn onto port 8000
# (the 2026-06-05 incident). `systemctl cat` returns 0 iff the unit exists.
if command -v systemctl &>/dev/null && systemctl cat "${SERVICE}.service" &>/dev/null; then
  sudo systemctl restart "$SERVICE"
else
  echo "   (systemd unit '${SERVICE}' not installed — using raw-uvicorn fallback)"
  echo "   Install the unit for auto-restart + real logs: see deploy/rabadon.service"
  pkill -f "uvicorn main:app" || true
  sleep 1
  ( cd "$BACKEND_DIR" && setsid "$UVICORN" main:app --host 127.0.0.1 --port 8000 --workers 1 \
      >/dev/null 2>&1 < /dev/null & )
fi

echo "==> Waiting for health check..."
for i in $(seq 1 20); do
  sleep 1
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo "   healthy after ${i}s."
    echo "==> Backend deploy complete."
    exit 0
  fi
  echo -n "."
done

echo
echo "!! Health check FAILED after 20s." >&2
echo "   Inspect: journalctl -u ${SERVICE} -n 50   (or the raw-uvicorn output)" >&2
exit 1
