"""FastAPI application for Rabadon.GG champion select assistant."""

import logging
import os
import re
from io import BytesIO

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from routes.recommend import router as recommend_router
from routes.lcu import router as lcu_router
from routes.draft_overview import router as draft_overview_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Rabadon.GG API",
    description="League of Legends champion select assistant",
    version="0.1.0",
)

# CORS configuration: allow localhost dev server
_dev_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
]

_env_origins = os.getenv("ALLOWED_ORIGINS", "")
_allowed_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _dev_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    expose_headers=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(recommend_router, prefix="/api", tags=["recommendations"])
app.include_router(lcu_router, prefix="/api", tags=["lcu"])
app.include_router(draft_overview_router, prefix="/api", tags=["draft-overview"])


async def _patch_has_lolalytics_data(patch: str) -> bool:
    """Return True if lolalytics has live data for this patch (≥10 ranked champions)."""
    from services.lolalytics_client import get_client
    try:
        data = await get_client().fetch({
            "ep": "list", "v": "1", "lane": "middle",
            "tier": "emerald_plus", "patch": patch, "queue": "ranked", "region": "all",
        })
        ranked = sum(1 for info in data.get("cid", {}).values() if int(info.get("tier", 0)) > 0)
        return ranked >= 10
    except Exception:
        return False


@app.get("/api/patches")
async def get_patches() -> dict:
    """Fetch the 5 most recent LoL patch versions, validated against lolalytics."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("https://ddragon.leagueoflegends.com/api/versions.json")
            versions = resp.json()

        # versions[0] = "16.11.1" → extract "16.11"
        seen = set()
        candidates = []
        for v in versions:
            parts = v.split(".")
            major_minor = f"{parts[0]}.{parts[1]}"
            if major_minor not in seen:
                seen.add(major_minor)
                candidates.append(major_minor)
                if len(candidates) >= 6:
                    break

        # Drop any leading candidates that DDragon listed before lolalytics has data
        while len(candidates) > 1 and not await _patch_has_lolalytics_data(candidates[0]):
            logger.info(f"Patch {candidates[0]} not yet live on lolalytics — skipping")
            candidates.pop(0)

        return {"patches": candidates[:5]}
    except Exception as e:
        logger.error(f"Failed to fetch patches from Data Dragon: {e}")
        return {"patches": ["16.11", "16.10", "16.9", "16.8", "16.7"]}


@app.get("/api/champions")
async def get_all_champions() -> dict:
    """Return all known champion display names for frontend autocomplete."""
    from services.scraper import _id_to_slug, _ensure_champion_map, _get_patch
    patch = await _get_patch()
    await _ensure_champion_map(patch)
    return {"champions": sorted(_id_to_slug.values())}


_icon_cache: dict[str, bytes] = {}
_ddragon_full_version: str | None = None


async def _get_ddragon_version() -> str:
    global _ddragon_full_version
    if _ddragon_full_version:
        return _ddragon_full_version
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get("https://ddragon.leagueoflegends.com/api/versions.json")
        versions = resp.json()
    _ddragon_full_version = versions[0]
    return _ddragon_full_version


@app.get("/api/icon/{name}")
async def champion_icon(name: str) -> Response:
    """Proxy champion icons from DDragon — resized to 80×80 WebP with a 7-day cache."""
    if not re.fullmatch(r"[A-Za-z0-9]+", name):
        raise HTTPException(status_code=400, detail="Invalid champion name")

    if name in _icon_cache:
        return Response(
            content=_icon_cache[name],
            media_type="image/webp",
            headers={"Cache-Control": "public, max-age=604800"},
        )

    version = await _get_ddragon_version()
    url = f"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{name}.png"
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(url)
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Champion icon not found")

    from PIL import Image
    img = Image.open(BytesIO(resp.content)).convert("RGBA")
    img = img.resize((80, 80), Image.Resampling.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="WEBP", quality=85)
    img_bytes = buf.getvalue()

    _icon_cache[name] = img_bytes
    return Response(
        content=img_bytes,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=604800"},
    )


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    import asyncio
    logger.info("Rabadon.GG API starting up")
    logger.info(f"Environment: {os.getenv('ENV', 'development')}")
    # Initialize database
    from services import db
    db.init_db()
    # Pre-warm in-process cache from database so first user requests are fast
    from services.scraper import warm_cache, _id_to_slug, _ensure_champion_map, _get_patch
    await warm_cache()

    # Start the LCU watcher only in desktop builds
    if os.getenv("RABADON_DESKTOP"):
        from services.lcu import watcher
        patch = await _get_patch()
        await _ensure_champion_map(patch)
        watcher.set_id_map(_id_to_slug)
        asyncio.create_task(watcher.run())
        logger.info("LCU watcher started")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    logger.info("Rabadon.GG API shutting down")
    from services.lolalytics_client import get_client
    await get_client().close()


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="Rabadon.GG backend server")
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to listen on (default: 8000)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)",
    )
    args = parser.parse_args()

    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        reload=False,
    )
