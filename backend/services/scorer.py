"""Pure scoring logic for champion recommendations."""

from typing import Dict, List, Tuple

# Must match frontend DEFAULT_CONFIG.penalizeThreshold so backend ranking
# and frontend re-sort agree on which champions belong in the top 10.
SAMPLE_THRESHOLD = 1000


def _sample_mult(n: int) -> float:
    """Linear penalty: 0 at n=0, 1.0 at n>=SAMPLE_THRESHOLD."""
    if not n or n <= 0:
        return 0.0
    if n >= SAMPLE_THRESHOLD:
        return 1.0
    return n / SAMPLE_THRESHOLD


def compute_rating(
    win_rate: float,
    allies: List[Dict[str, str]],
    enemies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
    matchup_n: Dict[Tuple[str, str], int],
) -> float:
    """
    Transparent rating = base WR + Σ penalized synergy deltas + Σ penalized counter deltas (all in %).

    Each delta is multiplied by min(n / SAMPLE_THRESHOLD, 1.0) before summing,
    so low-sample matchups cannot dominate the ranking.
    This is the primary sort key and the value shown to the user.
    """
    syn_sum = sum(
        matchup_data[(a["champion"].lower(), "ally")] * 100
        * _sample_mult(matchup_n.get((a["champion"].lower(), "ally"), 0))
        for a in allies if (a["champion"].lower(), "ally") in matchup_data
    )
    ctr_sum = sum(
        matchup_data[(e["champion"].lower(), "enemy")] * 100
        * _sample_mult(matchup_n.get((e["champion"].lower(), "enemy"), 0))
        for e in enemies if (e["champion"].lower(), "enemy") in matchup_data
    )
    return round(win_rate + syn_sum + ctr_sum, 2)


def _fmt(delta: float) -> str:
    sign = "+" if delta >= 0 else ""
    return f"{sign}{delta * 100:.1f}%"


def get_synergy_breakdown(
    allies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
    matchup_n: Dict[Tuple[str, str], int],
) -> tuple[List[Dict], List[str]]:
    found, missing = [], []
    for ally in allies:
        key = (ally["champion"].lower(), "ally")
        if key in matchup_data:
            n = matchup_n.get(key, 0)
            if n == 0:
                continue
            found.append({
                "champion": ally["champion"],
                "role": ally["role"],
                "delta": _fmt(matchup_data[key]),
                "n": n,
            })
        else:
            missing.append(ally["champion"])
    return found, missing


def get_counter_breakdown(
    enemies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
    matchup_n: Dict[Tuple[str, str], int],
) -> tuple[List[Dict], List[str]]:
    found, missing = [], []
    for enemy in enemies:
        key = (enemy["champion"].lower(), "enemy")
        if key in matchup_data:
            n = matchup_n.get(key, 0)
            if n == 0:
                continue
            found.append({
                "champion": enemy["champion"],
                "role": enemy["role"],
                "delta": _fmt(matchup_data[key]),
                "n": n,
            })
        else:
            missing.append(enemy["champion"])
    return found, missing


def get_synergy_delta_string(
    candidate: str,
    allies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
) -> str:
    """Sum of ally synergy deltas (not average) as a formatted string."""
    total = sum(
        matchup_data[(a["champion"].lower(), "ally")]
        for a in allies if (a["champion"].lower(), "ally") in matchup_data
    )
    sign = "+" if total >= 0 else ""
    return f"{sign}{total * 100:.1f}%"


def get_counter_delta_string(
    candidate: str,
    enemies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
) -> str:
    """Sum of enemy counter deltas (not average) as a formatted string."""
    total = sum(
        matchup_data[(e["champion"].lower(), "enemy")]
        for e in enemies if (e["champion"].lower(), "enemy") in matchup_data
    )
    sign = "+" if total >= 0 else ""
    return f"{sign}{total * 100:.1f}%"
