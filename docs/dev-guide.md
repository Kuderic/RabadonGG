# Developer Guide

## Git Workflow

- `main` is always deployable.
- Branch naming: `feature/lcu-api`, `fix/winrate-calc`, `chore/db-migrations`
- PR → review by other person → merge. Keep branches short-lived (merge within 1–2 days).
- No `develop` or `release` branches — overkill for a two-person team.
- Log all non-obvious decisions in `DECISIONS.md` with a one-liner rationale.

---

## Environment Variables

Never commit these.

```
# Backend (.env)
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
REDIS_URL=
RIOT_API_KEY=          # for future own-stat pipeline
```

---

## Notes for Claude Code

- When writing backend code, prefer **async FastAPI** patterns throughout — the data pipeline involves concurrent scraping + LLM calls.
- All LLM calls go through a single service module in the backend. Do not scatter Anthropic API calls across routes.
- The scraping layer and the stat calculation layer should be cleanly separated so the scraping module can be swapped for a Riot API pipeline later without touching the algorithm logic.
- When suggesting database schemas, account for caching conditional stat lookups keyed by `(champion, role, ally_set, enemy_set, patch_version)`.
- Champion recommendation scoring logic should be unit-testable in isolation — keep it pure (no I/O inside the scoring function).
- Flag any suggestion that would expose the Anthropic API key to the client — that is a hard constraint.
