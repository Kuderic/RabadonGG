"""Pydantic models for API requests and responses."""

from typing import List, Optional

from pydantic import BaseModel, Field


class ChampionRole(BaseModel):
    champion: str = Field(..., description="Champion name (e.g., 'Thresh')")
    role: str = Field(..., description="Role (adc, support, mid, jungle, top)")


class RecommendRequest(BaseModel):
    role: str = Field(..., description="Player's role")
    allies: List[ChampionRole] = Field(..., description="Already-selected ally champions")
    enemies: List[ChampionRole] = Field(..., description="Already-selected enemy champions")
    patch: str = Field(default="16.11", description="Patch version e.g. '16.11'")
    tier: str = Field(default="emerald_plus", description="Rank tier e.g. 'emerald_plus'")
    pool: List[str] = Field(default_factory=list, description="Champion names in user's pool")


class ChampionDelta(BaseModel):
    """Per-champion contribution to the synergy or counter score."""
    champion: str
    role: str
    delta: str   # formatted e.g. "+2.2%"
    n: int = 0   # number of games this matchup is based on


class Recommendation(BaseModel):
    champion: str
    win_rate: float = Field(..., description="Champion baseline win rate for this role (e.g. 51.07)")
    rating: float = Field(..., description="win_rate + Σ synergy deltas + Σ counter deltas (%)")
    total_games: int = Field(0, description="Total games analyzed for this champion in this role/patch/tier")
    synergy_delta: str
    synergy_breakdown: List[ChampionDelta] = Field(default_factory=list)
    synergy_missing: List[str] = Field(default_factory=list, description="Allies with no synergy data")
    counter_delta: str
    counter_breakdown: List[ChampionDelta] = Field(default_factory=list)
    counter_missing: List[str] = Field(default_factory=list, description="Enemies with no counter data")
    data_warnings: List[str] = Field(default_factory=list)


class RecommendResponse(BaseModel):
    patch: str
    tier: str
    recommendations: List[Recommendation]
    pool_picks: List[Recommendation] = Field(default_factory=list, description="Pool champion scoring results")


# ── Draft Overview ──────────────────────────────────────────────────────────

class DraftSlot(BaseModel):
    role: str
    champion: Optional[str] = None
    locked: bool = False


class YouSpec(BaseModel):
    side: str  # "ally" | "enemy"
    role: str


class DraftOverviewRequest(BaseModel):
    patch: str = Field(default="16.11")
    tier: str = Field(default="emerald_plus")
    you: Optional[YouSpec] = None
    ally: List[DraftSlot]
    enemy: List[DraftSlot]


class DraftSlotResult(BaseModel):
    role: str
    locked: bool
    champion: Optional[str] = None
    rec: Optional[Recommendation] = None
    candidates: Optional[List[Recommendation]] = None


class DraftOverviewResponse(BaseModel):
    ally: List[DraftSlotResult]
    enemy: List[DraftSlotResult]
