"""LCU session routes — exposes the live champion-select state to the frontend.

Only enabled when the LCU watcher is running (i.e. in the desktop build).
The web build never calls these endpoints.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from services.lcu import watcher

router = APIRouter()


@router.get("/lcu/status")
async def lcu_status() -> dict:
    """Is the League client running and the watcher connected?"""
    return {"connected": watcher.connected}


@router.get("/lcu/session")
async def lcu_session() -> JSONResponse:
    """Current champion-select session, or null if not in champ select.

    Returns:
        connected: bool — whether the LoL client is detected at all
        session:   ChampSelectSession dict, or null
    """
    return JSONResponse({
        "connected": watcher.connected,
        "session": watcher.session.to_dict() if watcher.session else None,
    })
