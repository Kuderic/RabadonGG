# CLAUDE.md — Rabadon.GG

This file gives Claude Code the context it needs to assist with planning and building this project effectively.

---

## Project Overview

**Rabadon.GG** is a League of Legends champion select assistant that solves a gap no existing app has closed: real-time, situational, multi-conditional stat synthesis during champion select (champ select window is ~1–2 minutes).

Existing sites like lolalytics show conditional winrates (e.g. "what items on Jax given Renekton is the matchup AND Graves is the enemy jungler") but each condition requires its own page. A player would need to check up to 9 pages in under 2 minutes — impossible in practice. This app reads the draft, pulls all relevant conditional data simultaneously, and uses an LLM to synthesize a recommendation with plain-language reasoning.

**Core differentiator:** LLM reasoning layer on top of conditional stats. Not just what — but *why*, with caveats (sample sizes, patch timing, snowball item inflation, etc.).

---

## Team

| Person | Role | Background |
|--------|------|------------|
| Eric | Backend, data pipeline, LCU integration, algo design | UIUC CS MS, 1.5yrs data/platform eng at startup, AWS, high elo (Challenger ADC) |
| Michael | Frontend, UX, domain validation | UIUC CS, ex-pro LoL player (NACL Tier 2), building Recall.gg |

---

## Monorepo Structure

```
rabadon/
  frontend/        # React app (shared between web and Electron desktop)
  backend/         # FastAPI (Python)
  DECISIONS.md     # Log of non-obvious technical/product decisions
  CLAUDE.md        # This file
  README.md
```

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React | Shared between web and Electron |
| Desktop shell | Electron | Wraps React app for overlay use |
| Web deploy | Vercel | Frontend only |
| Backend | FastAPI (Python) | Async, stats-friendly (numpy/scipy) |
| Database | Postgres via Supabase | Free tier for MVP |
| Cache | Redis via Railway | Caches lolalytics scrape results |
| Auth | Supabase | Google + Discord OAuth |
| LLM | Anthropic API (Claude) | Called server-side only — API key never exposed to client |
| Cloud (post-MVP) | AWS EC2 + RDS | Migrate from Supabase/Railway when traffic justifies |

---

## Architecture

### Data Flow (MVP)
1. User inputs their role + partial draft (currently selected enemy + ally champions) into the web UI, OR the desktop app reads draft automatically via the **LCU API** (Riot-sanctioned local API that reads the League client).
2. Backend (FastAPI) receives draft context and queries lolalytics for conditional stats (scraped, cached in Redis).
3. Stat aggregation logic scores champion recommendations using weighted winrate deltas.
4. If user has already locked a champion: LLM call (Anthropic API) synthesizes rune page + item build with reasoning.
5. Frontend displays recommendations with transparent underlying data.

### Key Boundaries
- **LCU API** is read-only during draft. Reads champion picks (always public during draft), not player identities. Streamer Mode is not a concern.
- **Anthropic API** called from FastAPI only. Never from the frontend or Electron renderer process.
- **Scraping** is the MVP data source. Own Riot API stat pipeline is the long-term replacement. Redis caching is critical to avoid repeat scrapes and IP rate limits.

---

## Core Features (Priority Order)

### MVP — Champion Recommendation
- Input: user's role + partial draft state (ally + enemy champions + roles)
- Output: ranked list of recommended champion picks for the user's role, with scores and explanations
- Score = weighted aggregate of conditional winrate deltas (ally synergy + enemy counters), with role-based weighting (e.g. ADC vs ADC matchup weighted higher than ADC vs TOP)
- Transparent data: show the user which conditional stats contributed to the score
- LLM qualification: flag low sample sizes, new patch data gaps, misleading stats

### Post-Lock — Build & Rune Synthesis
- Input: locked champion + full enemy team
- Output: recommended rune page + item build
- Source: matchup-conditional item winrates + rune winrates from lolalytics, synthesized by LLM
- LLM reasoning must call out: snowball items, low sample sizes, situational picks

### Personalization
- User can define their champion pool
- Pooled champions are ranked first in recommendations

---

## Algorithm Design (to be finalized)

### Champion Recommendation Score
The core algorithm needs to:
1. Pull conditional winrate for user's champion given each ally and enemy champion (up to 9 data points).
2. Compute a winrate delta vs. baseline for each conditional.
3. Apply role-based weights:
   - ADC matchup (ADC vs ADC): highest weight
   - Support synergy (ADC + Support): high weight
   - Enemy jungler: medium weight
   - Off-roles (ADC vs TOP, ADC vs MID): lower weight
4. Aggregate into a single score per champion candidate.
5. Handle missing data gracefully (new patches, low-play champions).

