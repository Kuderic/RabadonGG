# Operations / Production Runbook

How Rabadon.GG is deployed and run in production, and the gotchas learned the
hard way (see the 2026-06-05 incident at the bottom). Read this **before**
touching the running backend.

## TL;DR

- The app runs on a single EC2 host (Amazon Linux 2023). **This repo at
  `/srv/rabadon` *is* the production checkout** — there is no separate "prod
  box" to push to when you're already on it.
- **Frontend**: nginx serves the static Vite build from `/srv/rabadon/frontend/dist`.
  "Deploying" the frontend = rebuilding into that folder. No copy, no reload.
- **Backend**: a FastAPI/uvicorn process managed by the **`rabadon.service`**
  systemd unit, listening on `127.0.0.1:8000`. nginx reverse-proxies `/api/`
  and `/health` to it.
- **To deploy, use the scripts in `scripts/`. Do NOT manually `pkill`/`nohup`/
  `setsid` uvicorn** — see Gotchas.

## Hosting topology

```
internet ──443──> nginx ──┬─ /            -> static files in frontend/dist (SPA)
                          ├─ /assets/     -> hashed build assets (1y cache)
                          ├─ /api/        -> proxy http://127.0.0.1:8000  (FastAPI)
                          └─ /health      -> proxy http://127.0.0.1:8000/health
```

- **nginx config**: `/etc/nginx/conf.d/rabadon.conf`. TLS via Certbot/Let's
  Encrypt (`rabadon.gg`, `www.rabadon.gg`); HTTP→HTTPS redirect is managed by
  Certbot. `root` is `/srv/rabadon/frontend/dist` in both the `:80` default and
  the `:443` server blocks.
- After editing nginx config: `sudo nginx -t && sudo systemctl reload nginx`.

## The backend service — `rabadon.service`

**The unit is named `rabadon`, NOT `rabadon-backend`.** (`rabadon-backend` was a
duplicate created by mistake during the 2026-06-05 incident and has been removed.)

- Installed at `/etc/systemd/system/rabadon.service`; version-controlled copy at
  [`deploy/rabadon.service`](../deploy/rabadon.service).
- Key properties:
  - `ExecStart=… venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2`
  - `EnvironmentFile=/srv/rabadon/backend/.env` — **loads `ALLOWED_ORIGINS` etc.**
    Any replacement unit MUST keep this or CORS breaks in production.
  - `Restart=always`, `RestartSec=3` — the service self-heals; it also means a
    manually-killed uvicorn **respawns within ~3s** (see Gotchas).
  - `ExecStartPre=… python -c "import main"` — pre-flight guard added after the
    incident: refuses to start on un-importable code (protects the reboot path).
  - `WorkingDirectory=/srv/rabadon/backend`, runs as `ec2-user`.

### Common commands

```bash
systemctl status rabadon            # state, MainPID, cgroup
sudo systemctl restart rabadon      # restart (≈3-4s API blip; nginx/static unaffected)
sudo systemctl stop|start rabadon
journalctl -u rabadon -f            # live logs (uvicorn stdout/stderr -> journald)
journalctl -u rabadon -n 50         # recent logs
curl -sf http://localhost:8000/health   # {"status":"ok"}
```

## Deploying

Run these **on the box** from `/srv/rabadon`:

- **Frontend**: `./scripts/deploy-frontend.sh` (or `--no-pull` to build the
  current checkout). Rebuilds `frontend/dist`, which nginx serves immediately.
- **Backend**: `./scripts/deploy-backend.sh` (or `--no-pull`). It:
  1. installs deps,
  2. **pre-flight gate**: runs `python -c "import main"` and *aborts without
     touching the running service* if it fails (broken code → zero downtime),
  3. `sudo systemctl restart rabadon`,
  4. polls `/health` and fails loudly if it doesn't come up.

> The root-level [`deploy.sh`](../deploy.sh) is the **remote** dev→server flow
> (build locally, git push, SSH in, pull, restart). When you're already on the
> server, prefer the `scripts/` versions above.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every PR and
push to `main`:
- **backend**: `ruff check --select F .` (catches undefined names F821 +
  unused imports F401 — i.e. the exact bug from the incident), `python -c
  "import main"` smoke test, and pytest if tests exist.
- **frontend**: `npm ci && npm run build`.

This enforces the docs' "`main` is always deployable" invariant.

## Gotchas (learned 2026-06-05)

1. **The service is `rabadon`, not `rabadon-backend`.** Always check
   `systemctl list-units '*rabadon*'` before assuming.
2. **Don't `pkill`/`nohup`/`setsid` uvicorn to "restart" it.** `Restart=always`
   means systemd immediately respawns it, so you end up fighting systemd and
   creating orphan masters that hold port 8000 → the next `systemctl start`
   fails with `EADDRINUSE`. Always use `systemctl restart rabadon`.
3. **`PID 1 is systemd`**, so a service process showing `PPID 1` is *normal*
   (its parent is systemd) — it is **not** an orphan. Judge ownership by the
   cgroup (`cat /proc/<pid>/cgroup` → should be `…/rabadon.service`), not PPID.
4. **`pkill -f "uvicorn main:app"` can match its own shell** (the pattern string
   is in the shell's own command line) and kill the command mid-run. If you must
   pattern-kill, use a self-excluding regex like `[u]vicorn main:app`. Better:
   don't — use systemctl.
5. **`kill -9 0` signals the whole process group**, not "PID 0". Never pass `0`;
   always target an explicit PID or use `systemctl`.
6. **A manually-started uvicorn won't load `.env`** (only the systemd unit's
   `EnvironmentFile` does), so it silently runs with wrong/empty CORS origins.
7. `data/` (SQLite cache) is **not** in git and is created at runtime; a clean
   checkout has no `data/` dir until the app runs. `import main` does no I/O, so
   the CI import test is safe.

## Incident 2026-06-05 (summary)

- **Bug**: commit `e333bca "Optimization and cleanup"` removed `from typing
  import List` but left `List[...]` usages in `backend/models.py` → backend
  crashes on import. `main` had been undeployable since; the site only stayed up
  because the running process predated that commit. Fixed in a follow-up commit.
- **Outage trigger**: a routine restart picked up the broken code. Diagnosis was
  slowed, and recovery was made messy, by not knowing about `rabadon.service`
  and instead manually launching/killing uvicorn — which fought `Restart=always`
  and orphaned processes onto port 8000.
- **Hardening added**: deploy pre-flight import gate (`deploy-backend.sh`),
  `ExecStartPre` import guard on the unit, and CI lint+import-smoke. Any one of
  these would have prevented the incident.
