#!/usr/bin/env bash
# deploy.sh — build frontend, push to GitHub, pull & restart on the server
# Usage: ./deploy.sh [user@host] [app_dir]
#   user@host  SSH target,  e.g. ubuntu@rabadon.gg   (default: $DEPLOY_HOST)
#   app_dir    path on server                         (default: $DEPLOY_DIR or ~/rabadon)

set -euo pipefail

HOST="${1:-${DEPLOY_HOST:?Set DEPLOY_HOST or pass user@host as first arg}}"
DIR="${2:-${DEPLOY_DIR:-~/rabadon}}"

echo "==> Building frontend..."
cd "$(dirname "$0")/frontend"
npm ci --silent
npm run build

echo "==> Committing & pushing..."
cd ..
git add -A
git diff --cached --quiet && echo "Nothing new to commit." || git commit -m "deploy: $(date -u '+%Y-%m-%d %H:%M UTC')"
git push origin main

echo "==> Deploying to $HOST:$DIR..."
ssh "$HOST" bash -s << REMOTE
  set -euo pipefail
  cd $DIR

  echo "--- Pulling latest..."
  git pull origin main

  echo "--- Installing Python deps..."
  pip install -q -r backend/requirements.txt

  echo "--- Building frontend (server copy)..."
  cd frontend && npm ci --silent && npm run build && cd ..

  echo "--- Restarting backend..."
  # Adjust the service name to match whatever process manager you use
  if command -v systemctl &>/dev/null && systemctl is-active --quiet rabadon-backend; then
    systemctl restart rabadon-backend
  elif command -v supervisorctl &>/dev/null; then
    supervisorctl restart rabadon-backend
  else
    # Fallback: kill existing uvicorn and relaunch in background
    pkill -f "uvicorn main:app" || true
    cd backend
    nohup python -m uvicorn main:app --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
    cd ..
  fi

  echo "--- Waiting for health check..."
  for i in \$(seq 1 15); do
    sleep 1
    curl -sf http://localhost:8000/health && echo " healthy" && break || echo -n "."
  done

  echo "--- Done."
REMOTE

echo "==> Deploy complete."
