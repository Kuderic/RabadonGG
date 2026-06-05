# Rabadon.GG

> **Try it now — no install needed: [www.rabadon.gg](https://www.rabadon.gg)**

**Draft-aware champion select assistant for League of Legends**

Tier lists rank champions in a vacuum. Rabadon.GG reads the draft in front of you — all five enemies and all four allies — and scores every champion in your role pool against that exact game. You get the top 10 picks for your specific situation, with full synergy and counter math behind each one.

---

## Features

- **Draft-aware scoring** — base win rate + counter delta (vs all 5 enemies) + synergy delta (with all 4 allies), weighted by role relevance
- **Full matchup breakdown** — open any pick to see every individual matchup contribution, labeled and signed
- **Real match data** — millions of games from your patch and rank tier, updated each patch
- **Sample-size transparency** — low-sample matchups are flagged and optionally down-weighted so 50 games ≠ 10,000 games
- **Configurable weights** — tune how much each enemy/ally lane factors into the score; adjust counter vs. synergy blend
- **Shareable links** — the full draft state is encoded in the URL
- **Windows desktop app** — auto-reads your champion select from the League client in real time, no typing needed

---

## Desktop app (Windows)

The desktop app connects to the League client and automatically fills in your draft as champions are picked and banned.

**[Download the latest release →](https://github.com/Kuderic/RabadonGG/releases)**

| | |
|---|---|
| Platform | Windows 10 / 11 |
| Size | ~24.6 MB |
| Format | Installer (.exe) |

**Install in three steps:**
1. Download `RabadonGG-Setup.exe` and run it. Windows may show a SmartScreen notice — click **More info → Run anyway**.
2. Launch Rabadon and open the League client. The app detects your session automatically.
3. Enter champion select. Your draft fills in live as picks lock in.

**Is it safe?**
The app reads one local LCU endpoint to get the draft state. It cannot pick, ban, click, or chat — read-only access only. Full source is auditable here on GitHub. Each release includes a SHA256 checksum. Read-only LCU use is permitted under Riot's third-party policy.

---

## How scoring works

```
Rating = Base WR + Counter Δ + Synergy Δ
```

- **Base WR** — champion's overall win rate for your role, patch, and tier
- **Counter Δ** — sum of win-rate deltas against each enemy champion, weighted by their lane's relevance to yours
- **Synergy Δ** — sum of win-rate deltas alongside each ally champion, weighted by their lane's relevance to yours

Data is sourced from lolalytics, queried across all five `vslane` values to capture ~161 matchups per champion. All deltas are from real match outcomes — no tier lists, no editorial opinion.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite |
| Desktop shell | Tauri (Rust) |
| Backend | FastAPI (Python) |
| Cache | SQLite (1-day TTL) |
| Data source | lolalytics |
| Hosting | AWS EC2 |

---

## Developer setup

See [`docs/dev-guide.md`](docs/dev-guide.md) for full local setup, environment variables, and deployment. Architecture in [`docs/architecture.md`](docs/architecture.md).

Quick start:

```bash
# Backend
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

Desktop build (Windows — requires VS 2022 Build Tools + Rust):
```powershell
.\desktop\build.ps1
```

---

*Rabadon.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.*
