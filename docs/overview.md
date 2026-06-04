# Project Overview

**Rabadon.GG** is a League of Legends champion select assistant that solves a gap no existing app has closed: real-time, situational, multi-conditional stat synthesis during champion select (champ select window is ~1–2 minutes).

Existing sites like lolalytics show conditional winrates (e.g. "what items on Jax given Renekton is the matchup AND Graves is the enemy jungler") but each condition requires its own page. A player would need to check up to 9 pages in under 2 minutes — impossible in practice. This app reads the draft, pulls all relevant conditional data simultaneously, and uses an LLM to synthesize a recommendation with plain-language reasoning.

**Core differentiator:** LLM reasoning layer on top of conditional stats. Not just what — but *why*, with caveats (sample sizes, patch timing, snowball item inflation, etc.).

---

## Team

| Person | Role | Background |
|--------|------|------------|
| Eric | Backend, data pipeline, LCU integration, algo design | UIUC CS MS, 1.5yrs data/platform eng at startup, AWS, high elo (Challenger ADC) |

---

## Competitive Context

- **iTero.gg** is the main competitor: 527k installs, 4.4★, ML-based draft coach. Acquired by GiantX esports org — founder's attention is now split. Their documented weakness: no LLM reasoning layer, no lolalytics-depth conditional data, no sample size qualification.
- **lolalytics** is the gold standard data source (not an app — a website). The conditional stat depth there is unmatched; we are building on top of it.
- **Blitz/Mobalytics/Porofessor** are large but stagnating; their draft tools are dressed-up tier lists.

**Positioning:** *"Why don't high elo players always trust the stats? Because they aren't representative of your exact situation. Rabadon.gg is."*
