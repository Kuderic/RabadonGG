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
import re
from typing import Dict, List, Optional, Tuple

import httpx

from . import db

LOLA_API = "https://a1.lolalytics.com/mega/"
DD_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"
PATCH = "16.11"
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
_matchup_mem_cache: Dict[str, dict] = {}  # "{tier}:{patch}:{slug}:{lane}" → {counters, team}
_games_by_slug_cache: Dict[str, Dict[str, int]] = {}  # "{tier}:{patch}:{lane}" → {slug: games}


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

async def _get_patch() -> str:
    """Return the current LoL patch (e.g. '16.11'), cached in process memory."""
    global _current_patch
    if _current_patch:
        return _current_patch
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(DD_VERSIONS_URL)
        versions = resp.json()
    # versions[0] = "16.11.1" → "16.11"
    parts = versions[0].split(".")
    _current_patch = f"{parts[0]}.{parts[1]}"
    return _current_patch


# ---------------------------------------------------------------------------
# Champion ID ↔ name mapping
# ---------------------------------------------------------------------------

async def _ensure_champion_map(patch: str) -> None:
    """Load champion slug ↔ ID mapping from Data Dragon (once per process)."""
    global _slug_to_id, _id_to_slug, _api_slug_map
    if _slug_to_id:
        return
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
    """Single request to the lolalytics mega API."""
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
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(LOLA_API, params=params)
    return resp.json()


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
# Champion pool (tier list)
# ---------------------------------------------------------------------------

async def warm_cache() -> None:
    """
    Pre-load all on-disk cached champion data into process memory at startup.
    This makes the first user request fast instead of paying file I/O per champion.
    """
    patch = await _get_patch()
    await _ensure_champion_map(patch)  # must run before parallel requests touch _slug_to_id
    loaded = 0

    # Load all valid (non-stale) matchups from SQLite into memory
    rows = db.load_all_valid_matchups()
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
            }
            loaded += 1

    # Warm the games_by_slug cache from pool_cache in SQLite
    for row in db.load_all_valid_pools():
        gbs = row["pool"].get("games_by_slug")
        if gbs:
            games_key = f"{row['tier']}:{row['patch']}:{row['lane']}"
            _games_by_slug_cache[games_key] = gbs

    logger.info(f"Warm cache: loaded {loaded} champions into memory")


async def get_champion_pool(role: str, patch: str = PATCH, tier: str = TIER,
                           days: int = 0) -> List[str]:
    """
    Return champion names for this role sourced from the lolalytics tier list.
    Also caches total_games per champion slug for use in recommendations.
    """
    lane = ROLE_TO_LANE.get(role.lower(), "bottom")
    await _ensure_champion_map(patch)

    tkey = _tier_key(tier, days)
    cached = db.read_pool(lane, patch, tkey)
    if cached:
        return cached["champions"]

    try:
        data = await _fetch("list", lane, None, patch, tier, days)
        entries = [
            (int(cid), info)
            for cid, info in data.get("cid", {}).items()
        ]
        names = [_id_to_slug[cid] for cid, _ in entries if cid in _id_to_slug]
        games_by_slug = {
            _slug(_id_to_slug[cid]): int(info.get("games", 0))
            for cid, info in entries if cid in _id_to_slug
        }
        pool_data = {
            "champions": names,
            "games_by_slug": games_by_slug,
        }
        db.write_pool(lane, patch, tkey, pool_data)
        games_key = f"{tkey}:{patch}:{lane}"
        _games_by_slug_cache[games_key] = games_by_slug
        logger.info(f"Pool for {role} ({tkey}): {len(names)} champions")
        return names
    except Exception as e:
        logger.warning(f"Failed to fetch champion pool for {role}: {e}")
        return []


async def get_champion_total_games(champion: str, role: str, patch: str = PATCH, tier: str = TIER,
                                   days: int = 0) -> int:
    """Return the total games played for this champion/role from the cached pool."""
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
    patch: str = PATCH,
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
        patch: Patch version (e.g. "16.11")
        tier: Rank tier (e.g. "emerald_plus")

    Returns:
        matchup_data: {(champ.lower(), "ally"|"enemy"): d2/100.0}
        warnings: low sample size flags
    """
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
    else:
        db_data = db.read_matchup(cand_slug, patch, tkey, lane)
        has_vslane = db_data and db_data.get("counters") and db_data["counters"][0].get("query_vslane")
        if db_data and "win_rate" in db_data and len(db_data.get("counters", [])) > 50 and has_vslane:
            counter_list = db_data["counters"]
            team_map = db_data["team"]
            win_rate = db_data["win_rate"]
            logger.debug(f"Database cache hit: {candidate} ({lane}, {patch}, {tkey})")
        else:
            try:
                (counter_list, win_rate), team_resp = await asyncio.gather(
                    _fetch_counter_all_lanes(api_slug, lane, patch, tier, days),
                    _fetch("build-team", lane, api_slug, patch, tier, days),
                )
                team_map = team_resp.get("team", {})
                db.write_matchup(cand_slug, patch, tkey, lane, counter_list, team_map, win_rate, 0)
                logger.info(f"Fetched and cached: {candidate} ({lane}, {patch}, {tkey})")
            except Exception as e:
                logger.warning(f"lolalytics fetch failed for {candidate}: {e}")
                return {}, {}, 0.0, 0, [f"{candidate}: data unavailable ({e})"]
        _matchup_mem_cache[mem_key] = {"counters": counter_list, "team": team_map, "win_rate": win_rate}

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
