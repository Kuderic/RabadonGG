"""Lolalytics data scraper using a1.lolalytics.com/mega/ API.

Endpoints used:
  ep=list        -> cid{id: {defaultLane, wr, pr, games, ...}}  (tier list / pool)
  ep=counter     -> counters[]: {cid, vsWr, d1, d2, n, defaultLane}
  ep=build-team  -> team.{lane}[]: [id, wr, d1, d2, pr, n]

d2 = normalized synergy delta (adjust all champions to 50% baseline WR).
Values are in percent (e.g. 2.78); divide by 100 for scorer's decimal format.
Champion IDs match Riot Data Dragon IDs.

File cache layout: data/lolalytics/{patch}/{lane}/
  _pool.json          — champion pool for this lane (1-day TTL)
  {champion}.json     — matchup data for this champion (1-day TTL)

Files are refreshed when fetched_at date is more than 1 day old.
"""

import asyncio
import datetime
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx

LOLA_API = "https://a1.lolalytics.com/mega/"
DD_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"
PATCH = "16.11"
TIER = "emerald_plus"
QUEUE = "ranked"
REGION = "all"

CACHE_DIR = Path(__file__).parent.parent / "data" / "lolalytics"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

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
_current_patch: Optional[str] = None
_matchup_mem_cache: Dict[str, dict] = {}  # "{slug}:{lane}" → {counters, team}
_games_by_slug_cache: Dict[str, Dict[str, int]] = {}  # "{lane}" → {slug: games}


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


def _cache_path(patch: str, lane: str, filename: str) -> Path:
    p = CACHE_DIR / patch / lane / filename
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _read_cache(patch: str, lane: str, filename: str) -> Optional[dict]:
    path = _cache_path(patch, lane, filename)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if _is_stale(data):
            path.unlink(missing_ok=True)
            return None
        return data
    except Exception:
        path.unlink(missing_ok=True)
        return None


def _write_cache(patch: str, lane: str, filename: str, payload: dict) -> None:
    payload["fetched_at"] = _today()
    _cache_path(patch, lane, filename).write_text(
        json.dumps(payload), encoding="utf-8"
    )


# ---------------------------------------------------------------------------
# Patch detection
# ---------------------------------------------------------------------------

async def _get_patch() -> str:
    """Return the current LoL patch (e.g. '16.11'), cached in process memory."""
    global _current_patch
    if _current_patch:
        return _current_patch

    # Check disk cache (patch stored at root level)
    patch_file = CACHE_DIR / "_patch.json"
    if patch_file.exists():
        try:
            meta = json.loads(patch_file.read_text(encoding="utf-8"))
            if not _is_stale(meta):
                _current_patch = meta["patch"]
                return _current_patch
        except Exception:
            pass

    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(DD_VERSIONS_URL)
        versions = resp.json()

    # versions[0] = "16.11.1" → "16.11"
    parts = versions[0].split(".")
    patch = f"{parts[0]}.{parts[1]}"
    _current_patch = patch
    patch_file.write_text(
        json.dumps({"patch": patch, "fetched_at": _today()}), encoding="utf-8"
    )
    return patch


# ---------------------------------------------------------------------------
# Champion ID ↔ name mapping
# ---------------------------------------------------------------------------

async def _ensure_champion_map(patch: str) -> None:
    """Load champion slug ↔ ID mapping from Data Dragon (once per process, disk-cached)."""
    global _slug_to_id, _id_to_slug
    if _slug_to_id:
        return

    # Try disk cache first (stored at root of CACHE_DIR, 1-day TTL)
    map_file = CACHE_DIR / "_champ_map.json"
    if map_file.exists():
        try:
            meta = json.loads(map_file.read_text(encoding="utf-8"))
            if not _is_stale(meta):
                for s, cid in meta["slug_to_id"].items():
                    _slug_to_id[s] = int(cid)
                for cid, key in meta["id_to_slug"].items():
                    _id_to_slug[int(cid)] = key
                logger.debug(f"Champion map loaded from disk ({len(_slug_to_id)} champs)")
                return
        except Exception:
            map_file.unlink(missing_ok=True)

    dd_url = f"https://ddragon.leagueoflegends.com/cdn/{patch}.1/data/en_US/champion.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(dd_url)
        data = resp.json()

    for key, val in data["data"].items():
        cid = int(val["key"])
        s = _slug(key)
        _slug_to_id[s] = cid
        _id_to_slug[cid] = val["name"]  # display name e.g. "Miss Fortune", "Kog'Maw"

    map_file.write_text(json.dumps({
        "fetched_at": _today(),
        "slug_to_id": {k: str(v) for k, v in _slug_to_id.items()},
        "id_to_slug": {str(k): v for k, v in _id_to_slug.items()},
    }), encoding="utf-8")
    logger.info(f"Loaded {len(_slug_to_id)} champions from Data Dragon {patch}")


