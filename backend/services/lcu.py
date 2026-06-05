"""League Client Update (LCU) API integration.

Discovers the running League client via its lockfile, subscribes to the
champion-select WebSocket event, and caches the latest session state so
the rest of the backend can serve it on demand.

Lockfile format (auto-written by the LoL client on launch):
  LeagueClient:{pid}:{port}:{password}:https
Located in the LoL installation directory (varies by machine).

Authentication: HTTP Basic with username "riot" and the lockfile password.
The LCU uses a self-signed TLS cert on 127.0.0.1 — SSL verification is
intentionally disabled for all connections to it.
"""

import asyncio
import base64
import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Common LoL install locations tried in order.
# Users with non-standard install paths can override via LCU_LOCKFILE env var.
_DEFAULT_LOCKFILE_PATHS = [
    Path("C:/Riot Games/League of Legends/lockfile"),
    Path("D:/Riot Games/League of Legends/lockfile"),
    Path(r"C:/Program Files/Riot Games/League of Legends/lockfile"),
]

# Maps LCU assignedPosition values → the role keys used everywhere else in the app
_POSITION_MAP = {
    "top": "top",
    "jungle": "jungle",
    "middle": "mid",
    "bottom": "adc",
    "utility": "support",
}


# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------

@dataclass
class LCUCredentials:
    port: int
    password: str

    @property
    def base_url(self) -> str:
        return f"https://127.0.0.1:{self.port}"

    @property
    def auth_header(self) -> str:
        token = base64.b64encode(f"riot:{self.password}".encode()).decode()
        return f"Basic {token}"


def _find_lockfile() -> Optional[Path]:
    override = os.getenv("LCU_LOCKFILE")
    if override:
        p = Path(override)
        return p if p.exists() else None
    for path in _DEFAULT_LOCKFILE_PATHS:
        if path.exists():
            return path
    return None


def get_credentials() -> Optional[LCUCredentials]:
    """Return LCU credentials if the LoL client is running, else None."""
    lockfile = _find_lockfile()
    if not lockfile:
        return None
    try:
        parts = lockfile.read_text(encoding="utf-8").split(":")
        # LeagueClient : pid : port : password : https
        return LCUCredentials(port=int(parts[2]), password=parts[3])
    except Exception as e:
        logger.warning("Failed to parse LCU lockfile: %s", e)
        return None


# ---------------------------------------------------------------------------
# Session types
# ---------------------------------------------------------------------------

@dataclass
class AllyPick:
    champion: str
    role: Optional[str] = None  # None when position is not assigned yet


@dataclass
class EnemyPick:
    champion: str


@dataclass
class ChampSelectSession:
    """Normalised champion-select state ready to feed into RecommendRequest."""
    phase: str                            # e.g. "PLANNING", "BAN_PICK", "FINALIZATION"
    my_role: Optional[str] = None        # "top"/"jungle"/"mid"/"adc"/"support", or None
    allies: list[AllyPick] = field(default_factory=list)
    enemies: list[EnemyPick] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "phase": self.phase,
            "my_role": self.my_role,
            "allies": [{"champion": a.champion, "role": a.role} for a in self.allies],
            "enemies": [{"champion": e.champion} for e in self.enemies],
        }


# ---------------------------------------------------------------------------
# Session parser
# ---------------------------------------------------------------------------

def parse_session(raw: dict, id_to_name: dict[int, str]) -> ChampSelectSession:
    """Convert raw /lol-champ-select/v1/session JSON to ChampSelectSession.

    The local player is excluded from the allies list — they are the one
    being recommended for, not an input to the recommendation.
    """
    local_cell = raw.get("localPlayerCellId", -1)
    phase = raw.get("timer", {}).get("phase", "UNKNOWN")

    my_role: Optional[str] = None
    allies: list[AllyPick] = []
    enemies: list[EnemyPick] = []

    for member in raw.get("myTeam", []):
        champ_id = member.get("championId", 0)
        raw_pos = member.get("assignedPosition", "").lower()
        role = _POSITION_MAP.get(raw_pos)  # None if empty/unknown position
        name = id_to_name.get(champ_id) if champ_id else None

        if member.get("cellId") == local_cell:
            my_role = role
            # Don't add self to allies — the endpoint scores picks *for* the local player
        elif name:
            allies.append(AllyPick(champion=name, role=role))

    for member in raw.get("theirTeam", []):
        champ_id = member.get("championId", 0)
        name = id_to_name.get(champ_id) if champ_id else None
        if name:
            enemies.append(EnemyPick(champion=name))

    return ChampSelectSession(phase=phase, my_role=my_role, allies=allies, enemies=enemies)


