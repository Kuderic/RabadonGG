# API Contract (Frontend ↔ Backend)

Base URL: `http://localhost:8000` (dev) — mounted under `/api`.

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
    { "champion": "Draven",  "role": "adc" },
    { "champion": "Thresh",  "role": "support" },
    { "champion": "Malphite","role": "top" }
  ]
}
```

- `role` — the player's role: `top | jungle | mid | adc | support`
- `allies` / `enemies` — partial list, empty slots omitted. Empty champion string → skip.

### Response
```json
{
  "patch": "16.11",
  "tier": "Emerald+",
  "recommendations": [
    {
      "champion": "Xayah",
      "win_rate": 53.07,
      "total_games": 54000,
      "synergy_delta": "+2.1%",
      "synergy_breakdown": [
        { "champion": "Blitzcrank", "role": "support", "delta": "+2.1%", "n": 8432 }
      ],
      "synergy_missing": [],
      "counter_delta": "+0.9%",
      "counter_breakdown": [
        { "champion": "Draven",  "role": "adc",     "delta": "+0.9%", "n": 1184 },
        { "champion": "Thresh",  "role": "support",  "delta": "+0.9%", "n": 3796 }
      ],
      "counter_missing": ["Malphite"],
      "data_warnings": []
    }
  ]
}
```

**Key fields:**

| Field | Description |
|-------|-------------|
| `win_rate` | Champion baseline WR for this role/patch/tier (%) |
| `total_games` | Total games in lolalytics dataset for this champion/role |
| `synergy_delta` | Averaged normalized delta (d2) across allies with data |
| `synergy_breakdown` | Per-ally delta + `n` (sample size) |
| `synergy_missing` | Allies for whom no synergy data exists in the top-161 matchup set |
| `counter_delta` | Averaged normalized delta (d2) across enemies with data |
| `counter_breakdown` | Per-enemy delta + `n` |
| `counter_missing` | Enemies outside the top-161 matchup set (no data) |
| `data_warnings` | Low sample size flags (< 200 games) |

Recommendations are sorted by composite score (descending). Top 10 returned.

---

## Data source

All stats from `https://a1.lolalytics.com/mega/` — queried with:
- `ep=counter` × 5 (`vslane=top|jungle|middle|bottom|support`) — merged, ~161 unique matchups
- `ep=build-team` — ally synergy organized by lane
- `ep=list` — champion pool for a role (`defaultLane` filter)

d2 = normalized synergy delta (adjusted to 50% baseline WR). Values divided by 100 for decimal format internally.