# ---------------------------------------------------------------------------
# Lolalytics API fetcher
# ---------------------------------------------------------------------------

async def _fetch(ep: str, lane: str, champ_slug: Optional[str], patch: str,
                 extra: Optional[Dict[str, str]] = None) -> dict:
    """Single request to the lolalytics mega API."""
    params: dict = {
        "ep": ep,
        "v": "1",
        "patch": patch,
        "lane": lane,
        "tier": TIER,
        "queue": QUEUE,
        "region": REGION,
    }
    if champ_slug:
        params["c"] = champ_slug
    if extra:
        params.update(extra)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(LOLA_API, params=params)
    return resp.json()


VS_LANES = ["top", "jungle", "middle", "bottom", "support"]


async def _fetch_counter_all_lanes(champ_slug: str, lane: str, patch: str) -> tuple[List[dict], float]:
    """
    Fetch counter matchups across all 5 opponent lanes in parallel.

    The ep=counter endpoint is hard-capped at 40 results per call, but adding
    vslane={lane} filters to one opponent role and returns that role's full set.
    Querying all 5 lanes in parallel and merging gives ~161 unique matchups.
    When the same cid appears in multiple lane responses, keep the higher-n entry.

    Returns (merged_counter_list, win_rate) — win_rate from first response's stats.
    """
    responses = await asyncio.gather(*[
        _fetch("counter", lane, champ_slug, patch, extra={"vslane": vs})
        for vs in VS_LANES
    ])
    by_cid: Dict[int, dict] = {}
    win_rate = 0.0
    for resp in responses:
        if not win_rate:
            win_rate = float(resp.get("stats", {}).get("wr", 0) or 0)
        for entry in resp.get("counters", []):
            cid = entry["cid"]
            if cid not in by_cid or entry["n"] > by_cid[cid]["n"]:
                by_cid[cid] = entry
    return list(by_cid.values()), win_rate


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
    for lane_dir in (CACHE_DIR / patch).iterdir() if (CACHE_DIR / patch).exists() else []:
        if not lane_dir.is_dir():
            continue
        lane = lane_dir.name
        for champ_file in lane_dir.glob("*.json"):
            if champ_file.stem.startswith("_"):
                continue
            try:
                data = json.loads(champ_file.read_text(encoding="utf-8"))
                if not _is_stale(data) and "win_rate" in data and len(data.get("counters", [])) > 50:
                    mem_key = f"{champ_file.stem}:{lane}"
                    _matchup_mem_cache[mem_key] = {
                        "counters": data.get("counters", []),
                        "team": data.get("team", {}),
                        "win_rate": data.get("win_rate", 0.0),
                    }
                    loaded += 1
            except Exception:
                pass
    # Also warm the games_by_slug cache from pool files
    for lane_dir in (CACHE_DIR / patch).iterdir() if (CACHE_DIR / patch).exists() else []:
        if not lane_dir.is_dir():
            continue
        pool_file = lane_dir / "_pool.json"
        if pool_file.exists():
            try:
                pool = json.loads(pool_file.read_text(encoding="utf-8"))
                if not _is_stale(pool) and "games_by_slug" in pool:
                    _games_by_slug_cache[lane_dir.name] = pool["games_by_slug"]
            except Exception:
                pass
    logger.info(f"Warm cache: loaded {loaded} champions into memory")