# ---------------------------------------------------------------------------
# Background watcher
# ---------------------------------------------------------------------------

class LCUWatcher:
    """Maintains a persistent connection to the LCU and caches champ-select state.

    Run via asyncio as a background task (see main.py startup).
    Reconnects automatically when the LoL client restarts.
    Callers read .session and .connected — no locking needed since asyncio
    is single-threaded.
    """

    _RECONNECT_DELAY = 5   # seconds before retrying after a lost connection
    _POLL_DELAY = 2        # seconds between REST polls (fallback when WS fails)

    def __init__(self) -> None:
        self.connected: bool = False
        self.session: Optional[ChampSelectSession] = None
        self._id_to_name: dict[int, str] = {}

    def set_id_map(self, id_to_name: dict[int, str]) -> None:
        self._id_to_name = id_to_name

    async def run(self) -> None:
        """Run forever — call as asyncio.create_task(watcher.run())."""
        while True:
            creds = get_credentials()
            if not creds:
                if self.connected:
                    logger.info("LCU client not found — waiting for LoL to launch")
                self.connected = False
                self.session = None
                await asyncio.sleep(self._RECONNECT_DELAY)
                continue

            try:
                await self._watch(creds)
            except asyncio.CancelledError:
                return
            except Exception as e:
                logger.debug("LCU watcher error: %s", e)
                self.connected = False
                await asyncio.sleep(self._RECONNECT_DELAY)

    async def _watch(self, creds: LCUCredentials) -> None:
        """Connect via WebSocket and stream champ-select updates."""
        try:
            import websockets  # optional dep — only needed for desktop builds
        except ImportError:
            logger.warning("websockets package not installed — falling back to REST polling")
            await self._poll(creds)
            return

        import ssl as ssl_mod
        ssl_ctx = ssl_mod.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl_mod.CERT_NONE

        uri = f"wss://127.0.0.1:{creds.port}/"
        headers = {"Authorization": creds.auth_header}

        async with websockets.connect(uri, ssl=ssl_ctx, additional_headers=headers) as ws:
            self.connected = True
            logger.info("LCU WebSocket connected on port %d", creds.port)

            # Subscribe to all JSON API events; filter by URI in the handler.
            # Specific per-path subscriptions exist but the format varies by
            # client version — the broad subscription is always reliable.
            await ws.send(json.dumps([5, "OnJsonApiEvent"]))

            async for raw_msg in ws:
                msg = json.loads(raw_msg)
                # WAMP opcode 8 = event update
                if not msg or msg[0] != 8:
                    continue
                payload = msg[2] if len(msg) > 2 else {}
                uri = payload.get("uri", "")
                if uri != "/lol-champ-select/v1/session":
                    continue

                event_type = payload.get("eventType", "")
                if event_type == "Delete":
                    self.session = None
                elif isinstance(payload.get("data"), dict):
                    self.session = parse_session(payload["data"], self._id_to_name)

    async def _poll(self, creds: LCUCredentials) -> None:
        """REST polling fallback when the websockets package is unavailable."""
        async with httpx.AsyncClient(verify=False, timeout=3.0) as client:
            self.connected = True
            while True:
                try:
                    resp = await client.get(
                        f"{creds.base_url}/lol-champ-select/v1/session",
                        headers={"Authorization": creds.auth_header},
                    )
                    if resp.status_code == 200:
                        self.session = parse_session(resp.json(), self._id_to_name)
                    elif resp.status_code == 404:
                        self.session = None  # Not in champ select
                    await asyncio.sleep(self._POLL_DELAY)
                except httpx.RequestError:
                    break  # Client closed — outer loop will reconnect


# Singleton watcher — imported and started in main.py
watcher = LCUWatcher()
