# CLAUDE.md — Rabadon.GG

This file gives Claude Code the context it needs to assist with planning and building this project effectively.

## Project status

MVP is shipped and working end-to-end. The app is a champion-select assistant: user enters their role + partial draft, backend scores every champion in the role pool using normalized synergy/counter deltas from lolalytics, and returns top 10 ranked picks with per-champion breakdown.

## Key implementation facts

- **Data source**: `a1.lolalytics.com/mega/` — no API key needed. `ep=counter` queried × 5 `vslane` values to get ~161 matchups per champion (bypasses the default 40-cap). d2 = normalized synergy delta (divide by 100 for decimal).
- **Caching**: file-based JSON in `backend/data/lolalytics/` (1-day TTL) + process-memory dict loaded at startup. Redis is **not used** (cache.py was removed).
- **Champion ID mapping**: lolalytics CIDs match Riot Data Dragon IDs exactly. Display names from `val["name"]` (e.g. "Miss Fortune"), DDragon key from `val` JSON key (e.g. "MissFortune").
- **Scoring**: `backend/services/scorer.py` — weighted synergy + counter delta average. No external ML.
- **Frontend**: React + Vite at `localhost:5173`. Champion icons from DDragon CDN. Calls `POST /api/recommend`.
- **No `/build` endpoint** — stubs removed. Planned for a future iteration.

## Full documentation

| File | Contents |
|------|----------|
| [docs/overview.md](docs/overview.md) | Project overview, team, competitive context |
| [docs/architecture.md](docs/architecture.md) | Monorepo structure, tech stack, data flow, file layout |
| [docs/features.md](docs/features.md) | Core features in priority order |
| [docs/algorithm.md](docs/algorithm.md) | Champion scoring algorithm design |
| [docs/api.md](docs/api.md) | Actual API contract with real request/response shapes |
| [docs/dev-guide.md](docs/dev-guide.md) | Git workflow, environment variables |
| [docs/open-questions.md](docs/open-questions.md) | Resolved decisions + remaining open items |
