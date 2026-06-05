"""Tests for LCU service and routes.

Run from the backend/ directory:
    python -m pytest tests/test_lcu.py -v
"""

import sys
import os
import types
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Ensure the backend package root is on sys.path so imports resolve correctly
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_raw_session(
    local_cell: int = 0,
    my_team: list | None = None,
    their_team: list | None = None,
    phase: str = "BAN_PICK",
) -> dict:
    """Build a minimal raw LCU session dict."""
    return {
        "localPlayerCellId": local_cell,
        "timer": {"phase": phase},
        "myTeam": my_team if my_team is not None else [],
        "theirTeam": their_team if their_team is not None else [],
    }


def _member(cell_id: int, champ_id: int, position: str = "") -> dict:
    return {"cellId": cell_id, "championId": champ_id, "assignedPosition": position}


# Champion id → name map used across tests
ID_MAP = {
    1: "Annie",
    2: "Olaf",
    3: "Galio",
    4: "TwistedFate",
    5: "XinZhao",
    11: "MasterYi",
    22: "Ashe",
    53: "Blitzcrank",
    99: "Lux",
    110: "Varus",
}


# ===========================================================================
# parse_session tests
# ===========================================================================

from services.lcu import parse_session, _POSITION_MAP, ChampSelectSession, AllyPick, EnemyPick


class TestParseSession:

    def test_full_session_all_picks(self):
        """Full champ select: local player + 4 allies + 5 enemies all picked."""
        my_team = [
            _member(0, 22, "bottom"),    # local player (Ashe, adc)
            _member(1, 1, "middle"),     # Annie → mid
            _member(2, 2, "top"),        # Olaf → top
            _member(3, 3, "jungle"),     # Galio → jungle
            _member(4, 53, "utility"),   # Blitzcrank → support
        ]
        their_team = [
            _member(5, 99, "middle"),    # Lux
            _member(6, 4, "bottom"),     # TwistedFate
            _member(7, 5, "top"),        # XinZhao
            _member(8, 11, "jungle"),    # MasterYi
            _member(9, 110, "utility"),  # Varus
        ]
        raw = _make_raw_session(local_cell=0, my_team=my_team, their_team=their_team)
        session = parse_session(raw, ID_MAP)

        assert isinstance(session, ChampSelectSession)
        assert session.phase == "BAN_PICK"
        assert session.my_role == "adc"

        # 4 allies (local player excluded)
        assert len(session.allies) == 4
        ally_names = {a.champion for a in session.allies}
        assert ally_names == {"Annie", "Olaf", "Galio", "Blitzcrank"}

        # 5 enemies
        assert len(session.enemies) == 5
        enemy_names = {e.champion for e in session.enemies}
        assert enemy_names == {"Lux", "TwistedFate", "XinZhao", "MasterYi", "Varus"}

    def test_partial_session_unpicked_excluded(self):
        """Champions with championId == 0 (not yet picked) are excluded."""
        my_team = [
            _member(0, 22, "bottom"),  # local player picked
            _member(1, 0, "middle"),   # ally not picked yet
            _member(2, 2, "top"),      # ally picked
        ]
        their_team = [
            _member(5, 99, ""),        # enemy picked
            _member(6, 0, ""),         # enemy not picked
        ]
        raw = _make_raw_session(local_cell=0, my_team=my_team, their_team=their_team)
        session = parse_session(raw, ID_MAP)

        # Only the one picked ally
        assert len(session.allies) == 1
        assert session.allies[0].champion == "Olaf"

        # Only the one picked enemy
        assert len(session.enemies) == 1
        assert session.enemies[0].champion == "Lux"

    def test_local_player_excluded_from_allies(self):
        """The local player cell must not appear in the allies list."""
        my_team = [
            _member(2, 22, "bottom"),  # local player at cell 2
            _member(0, 1, "top"),
            _member(1, 2, "jungle"),
        ]
        raw = _make_raw_session(local_cell=2, my_team=my_team, their_team=[])
        session = parse_session(raw, ID_MAP)

        ally_names = {a.champion for a in session.allies}
        assert "Ashe" not in ally_names, "Local player's champion should not be in allies"
        assert ally_names == {"Annie", "Olaf"}
        assert session.my_role == "adc"

    def test_position_mapping_utility_to_support(self):
        my_team = [_member(0, 1, "utility")]
        raw = _make_raw_session(local_cell=0, my_team=my_team)
        session = parse_session(raw, ID_MAP)
        assert session.my_role == "support"

    def test_position_mapping_middle_to_mid(self):
        my_team = [_member(0, 1, "middle")]
        raw = _make_raw_session(local_cell=0, my_team=my_team)
        session = parse_session(raw, ID_MAP)
        assert session.my_role == "mid"

    def test_position_mapping_bottom_to_adc(self):
        my_team = [_member(0, 1, "bottom")]
        raw = _make_raw_session(local_cell=0, my_team=my_team)
        session = parse_session(raw, ID_MAP)
        assert session.my_role == "adc"

    def test_position_mapping_top_unchanged(self):
        my_team = [_member(0, 1, "top")]
        raw = _make_raw_session(local_cell=0, my_team=my_team)
        session = parse_session(raw, ID_MAP)
        assert session.my_role == "top"

    def test_position_mapping_jungle_unchanged(self):
        my_team = [_member(0, 1, "jungle")]
        raw = _make_raw_session(local_cell=0, my_team=my_team)
        session = parse_session(raw, ID_MAP)
        assert session.my_role == "jungle"

    def test_phase_extracted_from_timer(self):
        raw = _make_raw_session(phase="FINALIZATION")
        session = parse_session(raw, ID_MAP)
        assert session.phase == "FINALIZATION"

    def test_phase_unknown_when_timer_missing(self):
        raw = {"localPlayerCellId": 0, "myTeam": [], "theirTeam": []}
        session = parse_session(raw, ID_MAP)
        assert session.phase == "UNKNOWN"

    def test_empty_session_no_teams(self):
        """Empty session dict returns empty lists without raising."""
        raw = _make_raw_session()
        session = parse_session(raw, ID_MAP)
        assert session.allies == []
        assert session.enemies == []
        assert session.my_role is None

    def test_empty_session_missing_keys(self):
        """Completely empty dict should not raise."""
        session = parse_session({}, ID_MAP)
        assert session.allies == []
        assert session.enemies == []
        assert session.phase == "UNKNOWN"

    def test_ally_role_is_mapped(self):
        """Ally pick roles are mapped through _POSITION_MAP."""
        my_team = [
            _member(0, 22, "bottom"),    # local player
            _member(1, 1, "utility"),    # ally → support
        ]
        raw = _make_raw_session(local_cell=0, my_team=my_team)
        session = parse_session(raw, ID_MAP)
        assert len(session.allies) == 1
        assert session.allies[0].role == "support"

    def test_unknown_champion_id_excluded(self):
        """Champions whose IDs are not in id_to_name are excluded."""
        my_team = [
            _member(0, 22, "bottom"),   # local player (known)
            _member(1, 999, "top"),     # unknown champion id
        ]
        raw = _make_raw_session(local_cell=0, my_team=my_team)
        session = parse_session(raw, ID_MAP)
        assert len(session.allies) == 0


