# Rabadon.GG

> **Try it now — no install needed: [www.rabadon.gg](https://www.rabadon.gg)**

**Champion select assistant for League of Legends**

Enter your role and the champions picked so far on both sides. Rabadon scores every champion in your role pool against the actual draft and shows you the top 10 picks, ranked by how well they perform *in this specific game* — not just in general.

---

## Features

- **Draft-aware scoring** — accounts for synergy with your allies and win rate against each enemy
- **Real match data** — millions of games from your selected patch and rank tier, updated each patch
- **Sample-size transparency** — rare matchups are flagged and can be down-weighted
- **Configurable weights** — tune how much each lane's picks factor into the score
- **Shareable links** — every draft state is encoded in the URL
- **Windows desktop app** — auto-reads your champion select in real time, no typing needed

---

## Desktop app (Windows)

The desktop app connects to the League client and automatically fills in your draft as champions are picked and banned — no manual entry.

**[Download the latest release →](https://github.com/Kuderic/RabadonGG/releases)**

> **Note:** Windows may show a "Windows protected your PC" SmartScreen warning on first run. This is normal for new unsigned apps from indie developers. Click "More info" → "Run anyway" to proceed. The app reads only the League client's local API — it does not modify any game files.

---

## How scoring works

Every recommendation starts from the champion's base win rate for your role and tier. Two adjustments are added on top:

```
Rating = Base WR + Counter Δ + Synergy Δ
```

- **Counter Δ** — sum of win-rate deltas this champion has against each picked enemy
- **Synergy Δ** — sum of win-rate deltas when paired with each picked ally

All deltas come from real match outcomes — no tier lists, no editorial opinion.

---

## Use it now

**Web app:** [www.rabadon.gg](https://www.rabadon.gg) — no install needed

**Desktop app:** [Download for Windows](https://github.com/Kuderic/RabadonGG/releases) — auto-fills from champion select

---

## Developer setup

See [`docs/dev-guide.md`](docs/dev-guide.md) for local setup, environment variables, and deployment. Full architecture in [`docs/architecture.md`](docs/architecture.md).

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

Desktop build (Windows, requires VS 2022 Build Tools + Rust):
```powershell
.\desktop\build.ps1
```

---

*Rabadon.GG is not endorsed by Riot Games and does not affect gameplay. It reads only the League Client's local API during champion select.*
