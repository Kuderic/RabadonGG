# Rabadon.GG

Real-time champion select assistant for League of Legends. Enter your role and the draft so far — allies and enemies — and get ranked recommendations based on normalized synergy and counter deltas sourced live from lolalytics.

## Quick start

**Backend**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## How it works

1. User selects their role and types ally/enemy champions into the draft form.
2. Frontend POSTs to `POST /api/recommend`.
3. Backend queries lolalytics (`a1.lolalytics.com/mega/`) across all 5 opponent lanes to get ~161 matchups per candidate (vs. the default 40-cap), extracts normalized win-rate deltas (d2).
4. Candidates are scored by weighted synergy + counter delta, ranked, and returned with per-champion breakdown data including sample sizes.
5. Results are disk-cached with a 1-day TTL (keyed by patch/lane) and pre-loaded into process memory at startup for fast subsequent requests.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite |
| Backend | FastAPI (Python 3.11+) |
| Data source | lolalytics `a1.lolalytics.com/mega/` API |
| Champion images | Riot Data Dragon |

## Docs

See [`docs/`](docs/) for architecture, algorithm design, API contract, and dev guide.
