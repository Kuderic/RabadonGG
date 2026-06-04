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


def init_db() -> None:
    """Create tables if they do not exist. Call once at startup."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
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


def read_matchup(champion: str, patch: str, tier: str, lane: str) -> Optional[dict]:
    """Return stored matchup dict or None if missing/stale (>1 day old)."""
    conn = sqlite3.connect(str(DB_PATH))
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

    if _is_stale(fetched_at):
        return None

    return {
        "counters": json.loads(counters_json),
        "team": json.loads(team_json),
        "win_rate": win_rate,
        "total_games": total_games,
        "fetched_at": fetched_at,
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
    conn = sqlite3.connect(str(DB_PATH))
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


def read_pool(lane: str, patch: str, tier: str) -> Optional[dict]:
    """Return pool dict or None if missing/stale (>1 day old)."""
    conn = sqlite3.connect(str(DB_PATH))
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

    if _is_stale(fetched_at):
        return None

    return json.loads(pool_json)


def write_pool(lane: str, patch: str, tier: str, pool: dict) -> None:
    """Upsert pool data."""
    fetched_at = datetime.date.today().isoformat()
    conn = sqlite3.connect(str(DB_PATH))
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


def load_all_valid_matchups() -> list:
    """Return all non-stale matchup rows as list of dicts (for warm_cache)."""
    today = datetime.date.today().isoformat()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute(
        "SELECT champion, patch, tier, lane, counters, team, win_rate, total_games, fetched_at "
        "FROM matchup_cache WHERE fetched_at >= ?",
        (today,),
    )
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