# ===========================================================================
# _POSITION_MAP constant tests
# ===========================================================================

class TestPositionMap:
    def test_all_expected_keys_present(self):
        assert _POSITION_MAP["utility"] == "support"
        assert _POSITION_MAP["middle"] == "mid"
        assert _POSITION_MAP["bottom"] == "adc"
        assert _POSITION_MAP["top"] == "top"
        assert _POSITION_MAP["jungle"] == "jungle"

    def test_unknown_position_returns_none(self):
        result = _POSITION_MAP.get("support")
        assert result is None


# ===========================================================================
# get_credentials tests  (filesystem mocked)
# ===========================================================================

from services.lcu import get_credentials, LCUCredentials


class TestGetCredentials:

    def test_valid_lockfile(self, tmp_path):
        """Parses port and password from a valid lockfile."""
        lockfile = tmp_path / "lockfile"
        lockfile.write_text("LeagueClient:12345:54321:mypassword:https", encoding="utf-8")

        with patch("services.lcu._find_lockfile", return_value=lockfile):
            creds = get_credentials()

        assert creds is not None
        assert isinstance(creds, LCUCredentials)
        assert creds.port == 54321
        assert creds.password == "mypassword"

    def test_missing_lockfile_returns_none(self):
        """Returns None when _find_lockfile returns None."""
        with patch("services.lcu._find_lockfile", return_value=None):
            creds = get_credentials()
        assert creds is None

    def test_malformed_lockfile_returns_none(self, tmp_path):
        """Returns None when the lockfile content cannot be parsed."""
        lockfile = tmp_path / "lockfile"
        lockfile.write_text("this:is:malformed", encoding="utf-8")

        with patch("services.lcu._find_lockfile", return_value=lockfile):
            creds = get_credentials()

        assert creds is None

    def test_credentials_base_url(self, tmp_path):
        """LCUCredentials.base_url is built from port."""
        lockfile = tmp_path / "lockfile"
        lockfile.write_text("LeagueClient:1:48123:secret:https", encoding="utf-8")
        with patch("services.lcu._find_lockfile", return_value=lockfile):
            creds = get_credentials()
        assert creds.base_url == "https://127.0.0.1:48123"

    def test_credentials_auth_header(self, tmp_path):
        """LCUCredentials.auth_header encodes 'riot:<password>' as Base64."""
        import base64
        lockfile = tmp_path / "lockfile"
        lockfile.write_text("LeagueClient:1:9999:hunter2:https", encoding="utf-8")
        with patch("services.lcu._find_lockfile", return_value=lockfile):
            creds = get_credentials()
        expected = "Basic " + base64.b64encode(b"riot:hunter2").decode()
        assert creds.auth_header == expected