async def get_champion_pool(role: str) -> List[str]:
    """
    Return champion names for this role sourced from the lolalytics tier list.
    Also caches total_games per champion slug for use in recommendations.
    """
    patch = await _get_patch()
    lane = ROLE_TO_LANE.get(role.lower(), "bottom")
    await _ensure_champion_map(patch)

    cached = _read_cache(patch, lane, "_pool.json")
    if cached:
        return cached["champions"]

    try:
        data = await _fetch("list", lane, None, patch)
        entries = [
            (int(cid), info)
            for cid, info in data.get("cid", {}).items()
            if info.get("defaultLane") == lane
        ]
        names = [_id_to_slug[cid] for cid, _ in entries if cid in _id_to_slug]
        # Store games keyed by slug (lowercase, no spaces) for lookup in get_matchup_data
        games_by_slug = {
            _slug(_id_to_slug[cid]): int(info.get("games", 0))
            for cid, info in entries if cid in _id_to_slug
        }
        _write_cache(patch, lane, "_pool.json", {
            "champions": names,
            "games_by_slug": games_by_slug,
        })
        _games_by_slug_cache[lane] = games_by_slug
        logger.info(f"Pool for {role}: {len(names)} champions")
        return names
    except Exception as e:
        logger.warning(f"Failed to fetch champion pool for {role}: {e}")
        return []


async def get_champion_total_games(champion: str, role: str) -> int:
    """Return the total games played for this champion/role from the cached pool."""
    lane = ROLE_TO_LANE.get(role.lower(), "bottom")
    if lane in _games_by_slug_cache:
        return _games_by_slug_cache[lane].get(_slug(champion), 0)
    patch = await _get_patch()
    cached = _read_cache(patch, lane, "_pool.json")
    if cached:
        games = cached.get("games_by_slug", {})
        _games_by_slug_cache[lane] = games
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
) -> Tuple[Dict[Tuple[str, str], float], Dict[Tuple[str, str], int], float, int, List[str]]:
    """
    Fetch conditional winrate deltas for a candidate champion from lolalytics.

    Cache hierarchy:
      1. In-process memory (module-level dicts after first load per server run)
      2. File cache: data/lolalytics/{patch}/{lane}/{champion}.json (1-day TTL)
      3. Live fetch from a1.lolalytics.com → writes to file cache on success

    Args:
        candidate: Champion being evaluated (e.g. "Caitlyn")
        role: Player's role (adc, support, mid, jungle, top)
        allies: Ally dicts with 'champion' and 'role' keys
        enemies: Enemy dicts with 'champion' and 'role' keys

    Returns:
        matchup_data: {(champ.lower(), "ally"|"enemy"): d2/100.0}
        warnings: low sample size flags
    """
    patch = await _get_patch()
    await _ensure_champion_map(patch)

    lane = ROLE_TO_LANE.get(role.lower(), "bottom")
    cand_slug = _slug(candidate)
    cache_file = f"{cand_slug}.json"

    mem_key = f"{cand_slug}:{lane}"
    if mem_key in _matchup_mem_cache:
        counter_list = _matchup_mem_cache[mem_key]["counters"]
        team_map = _matchup_mem_cache[mem_key]["team"]
        win_rate = _matchup_mem_cache[mem_key].get("win_rate", 0.0)
    else:
        file_data = _read_cache(patch, lane, cache_file)
        if file_data and "win_rate" in file_data and len(file_data.get("counters", [])) > 50:
            counter_list = file_data["counters"]
            team_map = file_data["team"]
            win_rate = file_data["win_rate"]
            logger.debug(f"File cache hit: {candidate} ({lane}, {patch})")
        else:
            try:
                (counter_list, win_rate), team_resp = await asyncio.gather(
                    _fetch_counter_all_lanes(cand_slug, lane, patch),
                    _fetch("build-team", lane, cand_slug, patch),
                )
                team_map = team_resp.get("team", {})
                _write_cache(patch, lane, cache_file, {
                    "counters": counter_list,
                    "team": team_map,
                    "win_rate": win_rate,
                })
                logger.info(f"Fetched and cached: {candidate} ({lane}, {patch})")
            except Exception as e:
                logger.warning(f"lolalytics fetch failed for {candidate}: {e}")
                return {}, {}, 0.0, 0, [f"{candidate}: data unavailable ({e})"]
        _matchup_mem_cache[mem_key] = {"counters": counter_list, "team": team_map, "win_rate": win_rate}

    # Build O(1) lookup structures
    counter_by_cid = {entry["cid"]: entry for entry in counter_list}
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
    total_games = await get_champion_total_games(candidate, role)

    logger.info(
        f"lolalytics data for {candidate} ({role}): "
        f"{len(matchup_data)}/{len(enemies) + len(allies)} matchups found"
    )
    return matchup_data, matchup_n, win_rate, total_games, warnings
