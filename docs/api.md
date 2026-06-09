# API Contract (Frontend ↔ Backend)

Base URL: `http://localhost:8000` (dev) / `https://www.rabadon.gg` (prod) — all routes mounted under `/api`.

---

## `POST /api/recommend`

### Request

```json
{
  "role": "adc",
  "allies": [
    { "champion": "Blitzcrank", "role": "support" }
  ],
  "enemies": [
    { "champion": "Draven",   "role": "adc" },
    { "champion": "Thresh",   "role": "support" },
    { "champion": "Malphite", "role": "top" }
  ],
  "patch": "16.11",
  "tier": "emerald_plus",
  "pool": ["Caitlyn", "Jinx", "Jhin"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `role` | string | Player's role: `top \| jungle \| mid \| adc \| support` |
| `allies` | array | Ally champions with roles; empty champion string → skip |
| `enemies` | array | Enemy champions with roles; empty champion string → skip |
| `patch` | string | Patch version e.g. `"16.11"` (default: current patch) |
| `tier` | string | Rank tier: `emerald_plus \| diamond_plus \| platinum_plus \| gold_plus \| all` |
| `pool` | array | Champion names in the user's personal pool (scored separately, capped at 20) |

### Response

```json
{
  "patch": "16.11",
  "tier": "Emerald+",
  "recommendations": [
    {
      "champion": "Xayah",
      "win_rate": 53.07,
      "rating": 55.89,
      "total_games": 54000,
      "synergy_delta": "+2.1%",
      "synergy_breakdown": [
        { "champion": "Blitzcrank", "role": "support", "delta": "+2.1%", "n": 8432 }
      ],
      "synergy_missing": [],
      "counter_delta": "+0.9%",
      "counter_breakdown": [
        { "champion": "Draven",  "role": "adc",     "delta": "+0.9%", "n": 1184 },
        { "champion": "Thresh",  "role": "support",  "delta": "+0.4%", "n": 3796 }
      ],
      "counter_missing": ["Malphite"],
      "data_warnings": []
    }
  ],
  "pool_picks": [
    { "champion": "Caitlyn", "win_rate": 52.1, "rating": 54.3, ... }
  ]
}
```

**Key response fields:**

| Field | Description |
|-------|-------------|
| `win_rate` | Champion baseline WR for this role/patch/tier (%) |
| `rating` | Primary sort key: `win_rate + Σ penalized synergy deltas + Σ penalized counter deltas` |
| `total_games` | Total games in the lolalytics dataset for this champion/role |
| `synergy_delta` | Sum of all ally d2 deltas (not penalized; display only) |
| `synergy_breakdown` | Per-ally delta + `n` (sample size) |
| `synergy_missing` | Allies for whom no synergy data exists in the matchup set |
| `counter_delta` | Sum of all enemy d2 deltas (display only) |
| `counter_breakdown` | Per-enemy delta + `n` |
| `counter_missing` | Enemies outside the matchup set (no data) |
| `data_warnings` | Low sample size flags (< 200 games; informational only) |
| `pool_picks` | Same structure as `recommendations` but for the user's pool champions |

Recommendations are sorted by `rating` descending. Top 10 returned. Champions already in the draft (ally or enemy) are excluded.

---

## `GET /api/patches`

Returns the 5 most recent LoL patch versions from Riot Data Dragon.

```json
{ "patches": ["16.11", "16.10", "16.9", "16.8", "16.7"] }
```

---

## `GET /api/champions`

Returns all known champion display names for frontend autocomplete.

```json
{ "champions": ["Aatrox", "Ahri", "Akali", ...] }
```

---

## `GET /api/icon/{name}`

Proxy for champion icons from DDragon — resized to 80×80 WebP with a 7-day cache header. `name` must be the DDragon key (e.g. `MissFortune`, `Nunu`). Returns `image/webp`.

---

## `GET /health`

```json
{ "status": "ok" }
```

Used by the deploy script to verify the backend came up after a restart.

---

## Data source notes

All stats sourced from `a1.lolalytics.com/mega/`:

- `ep=counter` × 5 `vslane` values (`top`, `jungle`, `middle`, `bottom`, `support`) — merged, ~161 unique tagged matchups per champion
- `ep=build-team` — ally synergy data organized by lane
- `ep=list` — champion pool + base win rates for a role+patch+tier

`d2` = normalized synergy delta (adjusted to 50% baseline WR). Stored as a decimal in the cache (divided by 100); formatted back to percent for all API response strings.
