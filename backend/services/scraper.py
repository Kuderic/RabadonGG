"""Lolalytics data scraper using a1.lolalytics.com/mega/ API.

Endpoints used:
  ep=list        -> cid{id: {defaultLane, wr, pr, games, ...}}  (tier list / pool)
  ep=counter     -> counters[]: {cid, vsWr, d1, d2, n, defaultLane}
  ep=build-team  -> team.{lane}[]: [id, wr, d1, d2, pr, n]

d2 = normalized synergy delta (adjust all champions to 50% baseline WR).
Values are in percent (e.g. 2.78); divide by 100 for scorer's decimal format.
Champion IDs match Riot Data Dragon IDs.

Cache: SQLite at backend/data/rabadon_cache.db (1-day TTL, keyed by champion+patch+tier+lane).
Counter entries include a 'query_vslane' tag so role-specific matchups are looked up correctly
(e.g. Darius in jungle has different d2/n than Darius in top).
"""

import asyncio
import datetime
import json
import logging
import os
import re
import time
from collections import OrderedDict
from typing import Dict, List, Optional, Tuple

import httpx

from . import db
from .lolalytics_client import get_client

LOLA_API = "https://a1.lolalytics.com/mega/"
DD_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"
# The rolling 30-day window is addressed with the patch token "30" (lolalytics
# accepts it in place of a version). It's the frontend's default, so it is part
# of the "hot" data set alongside the current patch. The current patch itself is
# never hardcoded — see _get_patch().
PATCH_30D = "30"
TIER = "emerald_plus"
QUEUE = "ranked"
REGION = "all"

ROLE_TO_LANE = {
    "top": "top",
    "jungle": "jungle",
    "mid": "middle",
    "adc": "bottom",
    "support": "support",
}

logger = logging.getLogger(__name__)

# In-process caches (populated once per server lifetime)
_slug_to_id: Dict[str, int] = {}
_id_to_slug: Dict[int, str] = {}
# Maps any slug (display or DDragon key) → the DDragon key slug used by lolalytics API.
# Needed for champions whose display name differs from their DDragon key:
#   "Nunu & Willump" → key "Nunu" → api slug "nunu"
#   "Wukong" → key "MonkeyKing" → api slug "monkeyking"
_api_slug_map: Dict[str, str] = {}
_current_patch: Optional[str] = None
_patch_checked_at: float = 0.0
_PATCH_TTL_S = 3600  # re-check DDragon/lolalytics for a new patch at most hourly


class _LRUCache(OrderedDict):
    """A dict bounded to ``max_entries``; inserting past the bound evicts the
    least recently used key. Reads through ``[]``/``get()`` refresh recency.

    Why a bound: one parsed matchup entry is ~380 KB of Python objects (566
    counter dicts + 4×171 team rows), so an unbounded cache of every patch/tier
    combo reached 1.5 GB — more than the production host had (docs/ops.md,
    incident 2026-09-04). SQLite on local disk is a sub-millisecond fallback,
    so only the working set needs to live in memory."""

    def __init__(self, max_entries: int):
        super().__init__()
        self.max_entries = max_entries

    def __getitem__(self, key):
        value = super().__getitem__(key)
        self.move_to_end(key)
        return value

    def get(self, key, default=None):
        return self[key] if key in self else default

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        self.move_to_end(key)
        while len(self) > self.max_entries:
            self.popitem(last=False)


# Default bound ≈ 450 MB: comfortably holds the hot set (current patch + 30-day
# window for one tier ≈ 900 entries) with room for ad-hoc lookups. Raise it in
# step with RABADON_WARM_TIERS (~450 entries per patch/tier combo).
_MEM_CACHE_MAX = int(os.getenv("RABADON_MEM_CACHE_MAX", "1200"))
_matchup_mem_cache: Dict[str, dict] = _LRUCache(_MEM_CACHE_MAX)  # "{tier}:{patch}:{slug}:{lane}" → {counters, team}
_games_by_slug_cache: Dict[str, Dict[str, int]] = {}  # "{tier}:{patch}:{lane}" → {slug: games}

