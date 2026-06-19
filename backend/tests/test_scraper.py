"""Tests for scraper.py — champion pool and matchup data fetching.

Mocks both the LolalyticsClient (no real HTTP) and the db layer (no real SQLite).

Run from the backend/ directory:
    python -m pytest tests/test_scraper.py -v
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Ensure the backend package root is on sys.path so imports resolve correctly
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import services.scraper as scraper
from services.lolalytics_client import LolalyticsTimeoutError

# All async tests in this file are marked automatically
pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Constants reused across tests
# ---------------------------------------------------------------------------

PATCH = "16.11"
TIER = "emerald_plus"

# Realistic CIDs for the champions we use in tests
CID_CAITLYN = 51
CID_JINX = 222
CID_THRESH = 412
CID_JINX_STR = str(CID_JINX)
CID_CAITLYN_STR = str(CID_CAITLYN)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client_mock(fetch_return=None, fetch_side_effect=None) -> MagicMock:
    """
    Build a mock that mimics what get_client() returns.

    get_client() returns a LolalyticsClient instance whose fetch() is async.
    """
    mock_client = MagicMock()
    mock_fetch = AsyncMock()
    if fetch_side_effect is not None:
        mock_fetch.side_effect = fetch_side_effect
    elif fetch_return is not None:
        mock_fetch.return_value = fetch_return
    mock_client.fetch = mock_fetch
    return mock_client


def _pool_lolalytics_response() -> dict:
    """Minimal lolalytics ep=list response with two champions in tier > 0."""
    return {
        "cid": {
            CID_CAITLYN_STR: {"tier": 1, "games": 50000},
            CID_JINX_STR: {"tier": 2, "games": 30000},
        }
    }


def _counter_response(win_rate: float = 51.5) -> dict:
    """Minimal ep=counter response."""
    return {
        "stats": {"wr": win_rate},
        "counters": [
            {"cid": CID_THRESH, "d2": 278, "n": 5000},
        ],
    }


def _build_team_response() -> dict:
    """Minimal ep=build-team response."""
    return {
        "team": {
            "support": [
                # [cid, wr, d1, d2, pr, n]
                [CID_THRESH, 52.0, 1.0, 150, 0.1, 8000],
            ]
        }
    }


def _make_db_matchup_counters(n: int = 5000) -> list:
    """A counter list long enough to pass the >50 length check, all vslane-tagged."""
    entries = []
    for i in range(60):
        entries.append({
            "cid": 1000 + i,
            "d2": 100 + i,
            "n": n,
            "query_vslane": "bottom",
        })
    return entries


def _make_db_matchup_data(n: int = 5000) -> dict:
    """Return a db.read_matchup()-style dict."""
    return {
        "counters": _make_db_matchup_counters(n),
        "team": {},
        "win_rate": 51.5,
        "total_games": 40000,
        "fetched_at": "2026-06-11",
    }


# ===========================================================================
# TestGetChampionPool
# ===========================================================================

class TestGetChampionPool:

    async def test_pool_returns_cached_result(self):
        """
        When db.read_pool() returns a hit, get_champion_pool() returns the cached
        champion list without ever calling get_client().
        """
        cached_pool = {
            "champions": ["Caitlyn", "Jinx"],
            "games_by_slug": {"caitlyn": 50000, "jinx": 30000},
        }

        with patch("services.scraper.db") as mock_db, \
             patch("services.scraper.get_client") as mock_get_client, \
             patch("services.scraper._ensure_champion_map", new=AsyncMock()):
            mock_db.read_pool.return_value = cached_pool

            result = await scraper.get_champion_pool("adc", patch=PATCH, tier=TIER)

        assert result == ["Caitlyn", "Jinx"]
        mock_get_client.assert_not_called()

    async def test_pool_fetches_on_cache_miss(self):
        """
        When db.read_pool() returns None, get_champion_pool() calls the client,
        returns champion names, and writes the result back to the DB.
        """
        mock_client = _make_client_mock(fetch_return=_pool_lolalytics_response())

        # Pre-populate the ID maps so the function can resolve CIDs → names
        with patch("services.scraper.db") as mock_db, \
             patch("services.scraper.get_client", return_value=mock_client), \
             patch("services.scraper._ensure_champion_map", new=AsyncMock()), \
             patch.dict("services.scraper._id_to_slug", {
                 CID_CAITLYN: "Caitlyn",
                 CID_JINX: "Jinx",
             }), \
             patch.dict("services.scraper._slug_to_id", {
                 "caitlyn": CID_CAITLYN,
                 "jinx": CID_JINX,
             }):
            mock_db.read_pool.return_value = None

            result = await scraper.get_champion_pool("adc", patch=PATCH, tier=TIER)

        assert "Caitlyn" in result
        assert "Jinx" in result
        mock_db.write_pool.assert_called_once()

    async def test_pool_returns_empty_on_fetch_failure(self):
        """
        When the client raises LolalyticsTimeoutError the function catches it and
        returns an empty list without propagating the exception.
        """
        mock_client = _make_client_mock(
            fetch_side_effect=LolalyticsTimeoutError("timed out")
        )

        with patch("services.scraper.db") as mock_db, \
             patch("services.scraper.get_client", return_value=mock_client), \
             patch("services.scraper._ensure_champion_map", new=AsyncMock()):
            mock_db.read_pool.return_value = None

            result = await scraper.get_champion_pool("adc", patch=PATCH, tier=TIER)

        assert result == []


# ===========================================================================
# TestGetMatchupData
# ===========================================================================

class TestGetMatchupData:

    def setup_method(self):
        """Clear module-level in-process caches before every test."""
        scraper._matchup_mem_cache.clear()
        # Pre-seed the slug ↔ ID maps so champion lookups resolve without DDragon
        scraper._slug_to_id.update({
            "caitlyn": CID_CAITLYN,
            "jinx": CID_JINX,
            "thresh": CID_THRESH,
        })
        scraper._id_to_slug.update({
            CID_CAITLYN: "Caitlyn",
            CID_JINX: "Jinx",
            CID_THRESH: "Thresh",
        })
        scraper._api_slug_map.update({
            "caitlyn": "caitlyn",
            "jinx": "jinx",
            "thresh": "thresh",
        })

    def teardown_method(self):
        """Clean up after each test to avoid cross-test pollution."""
        scraper._matchup_mem_cache.clear()

    async def test_matchup_mem_cache_hit(self):
        """
        When _matchup_mem_cache already has a valid entry for the candidate,
        get_matchup_data() uses it immediately — no network call.
        """
        counters = _make_db_matchup_counters()
        mem_key = f"{TIER}:{PATCH}:caitlyn:bottom"
        scraper._matchup_mem_cache[mem_key] = {
            "counters": counters,
            "team": {},
            "win_rate": 51.5,
        }

        with patch("services.scraper.get_client") as mock_get_client, \
             patch("services.scraper._ensure_champion_map", new=AsyncMock()), \
             patch("services.scraper.db") as mock_db:
            mock_db.read_pool.return_value = None

            matchup_data, matchup_n, win_rate, total_games, warnings = \
                await scraper.get_matchup_data("Caitlyn", "adc", [], [], PATCH, TIER)

        mock_get_client.assert_not_called()
        assert win_rate == 51.5

    async def test_matchup_db_cache_hit(self):
        """
        When mem cache is empty but db.read_matchup() returns valid data,
        get_matchup_data() uses it without hitting the network.
        """
        db_data = _make_db_matchup_data()

        with patch("services.scraper.get_client") as mock_get_client, \
             patch("services.scraper._ensure_champion_map", new=AsyncMock()), \
             patch("services.scraper.db") as mock_db:
            mock_db.read_matchup.return_value = db_data
            mock_db.read_pool.return_value = None

            matchup_data, matchup_n, win_rate, total_games, warnings = \
                await scraper.get_matchup_data("Caitlyn", "adc", [], [], PATCH, TIER)

        mock_get_client.assert_not_called()
        assert win_rate == 51.5

    async def test_matchup_cold_fetch(self):
        """
        On a complete cache miss, get_matchup_data() calls the lolalytics client,
        populates matchup_data/win_rate, and calls db.write_matchup().

        Enemy champion Thresh is provided with a known role so the role-specific
        counter entry is matched.
        """
        # Build counter responses for each of the 5 vslanes
        # Only the "support" vslane entry for Thresh will be used since role is known
        def fetch_side_effect(params):
            ep = params.get("ep")
            if ep == "counter":
                entry = {"cid": CID_THRESH, "d2": 278, "n": 5000, "vsWr": 49.0}
                return {"stats": {"wr": 51.5}, "counters": [entry]}
            elif ep == "build-team":
                return _build_team_response()
            return {}

        mock_client = MagicMock()
        mock_client.fetch = AsyncMock(side_effect=fetch_side_effect)

        enemies = [{"champion": "Thresh", "role": "support"}]

        with patch("services.scraper.get_client", return_value=mock_client), \
             patch("services.scraper._ensure_champion_map", new=AsyncMock()), \
             patch("services.scraper.db") as mock_db:
            mock_db.read_matchup.return_value = None
            mock_db.read_pool.return_value = None

            matchup_data, matchup_n, win_rate, total_games, warnings = \
                await scraper.get_matchup_data(
                    "Caitlyn", "adc", [], enemies, PATCH, TIER
                )

        assert win_rate == pytest.approx(51.5)
        assert ("thresh", "enemy") in matchup_data
        assert matchup_data[("thresh", "enemy")] == pytest.approx(278 / 100.0)
        mock_db.write_matchup.assert_called_once()

    async def test_matchup_timeout_returns_empty_with_warning(self):
        """
        When the client raises LolalyticsTimeoutError on a cold fetch, the function
        returns ({}, {}, 0.0, 0, [warning]) without re-raising.
        """
        mock_client = _make_client_mock(
            fetch_side_effect=LolalyticsTimeoutError("timed out")
        )

        with patch("services.scraper.get_client", return_value=mock_client), \
             patch("services.scraper._ensure_champion_map", new=AsyncMock()), \
             patch("services.scraper.db") as mock_db:
            mock_db.read_matchup.return_value = None
            mock_db.read_pool.return_value = None

            matchup_data, matchup_n, win_rate, total_games, warnings = \
                await scraper.get_matchup_data("Caitlyn", "adc", [], [], PATCH, TIER)

        assert matchup_data == {}
        assert matchup_n == {}
        assert win_rate == 0.0
        assert total_games == 0
        assert len(warnings) == 1
        assert "Caitlyn" in warnings[0]
