"""
Prefetch 0-day lolalytics data for all roles and base tier brackets.
Fills the gap left by prefetch_cache.py which only covered days=30.

Run from the backend/ directory:  python prefetch_0d.py
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from services.scraper import get_champion_pool, get_matchup_data
from services import db

ROLES = ["top", "jungle", "mid", "support", "adc"]
TIERS = ["emerald_plus", "platinum_plus"]
PATCH = "16.11"
DAYS = 0
DELAY_SECONDS = 10

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

LANE_MAP = {
    "top": "top",
    "jungle": "jungle",
    "mid": "middle",
    "adc": "bottom",
    "support": "support",
}


def _already_cached(champ_slug: str, lane: str, tier: str) -> bool:
    """Quick check if this champion's matchup is already in the DB (non-stale)."""
    import re
    slug = re.sub(r"[^a-z0-9]", "", champ_slug.lower())
    result = db.read_matchup(slug, PATCH, tier, lane)
    return result is not None and len(result.get("counters", [])) > 50


async def main() -> None:
    total_fetched = 0
    total_skipped = 0
    total_errors = 0

    for tier in TIERS:
        for role in ROLES:
            lane = LANE_MAP[role]
            log.info(f"=== {tier.upper()} / {role.upper()} ===")
            pool = await get_champion_pool(role, patch=PATCH, tier=tier, days=DAYS)
            log.info(f"  Pool: {len(pool)} champions")

            for i, champ in enumerate(pool, 1):
                if _already_cached(champ, lane, tier):
                    log.info(f"  [{i}/{len(pool)}] {champ} — cached, skip")
                    total_skipped += 1
                    continue

                log.info(f"  [{i}/{len(pool)}] {champ} ...")
                try:
                    await get_matchup_data(champ, role, [], [], patch=PATCH, tier=tier, days=DAYS)
                    total_fetched += 1
                except Exception as e:
                    log.warning(f"  SKIP {champ}: {e}")
                    total_errors += 1
                await asyncio.sleep(DELAY_SECONDS)

    log.info(f"Done. {total_fetched} fetched, {total_skipped} skipped, {total_errors} errors.")


if __name__ == "__main__":
    asyncio.run(main())