# Stale-while-revalidate bookkeeping.
_refreshing: set = set()   # cache keys with an in-flight background refresh (dedup guard)
_bg_tasks: set = set()     # strong refs to background tasks so they aren't GC'd mid-flight


def _spawn_bg(coro) -> None:
    """Fire-and-forget a coroutine, keeping a strong ref so it isn't GC'd early."""
    task = asyncio.ensure_future(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _slug(name: str) -> str:
    """Normalize champion name to lolalytics slug: lowercase alphanumeric only."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _today() -> str:
    return datetime.date.today().isoformat()


def _is_stale(data: dict) -> bool:
    """Return True if fetched_at is missing or more than 1 day old."""
    fetched = data.get("fetched_at")
    if not fetched:
        return True
    try:
        age = (datetime.date.today() - datetime.date.fromisoformat(fetched)).days
        return age >= 1
    except ValueError:
        return True


def _tier_key(tier: str, days: int) -> str:
    """DB/cache key that encodes both tier and days window."""
    return f"{tier}_{days}d" if days > 0 else tier



# ---------------------------------------------------------------------------
# Patch detection
# ---------------------------------------------------------------------------

async def _patch_has_lolalytics_data(patch: str) -> bool:
    """Return True if lolalytics has live data for this patch (≥10 ranked champions)."""
    from .lolalytics_client import get_client
    try:
        data = await get_client().fetch({
            "ep": "list", "v": "1", "lane": "middle",
            "tier": "emerald_plus", "patch": patch, "queue": "ranked", "region": "all",
        })
        ranked = sum(1 for info in data.get("cid", {}).values() if int(info.get("tier", 0)) > 0)
        return ranked >= 10
    except Exception:
        return False


async def _detect_patch() -> str:
    """One DDragon + lolalytics round trip: the newest patch lolalytics has data for.

    On patch day DDragon lists the new version hours before lolalytics has
    enough games; defaulting to it would serve empty pools, so walk back to the
    first of the three newest patches that lolalytics can actually serve.
    """
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(DD_VERSIONS_URL)
        versions = resp.json()
    candidates: List[str] = []  # "16.18.1" → "16.18"; newest first
    for v in versions:
        major_minor = ".".join(v.split(".")[:2])
        if major_minor not in candidates:
            candidates.append(major_minor)
        if len(candidates) == 3:
            break
    for cand in candidates:
        if await _patch_has_lolalytics_data(cand):
            return cand
    return candidates[0]


_patch_refreshing = False


async def _refresh_patch() -> None:
    """Background re-check; on failure keep the last known patch and retry next TTL."""
    global _current_patch, _patch_checked_at, _patch_refreshing
    try:
        patch = await _detect_patch()
        if patch != _current_patch:
            logger.info(f"Current patch: {patch} (was {_current_patch})")
        _current_patch = patch
    except Exception as e:
        logger.warning(f"Patch check failed, keeping {_current_patch}: {e}")
    finally:
        _patch_checked_at = time.monotonic()
        _patch_refreshing = False


async def _get_patch() -> str:
    """Return the current LoL patch as "major.minor" (e.g. "16.18").

    Resolved synchronously once per process, then re-checked hourly
    stale-while-revalidate: callers always get an answer immediately and never
    pay the network round trip on the request path.
    """
    global _current_patch, _patch_checked_at, _patch_refreshing
    if _current_patch is None:
        _current_patch = await _detect_patch()
        _patch_checked_at = time.monotonic()
        logger.info(f"Current patch: {_current_patch}")
    elif time.monotonic() - _patch_checked_at >= _PATCH_TTL_S and not _patch_refreshing:
        _patch_refreshing = True
        _spawn_bg(_refresh_patch())
    return _current_patch


# ---------------------------------------------------------------------------
# Champion ID ↔ name mapping
# ---------------------------------------------------------------------------

async def _ensure_champion_map(patch: str) -> None:
    """Load champion slug ↔ ID mapping from Data Dragon (once per process)."""
    global _slug_to_id, _id_to_slug, _api_slug_map
    if _slug_to_id:
        return
    if not re.fullmatch(r"\d+\.\d+", patch):
        # e.g. the "30" day-window token — not a DDragon version; use the real patch.
        patch = await _get_patch()
    dd_url = f"https://ddragon.leagueoflegends.com/cdn/{patch}.1/data/en_US/champion.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(dd_url)
        data = resp.json()
    for key, val in data["data"].items():
        cid = int(val["key"])
        key_s = _slug(key)           # DDragon key slug, e.g. "monkeyking", "nunu"
        display_s = _slug(val["name"])  # display slug, e.g. "wukong", "nunuwillump"
        _slug_to_id[key_s] = cid
        _id_to_slug[cid] = val["name"]
        _api_slug_map[key_s] = key_s
        if display_s != key_s:
            # Alias so display-name lookups (ally/enemy matching) work too
            _slug_to_id[display_s] = cid
            _api_slug_map[display_s] = key_s
    logger.info(f"Loaded {len(_slug_to_id)} champions from Data Dragon {patch}")


# ---------------------------------------------------------------------------
# Lolalytics API fetcher
# ---------------------------------------------------------------------------

async def _fetch(ep: str, lane: str, champ_slug: Optional[str], patch: str, tier: str = TIER,
                 days: int = 0, extra: Optional[Dict[str, str]] = None) -> dict:
    """Single request to the lolalytics mega API via the rate-limiting client."""
    params: dict = {
        "ep": ep,
        "v": "1",
        "patch": patch,
        "lane": lane,
        "tier": tier,
        "queue": QUEUE,
        "region": REGION,
    }
    if days > 0:
        params["dd"] = str(days)
    if champ_slug:
        params["c"] = champ_slug
    if extra:
        params.update(extra)
    return await get_client().fetch(params)


VS_LANES = ["top", "jungle", "middle", "bottom", "support"]


async def _fetch_counter_all_lanes(champ_slug: str, lane: str, patch: str, tier: str = TIER,
                                   days: int = 0) -> tuple[List[dict], float]:
    """
    Fetch counter matchups across all 5 opponent lanes in parallel.

    The ep=counter endpoint is hard-capped at 40 results per call, but adding
    vslane={lane} filters to one opponent role and returns that role's full set.
    Querying all 5 lanes in parallel gives ~161+ matchups.

    Each entry is tagged with 'query_vslane' so callers can select the role-specific
    entry for each enemy champion (e.g. Darius in jungle has different n and d2
    than Darius in top). A fallback index still keeps the highest-n entry per cid
    for enemies whose role is unknown.

    Returns (counter_list_with_vslane_tags, win_rate).
    """
    responses = await asyncio.gather(*[
        _fetch("counter", lane, champ_slug, patch, tier, days, extra={"vslane": vs})
        for vs in VS_LANES
    ])
    all_entries: List[dict] = []
    seen: set = set()  # (cid, vslane) dedup
    win_rate = 0.0
    for vs, resp in zip(VS_LANES, responses):
        if not win_rate:
            win_rate = float(resp.get("stats", {}).get("wr", 0) or 0)
        for entry in resp.get("counters", []):
            cid = entry["cid"]
            key = (cid, vs)
            if key not in seen:
                seen.add(key)
                all_entries.append({**entry, "query_vslane": vs})
    return all_entries, win_rate


# ---------------------------------------------------------------------------
# Live fetchers + stale-while-revalidate refresh
# ---------------------------------------------------------------------------

async def _fetch_matchup_live(cand_slug: str, api_slug: str, lane: str, patch: str,
                              tkey: str, tier: str, days: int) -> tuple:
    """Fetch fresh matchup data from lolalytics and write through to SQLite + mem cache."""
    (counter_list, win_rate), team_resp = await asyncio.gather(
        _fetch_counter_all_lanes(api_slug, lane, patch, tier, days),
        _fetch("build-team", lane, api_slug, patch, tier, days),
    )
    team_map = team_resp.get("team", {})
    await asyncio.to_thread(db.write_matchup, cand_slug, patch, tkey, lane, counter_list, team_map, win_rate, 0)
    _matchup_mem_cache[f"{tkey}:{patch}:{cand_slug}:{lane}"] = {
        "counters": counter_list, "team": team_map,
        "win_rate": win_rate, "fetched_at": _today(),
    }
    return counter_list, team_map, win_rate


async def _refresh_matchup(key: str, cand_slug: str, api_slug: str, lane: str,
                           patch: str, tkey: str, tier: str, days: int) -> None:
    """Background stale-while-revalidate refresh of a single matchup entry."""
    try:
        await _fetch_matchup_live(cand_slug, api_slug, lane, patch, tkey, tier, days)
        logger.info(f"SWR refresh: {cand_slug} ({lane}, {patch}, {tkey})")
    except Exception as e:
        logger.warning(f"SWR refresh failed for {cand_slug} ({lane}, {patch}, {tkey}): {e}")
    finally:
        _refreshing.discard(key)


def _schedule_matchup_refresh(cand_slug: str, api_slug: str, lane: str, patch: str,
                              tkey: str, tier: str, days: int) -> None:
    """Kick off a background matchup refresh, deduped so one key refreshes at a time."""
    key = f"{tkey}:{patch}:{cand_slug}:{lane}"
    if key in _refreshing:
        return
    _refreshing.add(key)  # reserve synchronously to prevent a dogpile under load
    _spawn_bg(_refresh_matchup(key, cand_slug, api_slug, lane, patch, tkey, tier, days))


async def _fetch_pool_live(role: str, lane: str, patch: str, tkey: str,
                           tier: str, days: int) -> List[str]:
    """Fetch the fresh champion pool (tier list) and write through to SQLite + mem cache."""
    data = await _fetch("list", lane, None, patch, tier, days)
    entries = [
        (int(cid), info)
        for cid, info in data.get("cid", {}).items()
        # Only champions lolalytics actually ranks in this lane (tier > 0).
        if int(info.get("tier", 0)) > 0
    ]
    names = [_id_to_slug[cid] for cid, _ in entries if cid in _id_to_slug]
    games_by_slug = {
        _slug(_id_to_slug[cid]): int(info.get("games", 0))
        for cid, info in entries if cid in _id_to_slug
    }
    await asyncio.to_thread(db.write_pool, lane, patch, tkey, {"champions": names, "games_by_slug": games_by_slug})
    _games_by_slug_cache[f"{tkey}:{patch}:{lane}"] = games_by_slug
    logger.info(f"Pool for {role} ({tkey}): {len(names)} champions")
    return names


async def _refresh_pool(key: str, role: str, lane: str, patch: str,
                        tkey: str, tier: str, days: int) -> None:
    """Background stale-while-revalidate refresh of a champion pool."""
    try:
        await _fetch_pool_live(role, lane, patch, tkey, tier, days)
        logger.info(f"SWR pool refresh: {role} ({tkey})")
    except Exception as e:
        logger.warning(f"SWR pool refresh failed for {role} ({tkey}): {e}")
    finally:
        _refreshing.discard(key)


def _schedule_pool_refresh(role: str, lane: str, patch: str, tkey: str,
                           tier: str, days: int) -> None:
    """Kick off a background pool refresh, deduped so one key refreshes at a time."""
    key = f"pool:{tkey}:{patch}:{lane}"
    if key in _refreshing:
        return
    _refreshing.add(key)
    _spawn_bg(_refresh_pool(key, role, lane, patch, tkey, tier, days))


# ---------------------------------------------------------------------------
# Champion pool (tier list)
# ---------------------------------------------------------------------------

def _warm_tiers() -> List[str]:
    """Tier keys the warmer keeps hot. Defaults to the endpoint default (TIER);
    override with RABADON_WARM_TIERS, e.g. "emerald_plus,platinum_plus"."""
    raw = os.getenv("RABADON_WARM_TIERS", "").strip()
    if raw:
        return [t.strip() for t in raw.split(",") if t.strip()]
    return [TIER]


async def _hot_combos() -> Tuple[List[str], List[str]]:
    """The (patches, tiers) worth holding in memory: the current patch and the
    30-day window (the frontend default), for the warmed tiers. Everything else
    is served from SQLite on demand and cached in the LRU while it's in use."""
    return [await _get_patch(), PATCH_30D], _warm_tiers()


async def warm_cache() -> None:
    """
    Pre-load the hot (patch, tier) combos from SQLite into process memory at
    startup so the first user requests don't pay the parse cost per champion.
    Deliberately *not* every cached combo: see _LRUCache for why.
    """
    patch = await _get_patch()
    await _ensure_champion_map(patch)  # must run before parallel requests touch _slug_to_id
    loaded = 0

    patches, tiers = await _hot_combos()
    rows = db.load_all_valid_matchups(patches=patches, tiers=tiers)
    for row in rows:
        if len(row.get("counters", "")) > 50:  # Minimal validation
            counters = json.loads(row["counters"])
            # Skip old-format entries that lack query_vslane tags
            if not counters or not counters[0].get("query_vslane"):
                continue
            mem_key = f"{row['tier']}:{row['patch']}:{row['champion']}:{row['lane']}"
            _matchup_mem_cache[mem_key] = {
                "counters": counters,
                "team": json.loads(row["team"]),
                "win_rate": row["win_rate"],
                "fetched_at": row["fetched_at"],
            }
            loaded += 1

    # Warm the games_by_slug cache from pool_cache in SQLite
    for row in db.load_all_valid_pools():
        gbs = row["pool"].get("games_by_slug")
        if gbs:
            games_key = f"{row['tier']}:{row['patch']}:{row['lane']}"
            _games_by_slug_cache[games_key] = gbs

    logger.info(
        f"Warm cache: loaded {loaded} champions into memory "
        f"(patches={patches}, tiers={tiers}, bound={_MEM_CACHE_MAX})"
    )


# ---------------------------------------------------------------------------
# Proactive cache warmer (keeps standard combos hot so no client hits a cold scrape)
# ---------------------------------------------------------------------------


async def warm_all(patch: Optional[str] = None) -> None:
    """
    Refresh the cache for every role across the standard (patch, tier) combos so
    client requests never trigger a cold ~55s live scrape.

    Runs off the request path. For each candidate it fetches only when the entry
    is missing or stale, paced one at a time (the rate-limiting client throttles
    further), keeping memory/CPU footprint low on small hosts.
    """
    patches, tiers = await _hot_combos()
    if patch:
        patches = [patch]
    await _ensure_champion_map(patches[0])
    refreshed = 0
    for patch, tier in [(p, t) for p in patches for t in tiers]:
        tkey = _tier_key(tier, 0)
        for role, lane in ROLE_TO_LANE.items():
            try:
                pool = db.read_pool(lane, patch, tkey, allow_stale=True)
                if not pool or pool.get("is_stale"):
                    names = await _fetch_pool_live(role, lane, patch, tkey, tier, 0)
                else:
                    names = pool["champions"]
                    _games_by_slug_cache.setdefault(
                        f"{tkey}:{patch}:{lane}", pool.get("games_by_slug", {})
                    )

                for candidate in names:
                    cand_slug = _slug(candidate)
                    mkey = f"{tkey}:{patch}:{cand_slug}:{lane}"
                    mem = _matchup_mem_cache.get(mkey)
                    if mem and mem.get("counters") and mem["counters"][0].get("query_vslane") \
                            and not _is_stale(mem):
                        continue  # already hot and fresh in memory
                    db_data = db.read_matchup(cand_slug, patch, tkey, lane, allow_stale=True)
                    fresh = (
                        db_data and "win_rate" in db_data
                        and len(db_data.get("counters", [])) > 50
                        and db_data["counters"] and db_data["counters"][0].get("query_vslane")
                        and not db_data.get("is_stale")
                    )
                    if fresh:
                        # Fresh on disk — load into mem so it stays hot; no network.
                        _matchup_mem_cache[mkey] = {
                            "counters": db_data["counters"], "team": db_data["team"],
                            "win_rate": db_data["win_rate"], "fetched_at": db_data.get("fetched_at"),
                        }
                        continue
                    # Missing or stale → refresh synchronously (paced by this loop).
                    api_slug = _api_slug_map.get(cand_slug, cand_slug)
                    await _fetch_matchup_live(cand_slug, api_slug, lane, patch, tkey, tier, 0)
                    refreshed += 1
            except Exception as e:
                logger.warning(f"warm_all: {role}/{tkey} failed: {e}")
    logger.info(
        f"warm_all complete: patches={patches}, tiers={tiers}, refreshed={refreshed}"
    )


async def warmer_loop(interval_seconds: int = 21600) -> None:
    """Run warm_all now, then every `interval_seconds` (default 6h, well inside the 1-day TTL)."""
    while True:
        try:
            await warm_all()
        except Exception as e:
            logger.warning(f"warmer_loop iteration failed: {e}")
        await asyncio.sleep(interval_seconds)


async def cleanup_loop(interval_seconds: int = 86400, retention_days: int = 2,
                       initial_delay: int = 180) -> None:
    """Periodically prune stale/old-patch cache rows and compact the DB file.

    The blocking DELETE + VACUUM run in a thread executor so they never stall
    request handling. The first pass is delayed so startup cache-warming finishes
    before VACUUM takes its exclusive lock.
    """
    await asyncio.sleep(initial_delay)
    loop = asyncio.get_running_loop()
    while True:
        try:
            await loop.run_in_executor(None, db.prune_stale, retention_days)
            await loop.run_in_executor(None, db.vacuum)
        except Exception as e:
            logger.warning(f"cleanup_loop iteration failed: {e}")
        await asyncio.sleep(interval_seconds)


async def get_champion_pool(role: str, patch: Optional[str] = None, tier: str = TIER,
                           days: int = 0) -> List[str]:
    """
    Return champion names for this role sourced from the lolalytics tier list.
    Also caches total_games per champion slug for use in recommendations.
    """
    patch = patch or await _get_patch()
    lane = ROLE_TO_LANE.get(role.lower(), "bottom")
    await _ensure_champion_map(patch)

    tkey = _tier_key(tier, days)
    cached = db.read_pool(lane, patch, tkey, allow_stale=True)
    if cached:
        # Keep the games_by_slug mem cache warm for total-games lookups, even if stale.
        gbs = cached.get("games_by_slug")
        if gbs:
            _games_by_slug_cache.setdefault(f"{tkey}:{patch}:{lane}", gbs)
        # Stale-while-revalidate: serve the cached pool now, refresh in the background.
        if cached.get("is_stale"):
            _schedule_pool_refresh(role, lane, patch, tkey, tier, days)
        return cached["champions"]

    # Cold miss: nothing cached at all → fetch synchronously (unavoidable).
    try:
        return await _fetch_pool_live(role, lane, patch, tkey, tier, days)
    except Exception as e:
        logger.warning(f"Failed to fetch champion pool for {role}: {e}")
        return []


async def get_champion_total_games(champion: str, role: str, patch: Optional[str] = None,
                                   tier: str = TIER, days: int = 0) -> int:
    """Return the total games played for this champion/role from the cached pool."""
    patch = patch or await _get_patch()
    lane = ROLE_TO_LANE.get(role.lower(), "bottom")
    tkey = _tier_key(tier, days)
    games_key = f"{tkey}:{patch}:{lane}"
    if games_key in _games_by_slug_cache:
        return _games_by_slug_cache[games_key].get(_slug(champion), 0)
    cached = db.read_pool(lane, patch, tkey)
    if cached:
        games = cached.get("games_by_slug", {})
        _games_by_slug_cache[games_key] = games
        return games.get(_slug(champion), 0)
    return 0


# ---------------------------------------------------------------------------
# Matchup data for scoring
# ---------------------------------------------------------------------------

async def get_matchup_data(
    candidate: str,
    role: str,
    allies: List[Dict[str, str]],
    enemies: List[Dict[str, str]],
    patch: Optional[str] = None,
    tier: str = TIER,
    days: int = 0,
) -> Tuple[Dict[Tuple[str, str], float], Dict[Tuple[str, str], int], float, int, List[str]]:
    """
    Fetch conditional winrate deltas for a candidate champion from lolalytics.

    Cache hierarchy:
      1. In-process memory (module-level dicts after first load per server run)
      2. SQLite cache: backend/data/rabadon_cache.db (1-day TTL)
      3. Live fetch from a1.lolalytics.com → writes to SQLite on success

    Args:
        candidate: Champion being evaluated (e.g. "Caitlyn")
        role: Player's role (adc, support, mid, jungle, top)
        allies: Ally dicts with 'champion' and 'role' keys
        enemies: Enemy dicts with 'champion' and 'role' keys
        patch: Patch version (e.g. "16.18") or "30" for the 30-day window;
               None = the current patch
        tier: Rank tier (e.g. "emerald_plus")

    Returns:
        matchup_data: {(champ.lower(), "ally"|"enemy"): d2/100.0}
        warnings: low sample size flags
    """
    patch = patch or await _get_patch()
    await _ensure_champion_map(patch)

    lane = ROLE_TO_LANE.get(role.lower(), "bottom")
    cand_slug = _slug(candidate)
    # Use the DDragon key slug for lolalytics API calls; display slug for cache keys.
    # e.g. "Nunu & Willump" → cand_slug="nunuwillump", api_slug="nunu"
    api_slug = _api_slug_map.get(cand_slug, cand_slug)
    tkey = _tier_key(tier, days)

    mem_key = f"{tkey}:{patch}:{cand_slug}:{lane}"
    mem_data = _matchup_mem_cache.get(mem_key)
    # Invalidate mem-cache entries from before vslane-tagging was added
    if mem_data and mem_data.get("counters") and not mem_data["counters"][0].get("query_vslane"):
        del _matchup_mem_cache[mem_key]
        mem_data = None
    if mem_data:
        counter_list = mem_data["counters"]
        team_map = mem_data["team"]
        win_rate = mem_data.get("win_rate", 0.0)
        # Stale-while-revalidate: serve the cached copy now, refresh for next time.
        if _is_stale(mem_data):
            _schedule_matchup_refresh(cand_slug, api_slug, lane, patch, tkey, tier, days)
    else:
        db_data = db.read_matchup(cand_slug, patch, tkey, lane, allow_stale=True)
        has_vslane = db_data and db_data.get("counters") and db_data["counters"][0].get("query_vslane")
        if db_data and "win_rate" in db_data and len(db_data.get("counters", [])) > 50 and has_vslane:
            counter_list = db_data["counters"]
            team_map = db_data["team"]
            win_rate = db_data["win_rate"]
            _matchup_mem_cache[mem_key] = {
                "counters": counter_list, "team": team_map,
                "win_rate": win_rate, "fetched_at": db_data.get("fetched_at"),
            }
            # Stale-while-revalidate: serve the stale DB copy, refresh in the background.
            if db_data.get("is_stale"):
                logger.debug(f"Stale cache hit + bg refresh: {candidate} ({lane}, {patch}, {tkey})")
                _schedule_matchup_refresh(cand_slug, api_slug, lane, patch, tkey, tier, days)
            else:
                logger.debug(f"Database cache hit: {candidate} ({lane}, {patch}, {tkey})")
        else:
            # Cold miss: no cached copy at all → must fetch synchronously.
            try:
                counter_list, team_map, win_rate = await _fetch_matchup_live(
                    cand_slug, api_slug, lane, patch, tkey, tier, days
                )
                logger.info(f"Fetched and cached: {candidate} ({lane}, {patch}, {tkey})")
            except Exception as e:
                logger.warning(f"lolalytics fetch failed for {candidate}: {e}")
                return {}, {}, 0.0, 0, [f"{candidate}: data unavailable ({e})"]

    # Build O(1) lookup structures.
    # Primary: (cid, query_vslane) → entry for role-specific matchup lookup.
    # Fallback: cid → highest-n entry for enemies whose role is unknown.
    counter_by_cid_lane: Dict[Tuple[int, str], dict] = {}
    counter_by_cid: Dict[int, dict] = {}
    for entry in counter_list:
        cid = entry["cid"]
        vslane = entry.get("query_vslane")
        if vslane:
            counter_by_cid_lane[(cid, vslane)] = entry
        if cid not in counter_by_cid or entry["n"] > counter_by_cid[cid]["n"]:
            counter_by_cid[cid] = entry

    team_d2: Dict[str, Dict[int, Tuple[float, int]]] = {}
    for lane_name, entries in team_map.items():
        team_d2[lane_name] = {}
        for row in entries:
            if len(row) >= 6:
                team_d2[lane_name][row[0]] = (row[3], row[5])  # (d2, n_games)

    matchup_data: Dict[Tuple[str, str], float] = {}
    matchup_n: Dict[Tuple[str, str], int] = {}
    warnings: List[str] = []

    for enemy in enemies:
        key_name = enemy["champion"].lower()
        enemy_cid = _slug_to_id.get(_slug(enemy["champion"]))
        if enemy_cid is None:
            continue
        enemy_vslane = ROLE_TO_LANE.get(enemy.get("role", "").lower(), "")
        # When the enemy role is known, only use the role-specific entry to avoid
        # cross-role contamination (e.g. TF support picking up TF mid game counts
        # for sparse matchups where lolalytics omits the low-sample vslane entry).
        # Fall back to the highest-n entry only when role is genuinely unknown.
        if enemy_vslane:
            entry = counter_by_cid_lane.get((enemy_cid, enemy_vslane))
        else:
            entry = counter_by_cid.get(enemy_cid)
        if entry is None:
            continue
        matchup_data[(key_name, "enemy")] = entry["d2"] / 100.0
        matchup_n[(key_name, "enemy")] = entry["n"]
        if entry["n"] < 200:
            warnings.append(
                f"{candidate} vs {enemy['champion']}: only {entry['n']} games (low sample)"
            )

    for ally in allies:
        key_name = ally["champion"].lower()
        ally_cid = _slug_to_id.get(_slug(ally["champion"]))
        if ally_cid is None:
            continue
        ally_lane = ROLE_TO_LANE.get(ally.get("role", "").lower(), "")
        d2_val: Optional[float] = None
        n_games = 0

        if ally_lane and ally_lane in team_d2:
            row = team_d2[ally_lane].get(ally_cid)
            if row:
                d2_val, n_games = row

        if d2_val is None:
            for lane_entries in team_d2.values():
                row = lane_entries.get(ally_cid)
                if row:
                    d2_val, n_games = row
                    break

        if d2_val is not None:
            matchup_data[(key_name, "ally")] = d2_val / 100.0
            matchup_n[(key_name, "ally")] = n_games
            if n_games < 200:
                warnings.append(
                    f"{candidate} + {ally['champion']}: only {n_games} games (low sample)"
                )

    # Look up total games for this champion from the pool cache
    total_games = await get_champion_total_games(candidate, role, patch, tier, days)

    logger.info(
        f"lolalytics data for {candidate} ({role}): "
        f"{len(matchup_data)}/{len(enemies) + len(allies)} matchups found"
    )
    return matchup_data, matchup_n, win_rate, total_games, warnings
