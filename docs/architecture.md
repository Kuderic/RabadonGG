# Architecture

## Monorepo Structure

```
RabadonGG/
  frontend/                   # React + Vite web/desktop UI
  backend/                    # FastAPI (Python) API server
  desktop/                    # Tauri 2 (Rust) desktop shell
  docs/                       # Project documentation
  deploy/                     # systemd unit files (rabadon.service, rabadon-prefetch.*)
  scripts/                    # deploy-frontend.sh, deploy-backend.sh
  CLAUDE.md                   # Claude Code instructions
  README.md
  RELEASE_NOTES.md
```

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React + Vite | SPA; `VITE_DESKTOP=true` build flag for desktop bundle |
| Desktop shell | Tauri 2 (Rust) | Frameless window, overlay window, LCU commands, global shortcut, auto-updater |
| Backend | FastAPI (Python 3.11+) | Async; runs on uvicorn with 2 workers in production |
| Cache | SQLite (`rabadon_cache.db`) | 1-day TTL; `matchup_cache` + `pool_cache` tables |
| Data source | lolalytics `a1.lolalytics.com/mega/` | No API key; `ep=counter` ×5 vslane + `ep=build-team` |
| Champion images | Riot Data Dragon | Proxied through `/api/icon/{name}` as 80×80 WebP |
| Hosting | AWS EC2 (Amazon Linux 2023) | nginx reverse proxy; systemd service |

---

## Frontend Layout

```
frontend/src/
  App.jsx                     — root state, tab nav, ChangelogModal, OverlayShowcase
  App.css                     — all styles (hextech design system + responsive)
  main.jsx                    — entry point; routes to OverlayApp when ?mode=overlay
  utils/
    champion.js               — champIconUrl(), champSlug(), role primary/secondary maps
    scoring.js                — computeComponents() — shared by RecommendationList + BreakdownPanel
    analytics.js              — GA4 event helpers
  components/
    DraftForm.jsx             — champion autocomplete inputs, role selector
    RecommendationList.jsx    — sorted recommendation cards, sort toggle
    BreakdownPanel.jsx        — full matchup breakdown; bottom-sheet on mobile
    ConfigPanel.jsx           — patch/tier, sample penalty, role weights, score multipliers
    TitleBar.jsx              — desktop custom titlebar: drag region, window controls, version chip, changelog button
    OverlayApp.jsx            — overlay window UI; reads draft from localStorage
    ChampionPoolPanel.jsx     — champion pool management + WR modifiers
    ChampionShared.jsx        — RankBadge, ExternalLink (shared across list + breakdown)
    TierSelector.jsx          — custom dropdown + TierDisplay read-only
    CookieBanner.jsx          — GA4 cookie consent
    CustomModifiersPanel.jsx  — per-champion WR modifier inputs
  services/
    lcu.js                    — useLCUSession() hook (polls Tauri get_lcu_session every 2s)
  api/
    client.js                 — getRecommendations(), getChampions(), getPatches()
```

### Key Design Decisions

- **`VITE_DESKTOP=true`**: when set, the app skips the Download tab, shows the custom TitleBar, and enables the overlay-related localStorage writes. Used for the Tauri build.
- **`__APP_VERSION__`**: injected at build time from `desktop/package.json` via Vite `define`; displayed in the TitleBar version chip.
- **Frontend re-scoring**: `computeComponents()` in `scoring.js` re-applies role weights and sample penalty client-side so the user can tune config without re-fetching. The backend score and the displayed score are independently computed but use the same formula.
- **Overlay state channel**: the main window writes the full draft state (role, allies, enemies, patch, tier, LCU phase) to `localStorage['rabadon-overlay-draft']` on every change. The overlay window listens on the `storage` event. This avoids the overlay needing its own LCU polling for draft details.

---

## Backend Layout

