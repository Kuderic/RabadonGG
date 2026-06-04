"""FastAPI application for Rabadon.GG champion select assistant."""

import logging
import os

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    expose_headers=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(recommend_router, prefix="/api", tags=["recommendations"])


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    logger.info("Rabadon.GG API starting up")
    logger.info(f"Environment: {os.getenv('ENV', 'development')}")
    # Pre-warm in-process cache from disk so first user requests are fast
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
