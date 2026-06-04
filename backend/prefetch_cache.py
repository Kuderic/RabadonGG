"""
Prefetch lolalytics data for all roles and both tier brackets.

Runs slowly (DELAY_SECONDS between each champion) to avoid rate limiting.
Run from the backend/ directory:  python prefetch_cache.py
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from services.scraper import get_champion_pool, get_matchup_data

ROLES = ["top", "jungle", "mid", "support", "adc"]
TIERS = ["emerald_plus", "platinum_plus"]
PATCH = "16.11"
DAYS = 30
DELAY_SECONDS = 15

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


async def main() -> None:
    total_fetched = 0
    total_errors = 0

    for tier in TIERS:
        for role in ROLES:
            log.info(f"=== {tier.upper()} / {role.upper()} ===")
            pool = await get_champion_pool(role, patch=PATCH, tier=tier, days=DAYS)
            log.info(f"  Pool: {len(pool)} champions")

            for i, champ in enumerate(pool, 1):
                log.info(f"  [{i}/{len(pool)}] {champ} ...")
                try:
                    await get_matchup_data(champ, role, [], [], patch=PATCH, tier=tier, days=DAYS)
                    total_fetched += 1
                except Exception as e:
                    log.warning(f"  SKIP {champ}: {e}")
                    total_errors += 1
                await asyncio.sleep(DELAY_SECONDS)

    log.info(f"Done. {total_fetched} champions fetched, {total_errors} skipped.")


if __name__ == "__main__":
    asyncio.run(main())
