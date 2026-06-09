# Developer Guide

## Git Workflow

- `main` is always deployable.
- Branch naming: `feature/overlay-sync`, `fix/sample-penalty`, `chore/update-deps`
- Keep branches short-lived (merge within 1–2 days).
- No `develop` or `release` branches — overkill for a small team.

---

## Local Setup

### Backend

Requires Python 3.11+.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The backend starts at `http://127.0.0.1:8000`. The SQLite cache (`data/rabadon_cache.db`) is created automatically on first run.

#### Backend tests

```bash
cd backend
python -m pytest
# or just for lint:
python -m ruff check --select F .
```

### Frontend

Requires Node 18+.

```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
npm run test       # Vitest unit tests
npm run build      # production build to frontend/dist/
```

The frontend dev server proxies `/api/` requests to `localhost:8000` automatically.

### Desktop (Windows)

Requires:
- [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)

```powershell
cd desktop
npm install
npm run dev        # starts Tauri dev window (hot-reloads frontend from localhost:5173)
npm run build      # produces installer at desktop/src-tauri/target/release/bundle/nsis/
```

The Tauri dev command expects the frontend dev server to already be running at `localhost:5173`.

---

## Environment Variables

### Backend

Only `ALLOWED_ORIGINS` is used in production:

```
# backend/.env
ALLOWED_ORIGINS=https://rabadon.gg,https://www.rabadon.gg
```

If `ALLOWED_ORIGINS` is unset, the backend allows all localhost dev origins (`5173`, `5174`, `3000`).

`RABADON_DESKTOP=1` can be set to enable the LCU watcher service (used internally by the desktop Tauri shell).

No API keys are required. The lolalytics data source and Riot Data Dragon are both public.

### Frontend

```
# frontend/.env or set in CI
VITE_DESKTOP=true      # enables the desktop-only UI (custom titlebar, overlay, etc.)
```

`__APP_VERSION__` is injected at build time by Vite `define` from `desktop/package.json`. No manual configuration needed.

---

## Releasing

See [`.claude/release.md`](../.claude/release.md) for the full checklist. Summary:

1. Bump `version` in `desktop/src-tauri/Cargo.toml` and `desktop/package.json`
2. Add a `## What's new in x.y.z` section at the **top** of `RELEASE_NOTES.md`
3. Commit: `git commit -m "Bump version to x.y.z"`
4. Tag: `git tag vx.y.z`
5. Push: `git push origin main && git push origin vx.y.z`

CI builds the installer and publishes the GitHub Release automatically. The `RELEASE_NOTES.md` section for the new version is used as the release body.

---

## Deploying to Production

See [`docs/ops.md`](ops.md) for the full production runbook. Short version:

```bash
# On the EC2 box, from /srv/rabadon:
./scripts/deploy-frontend.sh   # rebuilds frontend/dist (nginx serves immediately)
./scripts/deploy-backend.sh    # installs deps, pre-flight import check, restarts systemd unit
```

Both scripts accept `--no-pull` to build the current checkout without pulling from origin.
