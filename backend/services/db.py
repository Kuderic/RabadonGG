"""SQLite cache layer for Lolalytics matchup and pool data.

Manages persistent storage of champion matchups and champion pools with 1-day TTL.
All functions are synchronous; callers should use asyncio.get_event_loop().run_in_executor()
if called from async context (though sqlite3 is fast enough for single-server use).
"""

import datetime
import json
import logging
import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent / "data" / "rabadon_cache.db"
logger = logging.getLogger(__name__)

# How long a connection waits for a held lock before raising "database is locked".
# Kept generous so short writes and the periodic VACUUM don't collide under load.
_BUSY_TIMEOUT_S = 30.0


def _connect() -> sqlite3.Connection:
    """Open a DB connection in WAL mode with a busy timeout, so concurrent readers
    and writers (uvicorn + the nightly prefetch) and the cleanup VACUUM's exclusive
    lock wait for each other instead of raising "database is locked"."""
    conn = sqlite3.connect(str(DB_PATH), timeout=_BUSY_TIMEOUT_S)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    """Create tables if they do not exist. Call once at startup."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = _connect()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS matchup_cache (
            champion     TEXT NOT NULL,
            patch        TEXT NOT NULL,
            tier         TEXT NOT NULL,
            lane         TEXT NOT NULL,
            counters     TEXT NOT NULL,
            team         TEXT NOT NULL,
            win_rate     REAL NOT NULL DEFAULT 0.0,
            total_games  INTEGER NOT NULL DEFAULT 0,
            fetched_at   TEXT NOT NULL,
            PRIMARY KEY (champion, patch, tier, lane)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pool_cache (
            lane         TEXT NOT NULL,
            patch        TEXT NOT NULL,
            tier         TEXT NOT NULL,
            pool_json    TEXT NOT NULL,
            fetched_at   TEXT NOT NULL,
            PRIMARY KEY (lane, patch, tier)
        )
    """)

    conn.commit()
    conn.close()
    logger.debug("Database initialized")


def _is_stale(fetched_at: str) -> bool:
    """Return True if fetched_at is more than 1 day old."""
    try:
        age = (datetime.date.today() - datetime.date.fromisoformat(fetched_at)).days
        return age >= 1
    except ValueError:
        return True


def read_matchup(
    champion: str, patch: str, tier: str, lane: str, allow_stale: bool = False
) -> Optional[dict]:
    """Return stored matchup dict or None if missing.

    By default a row older than the 1-day TTL is treated as missing (returns None).
    Pass allow_stale=True to return it anyway with an ``is_stale`` flag set — this
    powers stale-while-revalidate: callers serve the stale copy and refresh async.
    """
    conn = _connect()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT counters, team, win_rate, total_games, fetched_at FROM matchup_cache "
        "WHERE champion = ? AND patch = ? AND tier = ? AND lane = ?",
        (champion, patch, tier, lane),
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    counters_json, team_json, win_rate, total_games, fetched_at = row

    stale = _is_stale(fetched_at)
    if stale and not allow_stale:
        return None

    return {
        "counters": json.loads(counters_json),
        "team": json.loads(team_json),
        "win_rate": win_rate,
        "total_games": total_games,
        "fetched_at": fetched_at,
        "is_stale": stale,
    }


def write_matchup(
    champion: str,
    patch: str,
    tier: str,
    lane: str,
    counters: list,
    team: dict,
    win_rate: float,
    total_games: int,
) -> None:
    """Upsert matchup data."""
    fetched_at = datetime.date.today().isoformat()
    conn = _connect()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO matchup_cache
        (champion, patch, tier, lane, counters, team, win_rate, total_games, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(champion, patch, tier, lane)
        DO UPDATE SET
            counters = excluded.counters,
            team = excluded.team,
            win_rate = excluded.win_rate,
            total_games = excluded.total_games,
            fetched_at = excluded.fetched_at
        """,
        (
            champion,
            patch,
            tier,
            lane,
            json.dumps(counters),
            json.dumps(team),
            win_rate,
            total_games,
            fetched_at,
        ),
    )
    conn.commit()
    conn.close()


def read_pool(lane: str, patch: str, tier: str, allow_stale: bool = False) -> Optional[dict]:
    """Return pool dict or None if missing.

    By default a row older than the 1-day TTL is treated as missing. Pass
    allow_stale=True to return it anyway; the dict then carries ``is_stale`` and
    ``fetched_at`` so callers can serve it now and refresh in the background.
    """
    conn = _connect()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT pool_json, fetched_at FROM pool_cache "
        "WHERE lane = ? AND patch = ? AND tier = ?",
        (lane, patch, tier),
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    pool_json, fetched_at = row

    stale = _is_stale(fetched_at)
    if stale and not allow_stale:
        return None

    pool = json.loads(pool_json)
    pool["is_stale"] = stale
    pool["fetched_at"] = fetched_at
    return pool


def write_pool(lane: str, patch: str, tier: str, pool: dict) -> None:
    """Upsert pool data."""
    fetched_at = datetime.date.today().isoformat()
    conn = _connect()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO pool_cache
        (lane, patch, tier, pool_json, fetched_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(lane, patch, tier)
        DO UPDATE SET
            pool_json = excluded.pool_json,
            fetched_at = excluded.fetched_at
        """,
        (lane, patch, tier, json.dumps(pool), fetched_at),
    )
    conn.commit()
    conn.close()


