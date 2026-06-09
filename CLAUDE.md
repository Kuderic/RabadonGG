# CLAUDE.md — Rabadon.GG

This file gives Claude Code the context it needs to assist with planning and building this project effectively.

## Project status

Shipped and live at **www.rabadon.gg**. The app is a champion-select assistant: user enters their role + full draft (up to 4 allies, 5 enemies), backend scores every champion in the role pool using normalized synergy/counter deltas from lolalytics, and returns top 10 ranked picks with per-champion breakdown. Frontend supports full mobile layout with bottom-sheet breakdown panel.

## Key implementation facts

- **Data source**: `a1.lolalytics.com/mega/` — no API key needed. `ep=counter` queried × 5 `vslane` values to get ~161 matchups per champion (bypasses the default 40-cap). `d2` = normalized synergy delta (divide by 100 for decimal). `n` = per-matchup game count.
- **Caching**: SQLite at `backend/data/rabadon_cache.db` (1-day TTL, keyed by champion+patch+tier+lane) + process-memory dict warm-loaded at startup. Redis is **not used**.
- **Champion ID mapping**: lolalytics CIDs match Riot Data Dragon IDs exactly. Display names from `val["name"]` (e.g. "Miss Fortune"), DDragon key from `val` JSON key (e.g. "MissFortune").
- **Scoring**: `backend/services/scorer.py` — `compute_rating()` sums d2 deltas for all ally/enemy matchups, adds to base win rate. No ML. Frontend re-scores with role weights + sample-size penalty for live sorting (`src/utils/scoring.js`).
- **Frontend scoring**: `computeComponents(rec, config, playerRole)` in `src/utils/scoring.js` — applies per-role enemy/ally weights, penalty multiplier (sqrt(n/threshold)), and blend multipliers to produce adjusted synergy+counter contributions. This is the single source of truth for both RecommendationList sorting and BreakdownPanel display.
- **Frontend**: React + Vite at `localhost:5173`. Champion icons from DDragon CDN. Calls `POST /api/recommend`.
- **No `/build` endpoint** — planned for a future iteration.
- **CORS**: Controlled by `ALLOWED_ORIGINS` env var. Unset = localhost dev defaults. Production: `ALLOWED_ORIGINS=https://rabadon.gg,https://www.rabadon.gg`.

## Frontend architecture

```
src/
  App.jsx                    — root state, tab nav (Draft | Configuration), lazy-loaded panels
  App.css                    — all styles including responsive breakpoints (≤768px bottom-sheet)
  utils/
    champion.js              — champIconUrl(), champSlug()
    scoring.js               — getMultiplier(), computeComponents() — shared by all scoring UI
  components/
    DraftForm.jsx            — champion autocomplete inputs, role selector, read-only patch/tier display
    RecommendationList.jsx   — sorted cards, sort toggle, Penalize low sample checkbox
    BreakdownPanel.jsx       — full matchup breakdown; fixed bottom-sheet on mobile
    ConfigPanel.jsx          — Population (patch/tier), Sample Size Penalty, Role Weighting, Score Multipliers
    TierSelector.jsx         — shared custom dropdown + TierDisplay (read-only) — used by DraftForm + ConfigPanel
    ChampionShared.jsx       — RankBadge, ExternalLink — shared by RecommendationList + BreakdownPanel
```

### Key UX behaviours
- **Enter key**: selects first-highlighted autocomplete item; second Enter submits if dropdown closed
- **Champion icon**: shows only when input value exactly matches a champion name (case-insensitive)
- **Dropdown exclusivity**: custom `closeDropdowns` CustomEvent — opening any dropdown closes all others
- **Mobile breakdown**: `position: fixed` bottom sheet (75vh, `z-index: 501`) with backdrop; desktop is inline block below grid
- **Auto-scroll**: `breakdownRef.scrollIntoView({ behavior: 'smooth' })` fires when `selectedRec` changes

## Backend architecture

```
backend/
  main.py                — FastAPI app, CORS from env, startup warm_cache(), champion icon proxy
  models.py              — Pydantic request/response models (RecommendRequest, RecommendResponse, ChampionDelta)
  routers/
    recommend.py         — POST /api/recommend — fetches matchup data, scores all pool champions, returns top 10
  services/
    scraper.py           — async lolalytics fetcher; returns matchup_data dict + matchup_n game counts
    scorer.py            — compute_rating(), get_synergy_breakdown(), get_counter_breakdown()
    db.py                — SQLite cache (matchup_cache + pool_cache tables, 1-day TTL by fetched_at date)
  scoring_config.py      — per-role enemy/ally weights + blend multipliers (all 1.0 by default, user-tunable via UI)
  data/
    rabadon_cache.db     — gitignored SQLite cache
```

### Known design decisions
- `scoring_config.py` weights are the **backend defaults** only — the frontend `DEFAULT_CONFIG` in `App.jsx` mirrors these. The frontend re-applies weights live, so users can tune without re-fetching.
- `d2` values from lolalytics are already divided by 100 in the scraper before storage. `_fmt()` in scorer.py multiplies by 100 back for display strings (e.g. `"+2.8%"`).
- Pool cache (`pool_cache` table) stores the list of valid champion names per lane+patch+tier to avoid re-fetching on every request.

## Full documentation

| File | Contents |
|------|----------|
| [docs/overview.md](docs/overview.md) | Project overview, team, competitive context |
| [docs/architecture.md](docs/architecture.md) | Monorepo structure, tech stack, data flow, file layout |
| [docs/features.md](docs/features.md) | Core features in priority order |
| [docs/algorithm.md](docs/algorithm.md) | Champion scoring algorithm design |
| [docs/api.md](docs/api.md) | Actual API contract with real request/response shapes |
| [docs/dev-guide.md](docs/dev-guide.md) | Git workflow, environment variables |
| [docs/ops.md](docs/ops.md) | **Production runbook**: hosting topology, the `rabadon` systemd service, deploy scripts, and operational gotchas. Read before touching the running backend. |
| [docs/open-questions.md](docs/open-questions.md) | Resolved decisions + remaining open items |
