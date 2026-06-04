# Open Questions / Next Steps

## Resolved

1. **Lolalytics data structure** — mapped. Uses `a1.lolalytics.com/mega/` with `ep=counter` (queried per `vslane` to bypass 40-cap), `ep=build-team`, and `ep=list`. d2 = normalized synergy delta. Champion IDs match Riot Data Dragon.
2. **Algorithm weights** — implemented in `backend/services/scorer.py`. Synergy and counter deltas are averaged across allies/enemies respectively and combined with the champion's baseline win rate.
3. **MVP scope** — champion recommendation is shipped and working end-to-end.

## Open

1. **LCU API integration** — auto-reading the draft from the League client during champion select would remove manual entry. Riot's LCU API is read-only and sanctioned. Not yet implemented; currently requires manual input.

2. **Build/rune recommendations** — `POST /build` endpoint is not yet implemented. Would use lolalytics `ep=build` data + optional LLM synthesis for reasoning. Stub models removed until this is prioritized.

3. **Patch auto-update** — the `PATCH` constant in `backend/services/scraper.py` is hardcoded to `"16.11"`. Should be read from the Data Dragon versions API and updated automatically when a new patch ships (the infra exists in `_get_patch()` but the constant overrides it).

4. **Rate limiting / lolalytics ToS** — cold-start fetches ~156 HTTP calls (26 champions × 6 endpoints). Semaphore limits concurrency to 5 candidates at a time. Consider adding inter-request jitter or a pre-warm cron if this becomes an issue.

5. **Monetization** — freemium model likely: free core recommendations, paid tier for LLM build synthesis + rune pages.
