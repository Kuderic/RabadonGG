"""POST /recommend endpoint for champion recommendations."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from models import ChampionDelta, Recommendation, RecommendRequest, RecommendResponse
from services.scorer import (
    get_counter_breakdown,
    get_counter_delta_string,
    get_synergy_breakdown,
    get_synergy_delta_string,
    score_champion,
)
from services.scraper import PATCH, TIER, get_champion_pool, get_matchup_data

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_ROLES = {"adc", "support", "mid", "jungle", "top"}

TIER_DISPLAY = {
    "emerald_plus": "Emerald+",
    "diamond_plus": "Diamond+",
    "platinum_plus": "Platinum+",
    "gold": "Gold",
    "all": "All Ranks",
}


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(request: RecommendRequest) -> RecommendResponse:
    role = request.role.lower()

    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{role}'. Must be one of: {', '.join(sorted(VALID_ROLES))}"
        )

    allies = [
        {"champion": a.champion, "role": a.role}
        for a in request.allies if a.champion.strip()
    ]
    enemies = [
        {"champion": e.champion, "role": e.role}
        for e in request.enemies if e.champion.strip()
    ]

    candidates = await get_champion_pool(role)
    if not candidates:
        raise HTTPException(
            status_code=503,
            detail=f"Champion pool unavailable for role '{role}'. Try again shortly."
        )

    # Limit concurrent outbound fetches — 5 candidates at once = 5×6 = 30 HTTP calls max
    sem = asyncio.Semaphore(5)

    async def _score_candidate(candidate: str) -> tuple | None:
        async with sem:
          try:
            matchup_data, matchup_n, win_rate, total_games, data_warnings = (
                await get_matchup_data(candidate, role, allies, enemies)
            )
            score = score_champion(candidate, role, allies, enemies, matchup_data)
            syn_breakdown, syn_missing = get_synergy_breakdown(allies, matchup_data, matchup_n)
            ctr_breakdown, ctr_missing = get_counter_breakdown(enemies, matchup_data, matchup_n)
            rec = Recommendation(
                champion=candidate,
                win_rate=win_rate,
                total_games=total_games,
                synergy_delta=get_synergy_delta_string(candidate, allies, matchup_data),
                synergy_breakdown=[ChampionDelta(**b) for b in syn_breakdown],
                synergy_missing=syn_missing,
                counter_delta=get_counter_delta_string(candidate, enemies, matchup_data),
                counter_breakdown=[ChampionDelta(**b) for b in ctr_breakdown],
                counter_missing=ctr_missing,
                data_warnings=data_warnings,
            )
            return score, rec
          except Exception as e:
            logger.error(f"Error scoring {candidate}: {e}")
            return None

    results = await asyncio.gather(*[_score_candidate(c) for c in candidates])
    scored = [(score, rec) for r in results if r is not None for score, rec in [r]]
    scored.sort(key=lambda x: x[0], reverse=True)
    top_recommendations = [rec for _, rec in scored[:10]]

    logger.info(f"Generated {len(top_recommendations)} recommendations for role '{role}'")
    return RecommendResponse(
        patch=PATCH,
        tier=TIER_DISPLAY.get(TIER, TIER),
        recommendations=top_recommendations,
    )
