"""
Nightly prefetch script — populates SQLite cache for all tier × role combinations.

Usage (from backend/):
    python prefetch_all.py [--tiers emerald_plus,platinum_plus] [--patch 16.11]

EC2 cron (runs at 1:00 AM server time):
    0 1 * * * cd /home/ec2-user/RabadonGG/backend && /home/ec2-user/.venv/bin/python prefetch_all.py >> logs/cron.log 2>&1

Runtime and data usage are appended to logs/prefetch.log after each run.
"""

import argparse
import asyncio
import datetime
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from services.scraper import get_champion_pool, get_matchup_data

# ── Defaults ─────────────────────────────────────────────────────────────────

DEFAULT_TIERS = ["emerald_plus", "platinum_plus", "gold_plus", "diamond_plus"]
DEFAULT_PATCH = None          # None = auto-detect current patch from DDragon
ROLES         = ["top", "jungle", "mid", "adc", "support"]
DELAY_SECONDS = 12            # pause between each champion to avoid rate limiting
CONCURRENCY   = 5             # max simultaneous requests within a champion fetch

LOG_DIR  = Path(__file__).parent / "logs"
LOG_FILE = LOG_DIR / "prefetch.log"

# ── Logging ───────────────────────────────────────────────────────────────────

LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


# ── Byte counter ──────────────────────────────────────────────────────────────

_bytes_received = 0

try:
    import httpx as _httpx

    _orig_send = _httpx.AsyncClient.send

    async def _metered_send(self, request, **kwargs):
        global _bytes_received
        response = await _orig_send(self, request, **kwargs)
        _bytes_received += len(response.content)
        return response

    _httpx.AsyncClient.send = _metered_send
except Exception:
    pass  # byte counting is best-effort


# ── Main ──────────────────────────────────────────────────────────────────────

async def prefetch_patch(patch: str, tiers: list[str]) -> tuple[int, int, dict]:
    """Prefetch all tier × role combinations for a single patch string."""
    total_ok = 0
    total_err = 0
    tier_stats: dict[str, dict] = {}

    for tier in tiers:
        tier_start = time.monotonic()
        tier_ok = tier_err = 0
        log.info(f"{'─'*60}")
        log.info(f"TIER: {tier.upper()}  (patch={patch})")

        for role in ROLES:
            log.info(f"  {role.upper()} ...")
            pool = await get_champion_pool(role, patch=patch, tier=tier)
            log.info(f"    Pool: {len(pool)} champions")

            for i, champ in enumerate(pool, 1):
                try:
                    await get_matchup_data(champ, role, [], [], patch=patch, tier=tier)
                    tier_ok += 1
                    log.info(f"    [{i}/{len(pool)}] {champ} ✓")
                except Exception as e:
                    tier_err += 1
                    log.warning(f"    [{i}/{len(pool)}] {champ} SKIP: {e}")
                await asyncio.sleep(DELAY_SECONDS)

        tier_elapsed = time.monotonic() - tier_start
        tier_stats[tier] = {"ok": tier_ok, "err": tier_err, "elapsed_s": tier_elapsed}
        log.info(f"  {tier}: {tier_ok} ok, {tier_err} errors, {tier_elapsed/60:.1f} min")
        total_ok  += tier_ok
        total_err += tier_err

    return total_ok, total_err, tier_stats


async def prefetch(tiers: list[str], patch: str | None) -> None:
    global _bytes_received
    _bytes_received = 0
    wall_start = time.monotonic()

    # Resolve current patch if not specified
    if patch is None:
        from services.scraper import _get_patch
        patch = await _get_patch()

    # Always prefetch both the current patch and the 30-day rolling window.
    # "30" is the patch token the frontend/API uses for the 30-day mode
    # (sends patch=30 to lolalytics, cached under a separate key from patch-specific data).
    patches_to_run = [patch, "30"]

    log.info(f"Starting prefetch — patches={patches_to_run}, tiers={tiers}, roles={ROLES}")

    total_ok = 0
    total_err = 0
    all_tier_stats: dict[str, dict] = {}

    for p in patches_to_run:
        log.info(f"{'='*60}")
        log.info(f"PATCH: {p}")
        ok, err, tier_stats = await prefetch_patch(p, tiers)
        total_ok  += ok
        total_err += err
        for tier, s in tier_stats.items():
            all_tier_stats[f"{p}/{tier}"] = s

    wall_elapsed = time.monotonic() - wall_start
    mb_received  = _bytes_received / 1_048_576

    # ── Summary log entry ────────────────────────────────────────────────────
    summary_lines = [
        "",
        f"{'='*70}",
        f"RUN: {datetime.datetime.now().isoformat(timespec='seconds')}",
        f"PATCHES: {', '.join(patches_to_run)}   TIERS: {', '.join(tiers)}",
        f"TOTAL: {total_ok} champions fetched, {total_err} errors",
        f"WALL TIME: {wall_elapsed/60:.1f} min ({wall_elapsed:.0f} s)",
        f"DATA RECEIVED: {mb_received:.1f} MB ({_bytes_received:,} bytes)",
    ]
    for key, s in all_tier_stats.items():
        summary_lines.append(
            f"  {key:<30} {s['ok']:>4} ok  {s['err']:>3} err  {s['elapsed_s']/60:.1f} min"
        )
    summary_lines.append(f"{'='*70}")

    for line in summary_lines:
        log.info(line)

    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write("\n".join(summary_lines) + "\n")

    log.info(f"Summary appended to {LOG_FILE}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prefetch lolalytics data into SQLite cache")
    parser.add_argument(
        "--tiers",
        default=",".join(DEFAULT_TIERS),
        help=f"Comma-separated tier list (default: {','.join(DEFAULT_TIERS)})",
    )
    parser.add_argument(
        "--patch",
        default=None,
        help="Patch to fetch (default: auto-detect from DDragon)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    tiers = [t.strip() for t in args.tiers.split(",") if t.strip()]
    asyncio.run(prefetch(tiers=tiers, patch=args.patch))
