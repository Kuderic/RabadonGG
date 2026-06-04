"""FastAPI application for Rabadon.GG champion select assistant."""

import logging
import os

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.recommend import router as recommend_router

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


@app.get("/api/patches")
async def get_patches() -> dict:
    """Fetch the 5 most recent LoL patch versions from Data Dragon."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("https://ddragon.leagueoflegends.com/api/versions.json")
            versions = resp.json()

        # versions[0] = "16.11.1" → extract "16.11"
        seen = set()
        patches = []
        for v in versions:
            parts = v.split(".")
            major_minor = f"{parts[0]}.{parts[1]}"
            if major_minor not in seen:
                seen.add(major_minor)
                patches.append(major_minor)
                if len(patches) >= 5:
                    break

        return {"patches": patches}
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


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    logger.info("Rabadon.GG API starting up")
    logger.info(f"Environment: {os.getenv('ENV', 'development')}")
    # Initialize database
    from services import db
    db.init_db()
    # Pre-warm in-process cache from database so first user requests are fast
    from services.scraper import warm_cache
    await warm_cache()


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    logger.info("Rabadon.GG API shutting down")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
