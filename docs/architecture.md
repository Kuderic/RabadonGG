# Architecture

## Monorepo Structure

```
RabadonGG/
  frontend/          # React + Vite app
  backend/           # FastAPI (Python)
  docs/              # Project documentation
  CLAUDE.md          # Claude Code instructions
  README.md
```

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React + Vite | |
| Backend | FastAPI (Python 3.11+) | Async, runs on uvicorn |
| Data source | lolalytics mega API | `a1.lolalytics.com/mega/` — no API key needed |
| Champion images | Riot Data Dragon | CDN, no auth needed |
| Cache | File-based JSON + process memory | 1-day TTL, keyed by patch/lane/champion |

---

## Data Flow

1. User enters their role + partial draft (ally and enemy champions) into the web UI.
2. Frontend POSTs `{ role, allies, enemies }` to `POST /api/recommend`.
3. Backend fetches matchup data from lolalytics for each candidate in the role pool:
   - `ep=counter` × 5 opponent lanes → ~161 merged matchups per candidate
   - `ep=build-team` → ally synergy data
4. Candidates are scored using normalized win-rate deltas (d2), ranked, and the top 10 returned.
5. Data is cached to disk (`backend/data/lolalytics/{patch}/{lane}/`) with a 1-day TTL and pre-loaded into process memory at server startup.

---

## Backend Layout

```
backend/
  main.py                  # FastAPI app, CORS, startup warm-cache
  models.py                # Pydantic request/response models
  routes/
    recommend.py           # POST /api/recommend
  services/
    scraper.py             # lolalytics API client + file cache
    scorer.py              # Scoring algorithm + breakdown helpers
  data/
    lolalytics/            # Runtime cache (gitignored)
      _patch.json
      _champ_map.json
      {patch}/{lane}/
        _pool.json
        {champion}.json
```

---

## Key Boundaries

- **No database** — all persistent state is file-cached lolalytics data. Stateless per request beyond that.
- **No auth** — MVP is a local dev tool.
- **No LLM calls yet** — build/rune synthesis is a planned feature, not implemented.
- **Data Dragon** is used only for champion name → image URL mapping. Champion IDs match lolalytics CIDs exactly.
