"""POST /recommend endpoint for champion recommendations."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from models import ChampionDelta, Recommendation, RecommendRequest, RecommendResponse
from services.scorer import (
    compute_rating,
    get_counter_breakdown,
    get_counter_delta_string,
    get_synergy_breakdown,
    get_synergy_delta_string,
)
from services.scraper import PATCH, TIER, get_champion_pool, get_matchup_data

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_ROLES = {"adc", "support", "mid", "jungle", "top"}
VALID_TIERS = {"emerald_plus", "diamond_plus", "platinum_plus", "gold_plus", "all"}

TIER_DISPLAY = {
    "emerald_plus": "Emerald+",
    "diamond_plus": "Diamond+",
    "platinum_plus": "Platinum+",
    "gold_plus": "Gold+",
    "all": "All Ranks",
}


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(request: RecommendRequest) -> RecommendResponse:
    role = request.role.lower()
    patch = request.patch or PATCH
    tier = request.tier or TIER

    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{role}'. Must be one of: {', '.join(sorted(VALID_ROLES))}"
        )

    if tier not in VALID_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier '{tier}'. Must be one of: {', '.join(sorted(VALID_TIERS))}"
        )

    allies = [
        {"champion": a.champion, "role": a.role}
        for a in request.allies if a.champion.strip()
    ]
    enemies = [
        {"champion": e.champion, "role": e.role}
        for e in request.enemies if e.champion.strip()
    ]

    candidates = await get_champion_pool(role, patch=patch, tier=tier)
    if not candidates:
        raise HTTPException(
            status_code=503,
            detail=f"Champion pool unavailable for role '{role}'. Try again shortly."
        )

    drafted = {c["champion"].lower() for c in allies + enemies}
    candidates = [c for c in candidates if c.lower() not in drafted]

    sem = asyncio.Semaphore(15)

    async def _score_candidate(candidate: str) -> tuple | None:
        async with sem:
            try:
                matchup_data, matchup_n, win_rate, total_games, data_warnings = (
                    await get_matchup_data(candidate, role, allies, enemies, patch=patch, tier=tier)
                )
                rating = compute_rating(win_rate, allies, enemies, matchup_data, matchup_n)
                syn_breakdown, syn_missing = get_synergy_breakdown(allies, matchup_data, matchup_n)
                ctr_breakdown, ctr_missing = get_counter_breakdown(enemies, matchup_data, matchup_n)
                rec = Recommendation(
                    champion=candidate,
                    win_rate=win_rate,
                    rating=rating,
                    total_games=total_games,
                    synergy_delta=get_synergy_delta_string(candidate, allies, matchup_data),
                    synergy_breakdown=[ChampionDelta(**b) for b in syn_breakdown],
                    synergy_missing=syn_missing,
                    counter_delta=get_counter_delta_string(candidate, enemies, matchup_data),
                    counter_breakdown=[ChampionDelta(**b) for b in ctr_breakdown],
                    counter_missing=ctr_missing,
                    data_warnings=data_warnings,
                )
                return rating, rec
            except Exception as e:
                logger.error(f"Error scoring {candidate}: {e}")
                return None

    # Parse pool: deduplicate and filter drafted champions
    pool_names = list(dict.fromkeys(p.strip() for p in request.pool if p.strip()))
    pool_names = [p for p in pool_names if p.lower() not in drafted]

    # Score candidates and pool in one gather so pool doesn't add latency
    all_names = candidates + pool_names
    all_results = await asyncio.gather(*[_score_candidate(c) for c in all_names])

    candidate_results = all_results[:len(candidates)]
    pool_results = all_results[len(candidates):]

    scored = [(r, rec) for item in candidate_results if item is not None for r, rec in [item]]
    scored.sort(key=lambda x: x[0], reverse=True)
    top_recommendations = [rec for _, rec in scored]

    pool_scored = [(r, rec) for item in pool_results if item is not None for r, rec in [item]]
    pool_scored.sort(key=lambda x: x[0], reverse=True)
    pool_picks = [rec for _, rec in pool_scored]

    logger.info(f"Generated {len(top_recommendations)} recommendations + {len(pool_picks)} pool picks for role '{role}' (patch={patch}, tier={tier})")
    return RecommendResponse(
        patch=patch,
        tier=TIER_DISPLAY.get(tier, tier),
        recommendations=top_recommendations,
        pool_picks=pool_picks,
    )
