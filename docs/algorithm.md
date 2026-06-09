# Algorithm

## Champion Recommendation Score

```
Rating = Base WR + Counter Δ + Synergy Δ
```

All values are in win-rate percentage points (e.g. 51.3 means 51.3%).

---

## Components

### Base WR

Champion's overall win rate for the user's role, patch, and rank tier from lolalytics `ep=list`. This is the starting point — a champion with 53% base WR starts ahead of one at 49%.

### Counter Δ

Sum of per-enemy win-rate deltas, penalized by sample size:

```
Counter Δ = Σ (d2[enemy] × sample_mult(n[enemy]))   for each enemy in draft
```

Each `d2` value comes from lolalytics `ep=counter` queried with `vslane=<enemy_role>`. When the enemy's role is known, only the role-specific entry is used to avoid contamination (e.g. a Twisted Fate support game should not pull TF mid matchup counts against Caitlyn). When role is unknown, the highest-n entry across all vslane queries is used as a fallback.

### Synergy Δ

Sum of per-ally win-rate deltas, penalized by sample size:

```
Synergy Δ = Σ (d2[ally] × sample_mult(n[ally]))   for each ally in draft
```

`d2` values come from lolalytics `ep=build-team`, organized by ally lane. Lane-specific entry is preferred; falls back to any lane entry if the ally's role is unavailable.

### Sample Multiplier

```python
def sample_mult(n):
    if n <= 0:   return 0.0
    if n >= 1000: return 1.0
    return sqrt(n / 1000)
```

This down-weights matchups with fewer than 1000 games using a square-root curve. Statistical signal-to-noise scales with `sqrt(n)`, so sqrt weighting more accurately reflects confidence loss at lower sample sizes than a linear penalty would. A matchup with 500 games contributes at ~71% weight; 250 games at 50%; 0 games contributes nothing. The threshold (1000) is shared between backend (`scorer.py` `SAMPLE_THRESHOLD`) and frontend (`DEFAULT_CONFIG.penalizeThreshold`).

---

## Data Source

All data is queried from `a1.lolalytics.com/mega/`:

- `ep=counter` × 5 `vslane` values (`top`, `jungle`, `middle`, `bottom`, `support`) — gives ~161 tagged matchup entries per champion, bypassing the default 40-entry cap
- `ep=build-team` — ally synergy data organized by lane
- `ep=list` — champion pool + base win rates for a role+patch+tier

`d2` = normalized synergy delta (adjusted to 50% baseline WR). Stored divided by 100 in the cache; multiplied back to percent for display.

---

## Frontend Re-scoring

The backend returns a `rating` value used for initial sorting, but the frontend re-scores live using `computeComponents()` in `src/utils/scoring.js`. This allows the user to tune role weights and see results update instantly without re-fetching.

The frontend scoring applies per-role weight multipliers on top of the same sample penalty formula:

```
adjustedDelta = d2 × sample_mult(n) × roleWeight[playerRole][matchupRole]
```

Both backend and frontend use the same `penalizeThreshold = 1000` default so rankings stay consistent before any config changes.

---

## Ranking

The backend scores all eligible champions in the role pool (concurrently, semaphore=5), sorts descending by `rating`, and returns the top 10.

Pool champions (user's personal pool) are scored in the same gather call to avoid added latency and returned separately as `pool_picks`.

Champions already in the draft (as allies or enemies) are excluded from the candidate pool before scoring.
