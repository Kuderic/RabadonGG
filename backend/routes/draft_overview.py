"""POST /api/draft-overview endpoint — scores all 10 draft slots in one call."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from models import (
    ChampionDelta,
    DraftOverviewRequest,
    DraftOverviewResponse,
    DraftSlotResult,
    Recommendation,
)
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


@router.post("/draft-overview", response_model=DraftOverviewResponse)
async def draft_overview(request: DraftOverviewRequest) -> DraftOverviewResponse:
    patch = request.patch or PATCH
    tier = request.tier or TIER

    if tier not in VALID_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier '{tier}'. Must be one of: {', '.join(sorted(VALID_TIERS))}"
        )

    # Locked champions for each side — used as context when scoring each slot
    locked_ally = [
        {"champion": s.champion, "role": s.role}
        for s in request.ally if s.locked and s.champion and s.champion.strip()
    ]
    locked_enemy = [
        {"champion": s.champion, "role": s.role}
        for s in request.enemy if s.locked and s.champion and s.champion.strip()
    ]
    all_picked = {
        s.champion.lower()
        for s in (request.ally + request.enemy)
        if s.champion and s.champion.strip()
    }

    sem = asyncio.Semaphore(10)

    async def score_one(champion: str, role: str, allies: list, enemies: list) -> Recommendation | None:
        async with sem:
            try:
                matchup_data, matchup_n, win_rate, total_games, data_warnings = (
                    await get_matchup_data(champion, role, allies, enemies, patch=patch, tier=tier)
                )
                rating = compute_rating(win_rate, allies, enemies, matchup_data, matchup_n)
                syn, syn_miss = get_synergy_breakdown(allies, matchup_data, matchup_n)
                ctr, ctr_miss = get_counter_breakdown(enemies, matchup_data, matchup_n)
                return Recommendation(
                    champion=champion,
                    win_rate=win_rate,
                    rating=rating,
                    total_games=total_games,
                    synergy_delta=get_synergy_delta_string(champion, allies, matchup_data),
                    synergy_breakdown=[ChampionDelta(**b) for b in syn],
                    synergy_missing=syn_miss,
                    counter_delta=get_counter_delta_string(champion, enemies, matchup_data),
                    counter_breakdown=[ChampionDelta(**b) for b in ctr],
                    counter_missing=ctr_miss,
                    data_warnings=data_warnings,
                )
            except Exception as e:
                logger.error(f"Error scoring {champion}/{role}: {e}")
                return None

    # Pre-fetch role pools for all open slots (in parallel, deduplicated by role)
    open_roles = {
        s.role
        for s in (request.ally + request.enemy)
        if not (s.locked and s.champion and s.champion.strip())
        if s.role in VALID_ROLES
    }
    if open_roles:
        pool_names, pool_results = list(open_roles), await asyncio.gather(
            *[get_champion_pool(r, patch=patch, tier=tier) for r in open_roles]
        )
        pools = {
            r: [c for c in (pool or []) if c.lower() not in all_picked]
            for r, pool in zip(pool_names, pool_results)
        }
    else:
        pools = {}

    async def build_slot(slot: "DraftSlot", own_locked: list, opp_locked: list) -> DraftSlotResult:
        champ = (slot.champion or "").strip()
        if slot.locked and champ:
            # Score this champion from its own team's perspective:
            # teammates = own locked minus self, opponents = opposing locked
            teammates = [s for s in own_locked if s["champion"].lower() != champ.lower()]
            rec = await score_one(champ, slot.role, teammates, opp_locked)
            return DraftSlotResult(role=slot.role, locked=True, champion=champ, rec=rec)

        # Open slot: pool is pre-sorted by tier+wr, so [:20] gives the strongest
        # candidates — fast enough on cold cache (20 vs 50+ champions per slot)
        pool = pools.get(slot.role, [])[:20]
        cand_recs = await asyncio.gather(*[
            score_one(c, slot.role, own_locked, opp_locked) for c in pool
        ])
        scored = sorted(
            [r for r in cand_recs if r is not None],
            key=lambda r: r.rating,
            reverse=True,
        )
        return DraftSlotResult(
            role=slot.role,
            locked=False,
            candidates=scored[:10],
        )

    ally_tasks = [build_slot(s, locked_ally, locked_enemy) for s in request.ally]
    enemy_tasks = [build_slot(s, locked_enemy, locked_ally) for s in request.enemy]

    all_results = await asyncio.gather(*ally_tasks, *enemy_tasks)
    n = len(request.ally)

    logger.info(
        f"draft-overview: {len(locked_ally)} ally locked, {len(locked_enemy)} enemy locked "
        f"(patch={patch}, tier={tier})"
    )
    return DraftOverviewResponse(
        ally=list(all_results[:n]),
        enemy=list(all_results[n:]),
    )