# ===========================================================================
# FastAPI route tests  (using starlette TestClient, sync)
# ===========================================================================

from starlette.testclient import TestClient
from fastapi import FastAPI
from routes.lcu import router as lcu_router


def _make_app() -> FastAPI:
    """Build a minimal FastAPI app that mounts only the LCU router."""
    app = FastAPI()
    app.include_router(lcu_router, prefix="/api")
    return app


class TestLCURoutes:

    def test_status_not_connected(self):
        """/api/lcu/status returns {connected: false} when watcher.connected is False."""
        mock_watcher = MagicMock()
        mock_watcher.connected = False

        with patch("routes.lcu.watcher", mock_watcher):
            client = TestClient(_make_app())
            resp = client.get("/api/lcu/status")

        assert resp.status_code == 200
        body = resp.json()
        assert "connected" in body
        assert body["connected"] is False

    def test_status_connected(self):
        """/api/lcu/status returns {connected: true} when watcher.connected is True."""
        mock_watcher = MagicMock()
        mock_watcher.connected = True

        with patch("routes.lcu.watcher", mock_watcher):
            client = TestClient(_make_app())
            resp = client.get("/api/lcu/status")

        assert resp.status_code == 200
        assert resp.json()["connected"] is True

    def test_session_not_connected_returns_null_session(self):
        """/api/lcu/session returns {connected: false, session: null} when not connected."""
        mock_watcher = MagicMock()
        mock_watcher.connected = False
        mock_watcher.session = None

        with patch("routes.lcu.watcher", mock_watcher):
            client = TestClient(_make_app())
            resp = client.get("/api/lcu/session")

        assert resp.status_code == 200
        body = resp.json()
        assert body["connected"] is False
        assert body["session"] is None

    def test_session_connected_no_champ_select(self):
        """/api/lcu/session returns null session when connected but not in champ select."""
        mock_watcher = MagicMock()
        mock_watcher.connected = True
        mock_watcher.session = None

        with patch("routes.lcu.watcher", mock_watcher):
            client = TestClient(_make_app())
            resp = client.get("/api/lcu/session")

        assert resp.status_code == 200
        body = resp.json()
        assert body["connected"] is True
        assert body["session"] is None

    def test_session_returns_session_dict_when_present(self):
        """/api/lcu/session returns a session dict when watcher has a session."""
        # Build a real ChampSelectSession so to_dict() works correctly
        from services.lcu import ChampSelectSession, AllyPick, EnemyPick
        real_session = ChampSelectSession(
            phase="BAN_PICK",
            my_role="mid",
            allies=[AllyPick(champion="Annie", role="top")],
            enemies=[EnemyPick(champion="Ashe")],
        )

        mock_watcher = MagicMock()
        mock_watcher.connected = True
        mock_watcher.session = real_session

        with patch("routes.lcu.watcher", mock_watcher):
            client = TestClient(_make_app())
            resp = client.get("/api/lcu/session")

        assert resp.status_code == 200
        body = resp.json()
        assert body["connected"] is True
        sess = body["session"]
        assert sess is not None
        assert sess["phase"] == "BAN_PICK"
        assert sess["my_role"] == "mid"
        assert len(sess["allies"]) == 1
        assert sess["allies"][0]["champion"] == "Annie"
        assert sess["allies"][0]["role"] == "top"
        assert len(sess["enemies"]) == 1
        assert sess["enemies"][0]["champion"] == "Ashe"

    def test_session_response_shape(self):
        """Response always has both 'connected' and 'session' keys."""
        mock_watcher = MagicMock()
        mock_watcher.connected = False
        mock_watcher.session = None

        with patch("routes.lcu.watcher", mock_watcher):
            client = TestClient(_make_app())
            resp = client.get("/api/lcu/session")

        body = resp.json()
        assert set(body.keys()) >= {"connected", "session"}
