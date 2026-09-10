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
  - `ExecStart=… venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1`
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

## Scheduled prefetch — `rabadon-prefetch.timer`

The SQLite cache is warmed nightly by `backend/prefetch_all.py`, run by a
**systemd timer** (there is **no cron daemon** on this host — `cronie` is not
installed, so don't try to add a crontab; use the timer).

- Installed units: `/etc/systemd/system/rabadon-prefetch.{service,timer}`;
  version-controlled copies at [`deploy/rabadon-prefetch.service`](../deploy/rabadon-prefetch.service)
  and [`deploy/rabadon-prefetch.timer`](../deploy/rabadon-prefetch.timer).
- Schedule: `OnCalendar=*-*-* 01:00:00` (daily at 01:00 **UTC** — host TZ is UTC),
  `Persistent=true` so a run missed while the box was down fires on next boot.
- The `.service` is `Type=oneshot`, runs as `ec2-user` with
  `WorkingDirectory=/srv/rabadon/backend`, and execs
  `venv/bin/python prefetch_all.py`. It does **not** import `main`, so the
  `rabadon.service` import guard does not apply here.
- Logs: stdout/stderr append to `backend/logs/cron.log`; the script also writes
  a per-run summary to `backend/logs/prefetch.log`. The run is long
  (~12s/champion across all 5 roles), so expect it to take a while.
- **Resource guard rails** (added after the 2026-09-04 incident below): the unit
  sets `MemoryMax=400M`, `MemorySwapMax=0`, `OOMScoreAdjust=500`, `Nice=10` and
  `TimeoutStartSec=16h`. A healthy run sits well under 100 MB; one that hits the
  cap is broken and *should* be killed — that is the unit failing alone instead
  of the whole host thrashing. If `systemctl status rabadon-prefetch` shows
  `oom-kill`, look for a memory leak in the prefetch path, don't raise the cap.
- **The prefetch must never hold the dataset in memory.** `prefetch_all.py`
  clears `scraper._matchup_mem_cache` after every champion. That cache is right
  for uvicorn (it *is* the hot path) but the prefetch only exists to fill
  SQLite, and on a small host there is no room for two copies.

## Backend memory

One parsed matchup entry is **~380 KB** of Python objects (4.7× its JSON), so
the naive "load every cached row into memory" reached **1.5 GB** for 3,700 rows
— more than a t3.micro has. Since 2026-09-10 uvicorn's mem cache is a bounded
LRU and startup warms only the hot combos:

| Env var | Default | Meaning |
|---|---|---|
| `RABADON_MEM_CACHE_MAX` | `1200` | max cached entries (≈ 450 MB). ~450 entries per patch/tier combo |
| `RABADON_WARM_TIERS` | `emerald_plus` | tiers warmed at startup and kept fresh by the warmer; raise `RABADON_MEM_CACHE_MAX` in step |
| `RABADON_WARMER` / `RABADON_WARM_INTERVAL` | `1` / `21600` | background refresh of the hot combos (current patch + 30-day) |

Expected resident size after startup: ~100 MB base + ~380 KB × hot-set rows
(≈ 900 for one tier → ~450 MB total). Check with
`systemctl show rabadon -p MemoryCurrent`.

### Common commands

```bash
systemctl list-timers rabadon-prefetch.timer   # next/last run, time left
systemctl status rabadon-prefetch.timer        # timer state
sudo systemctl start rabadon-prefetch.service  # run the prefetch now (ad hoc)
journalctl -u rabadon-prefetch.service -f      # live logs of a running prefetch
tail -f /srv/rabadon/backend/logs/cron.log     # same output, file form
sudo systemctl disable --now rabadon-prefetch.timer   # stop scheduling it
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
- **frontend**: `npm ci` → `npm run test` (Vitest unit tests) → `npm run build`.

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

## Incident 2026-09-04 → 09-09 (summary)

- **Symptom**: site unreachable for ~12 h *every day* (roughly 11:00–23:00 UTC).
  TCP handshakes on 22/80/443 succeeded but no daemon — sshd, nginx, even
  sysstat — ever answered. Kernel alive, userspace fully blocked.
- **Cause**: swap thrash on the t3.micro (916 MB RAM + 1 GB swapfile). uvicorn's
  `warm_cache()` already holds ~0.9 GB (RSS + swap). The 01:00 prefetch calls
  `scraper.get_matchup_data()`, which stores every result in the process-wide
  `_matchup_mem_cache`, so the prefetch process accumulated the entire dataset
  (~660 MB RSS) it never reads. Swap hit 100 % around 11:00, then `majflt`
  400+/s, `iowait` 80 %, load 8+ on 2 vCPUs. Data growth (2 patches × 4 tiers)
  tipped it over: Sep 1–3 already peaked at 97 % swap and only survived because
  the run finished by 12:35 and freed memory.
- **Recovery** (each day): the kernel OOM-killer eventually killed the prefetch
  (`journalctl -k | grep "Out of memory"`), sometimes triggered by an SSH login
  needing memory. No reboot ever happened. `prefetch.log` looked clean because
  the summary is only written on completion — check `systemctl status
  rabadon-prefetch` and the kernel log, not just the app logs.
- **How it was diagnosed**: `uptime` (load avg + no reboot) → `journalctl -k`
  (OOM kill with per-process RSS/swap table) → `sar -S/-B/-u/-q` and
  `sar -f /var/log/sa/saDD` for prior days (10-min history; gaps in the samples
  are themselves evidence) → `journalctl -u rabadon-prefetch` for the pattern.
- **Fixes**: prefetch clears the mem cache per champion; guard rails on the
  unit (see above). The box still has no headroom — uvicorn alone exceeds
  physical RAM — so trimming `warm_cache()` or moving to a t3.small is the next
  step, as is rotating `backend/logs/cron.log` (369 MB, root-owned, unrotated).