```
backend/
  main.py                     — FastAPI app, CORS, startup warm_cache(), icon proxy, /api/patches, /api/champions
  models.py                   — Pydantic models: RecommendRequest, RecommendResponse, Recommendation, ChampionDelta
  routes/
    recommend.py              — POST /api/recommend
    lcu.py                    — LCU proxy routes (desktop mode only)
  services/
    scraper.py                — async lolalytics fetcher; returns matchup_data + matchup_n game counts
    scorer.py                 — compute_rating(), get_synergy_breakdown(), get_counter_breakdown()
    db.py                     — SQLite cache (matchup_cache + pool_cache, 1-day TTL by fetched_at date)
    lcu.py                    — LCU watcher service (desktop RABADON_DESKTOP mode)
  scoring_config.py           — per-role enemy/ally weights + blend multipliers (backend defaults)
  prefetch_all.py             — nightly cache warmer script (run by rabadon-prefetch.timer)
  tests/
    test_lcu.py
  data/
    rabadon_cache.db          — gitignored; created at runtime
```

### Key Design Decisions

- **`d2` values**: lolalytics returns `d2` as a percent (e.g. `2.78`); the scraper divides by 100 before storing. `_fmt()` in scorer.py multiplies back by 100 for display strings (`"+2.8%"`).
- **Counter role specificity**: `ep=counter` is queried ×5 (one per `vslane`) and results are tagged with `query_vslane`. When scoring an enemy, the role-specific entry is preferred over the highest-n fallback to avoid cross-role contamination (e.g. TF support shouldn't use TF mid matchup counts).
- **Pool cache**: `pool_cache` table stores the list of champion names + total games per lane+patch+tier. Avoids re-fetching the tier list on every request.
- **Sample penalty**: `min(sqrt(n / 1000), 1.0)` multiplied per matchup delta. Both backend (primary sort) and frontend (`computeComponents`) apply the same formula so rankings stay consistent.
- **CORS**: controlled by `ALLOWED_ORIGINS` env var on the server. Unset = localhost dev defaults. Production: `ALLOWED_ORIGINS=https://rabadon.gg,https://www.rabadon.gg`.

---

## Desktop Shell Layout

```
desktop/
  src-tauri/
    src/main.rs               — Tauri commands: get_lcu_session, open_url, control_overlay, set_overlay_shortcut
    Cargo.toml                — version source of truth (also read by Vite define via desktop/package.json)
    tauri.conf.json           — two windows (main + overlay), updater config, bundle settings
  package.json                — version mirror of Cargo.toml; read by vite.config.js at build time
```

### Tauri Commands

| Command | Description |
|---------|-------------|
| `get_lcu_session` | Reads League client lockfile, proxies LCU session API, returns structured ally/enemy data |
| `open_url` | Opens URLs in the system browser (WebView doesn't do this natively) |
| `control_overlay` | Show or hide the overlay window |
| `set_overlay_shortcut` | Register/update the global hotkey for overlay toggle |

### Overlay Window

Declared in `tauri.conf.json` as a second WebView window (`label: "overlay"`) loading `index.html?mode=overlay`. It is transparent, always-on-top, non-resizable, and skips the taskbar. `main.jsx` checks for `?mode=overlay` and renders `<OverlayApp>` instead of the main app.

---

## Data Flow

### Web request

1. User enters role + draft in `DraftForm`.
2. Frontend POSTs `{ role, allies, enemies, patch, tier, pool }` to `POST /api/recommend`.
3. Backend fetches matchup data for every champion in the role pool (concurrent, semaphore=5):
   - `ep=counter` ×5 vslane → ~161 tagged matchups per champion
   - `ep=build-team` → ally synergy by lane
4. Candidates are scored with `compute_rating()` and sorted; top 10 returned.
5. Frontend re-scores the top 10 with role weights via `computeComponents()` for live sort.

### Desktop auto-fill

1. `useLCUSession()` polls `get_lcu_session` every 2 seconds.
2. When a champion select phase is detected, ally/enemy slots and user role are auto-filled into the main app state.
3. Main app writes the resolved draft to `localStorage['rabadon-overlay-draft']` on every state change.
4. Overlay window receives updates via the `storage` event and re-scores as needed.

---

## CI

`.github/workflows/ci.yml` runs on every push and PR to `main`:

- **backend**: `ruff check --select F .` (undefined names + unused imports) + `python -c "import main"` smoke test + `pytest` if tests exist
- **frontend**: `npm ci` → `npm run test` (Vitest) → `npm run build`