### Open Algorithm Questions
- Exact weighting formula (linear sum vs. multiplicative vs. something else)?
- How to handle low sample sizes — hard cutoff, soft penalty, or LLM-only flag?
- How to normalize across patches (data from current patch only vs. rolling window)?
- How to handle off-meta picks where lolalytics conditional data doesn't exist?

---

## API Contract (Frontend ↔ Backend)

*To be finalized before parallel development begins. Draft shapes:*

### `POST /recommend`
```json
Request:
{
  "role": "adc",
  "allies": [
    { "champion": "Thresh", "role": "support" },
    { "champion": "Gnar", "role": "top" },
    { "champion": "Vi", "role": "jungle" },
    { "champion": "Orianna", "role": "mid" }
  ],
  "enemies": [
    { "champion": "Draven", "role": "adc" },
    { "champion": "Leona", "role": "support" },
    { "champion": "Renekton", "role": "top" },
    { "champion": "Graves", "role": "jungle" },
    { "champion": "Syndra", "role": "mid" }
  ],
  "champion_pool": ["Jinx", "Caitlyn", "Jhin"]
}

Response:
{
  "recommendations": [
    {
      "champion": "Caitlyn",
      "score": 0.87,
      "synergy_delta": "+1.1%",
      "counter_delta": "+1.2%",
      "data_warnings": ["Caitlyn vs Graves: only 180 games this patch"]
    }
  ]
}
```

### `POST /build`
```json
Request:
{
  "champion": "Caitlyn",
  "role": "adc",
  "enemies": [
    { "champion": "Draven", "role": "adc" },
    { "champion": "Leona", "role": "support" },
    { "champion": "Renekton", "role": "top" },
    { "champion": "Graves", "role": "jungle" },
    { "champion": "Syndra", "role": "mid" }
  ],
}

Response:
{
  "runes": { ... },
  "items": { "core": [...], "situational": [...] },
  "reasoning": "...",
  "data_warnings": [...]
}
```

---

## Git Workflow

- `main` is always deployable.
- Branch naming: `feature/lcu-api`, `fix/winrate-calc`, `chore/db-migrations`
- PR → review by other person → merge. Keep branches short-lived (merge within 1–2 days).
- No `develop` or `release` branches — overkill for a two-person team.
- Log all non-obvious decisions in `DECISIONS.md` with a one-liner rationale.

---

## Environment Variables (never commit these)

```
# Backend (.env)
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
REDIS_URL=
RIOT_API_KEY=          # for future own-stat pipeline
```

---

## Open Questions / Next Steps

1. **LCU API mapping** — confirm exactly which fields are available during draft phase (champion IDs, assigned roles, pick order).
2. **Lolalytics data structure** — map the conditional stat pages: what URL patterns exist, what JSON fields are returned, what are the rate limits.
3. **Algorithm weights** — decide weighting formula for multi-conditional score aggregation.
4. **Riot ToS / overlay compliance** — confirm standalone Electron app path (no Overwolf needed, per iTero precedent).
5. **Monetization** — freemium model likely: free core features, paid tier ($4.99–$9.99/mo) for LLM synthesis + build recommendations.
6. **MVP scope gate** — ship champion recommendation first, validate the synthesis loop, then add build/rune feature.

---

## Competitive Context (for product decisions)

- **iTero.gg** is the main competitor: 527k installs, 4.4★, ML-based draft coach. Acquired by GiantX esports org — founder's attention is now split. Their documented weakness: no LLM reasoning layer, no lolalytics-depth conditional data, no sample size qualification.
- **lolalytics** is the gold standard data source (not an app — a website). The conditional stat depth there is unmatched; we are building on top of it.
- **Blitz/Mobalytics/Porofessor** are large but stagnating; their draft tools are dressed-up tier lists.

**Positioning:** *"Why don't high elo players always trust the stats? Because they aren't representative of your exact situation. Rabadon.gg is."*

---

## Notes for Claude Code

- When writing backend code, prefer **async FastAPI** patterns throughout — the data pipeline involves concurrent scraping + LLM calls.
- All LLM calls go through a single service module in the backend. Do not scatter Anthropic API calls across routes.
- The scraping layer and the stat calculation layer should be cleanly separated so the scraping module can be swapped for a Riot API pipeline later without touching the algorithm logic.
- When suggesting database schemas, account for caching conditional stat lookups keyed by `(champion, role, ally_set, enemy_set, patch_version)`.
- Champion recommendation scoring logic should be unit-testable in isolation — keep it pure (no I/O inside the scoring function).
- Flag any suggestion that would expose the Anthropic API key to the client — that is a hard constraint.