def load_all_valid_pools() -> list:
    """Return all non-stale pool rows as list of dicts (for warm_cache)."""
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT lane, patch, tier, pool_json FROM pool_cache WHERE fetched_at >= date('now', '-1 day')",
    )
    rows = cursor.fetchall()
    conn.close()
    result = []
    for lane, patch, tier, pool_json in rows:
        result.append({"lane": lane, "patch": patch, "tier": tier, "pool": json.loads(pool_json)})
    return result


def load_all_valid_matchups(
    patches: Optional[list] = None, tiers: Optional[list] = None
) -> list:
    """Return non-stale matchup rows as list of dicts (for warm_cache).

    Optionally restrict to the given patches and/or tiers — warm_cache uses this
    to load only the hot combos rather than every row on disk.
    """
    conn = _connect()
    cursor = conn.cursor()

    sql = (
        "SELECT champion, patch, tier, lane, counters, team, win_rate, total_games, fetched_at "
        "FROM matchup_cache WHERE fetched_at >= date('now', '-1 day')"
    )
    params: list = []
    if patches:
        sql += f" AND patch IN ({','.join('?' * len(patches))})"
        params += list(patches)
    if tiers:
        sql += f" AND tier IN ({','.join('?' * len(tiers))})"
        params += list(tiers)
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for row in rows:
        champion, patch, tier, lane, counters_json, team_json, win_rate, total_games, fetched_at = row
        result.append(
            {
                "champion": champion,
                "patch": patch,
                "tier": tier,
                "lane": lane,
                "counters": counters_json,
                "team": team_json,
                "win_rate": win_rate,
                "total_games": total_games,
                "fetched_at": fetched_at,
            }
        )
    return result


# ---------------------------------------------------------------------------
# Maintenance: prune old rows + reclaim disk
# ---------------------------------------------------------------------------

def prune_stale(retention_days: int = 2) -> dict:
    """Delete cache rows not refreshed within ``retention_days``.

    Rows older than this are from superseded patches or abandoned (tier, patch)
    combos — never served (TTL is 1 day) and only consuming disk. Actively-used
    combos are kept fresh by the warmer / stale-while-revalidate, so they never
    fall out of the window. ``fetched_at`` is an ISO date string, so a lexical
    ``<`` comparison against the cutoff date is correct.

    Returns {'matchup_deleted', 'pool_deleted', 'cutoff'}.
    """
    cutoff = (datetime.date.today() - datetime.timedelta(days=retention_days)).isoformat()
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM matchup_cache WHERE fetched_at < ?", (cutoff,))
    matchup_deleted = cursor.rowcount
    cursor.execute("DELETE FROM pool_cache WHERE fetched_at < ?", (cutoff,))
    pool_deleted = cursor.rowcount
    conn.commit()
    conn.close()
    logger.info(
        f"prune_stale: deleted {matchup_deleted} matchup + {pool_deleted} pool "
        f"rows older than {cutoff}"
    )
    return {"matchup_deleted": matchup_deleted, "pool_deleted": pool_deleted, "cutoff": cutoff}


def vacuum() -> None:
    """Rewrite the DB file to reclaim free pages left behind by deletes/updates.

    VACUUM needs an exclusive lock and cannot run inside a transaction, so this
    opens an autocommit connection. Blocking — callers in an async context should
    offload it to a thread executor.
    """
    conn = _connect()
    conn.isolation_level = None  # autocommit: VACUUM must not be inside a transaction
    conn.execute("VACUUM")
    conn.close()
    logger.info("vacuum: database compacted")
