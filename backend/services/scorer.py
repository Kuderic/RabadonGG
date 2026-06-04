"""Pure scoring logic for champion recommendations."""

from typing import Dict, List, Tuple

import scoring_config


def score_champion(
    candidate: str,
    role: str,
    allies: List[Dict[str, str]],
    enemies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
) -> float:
    """Role-weighted composite score used for internal tie-breaking."""
    role_key = role.lower()
    enemy_weights = getattr(scoring_config, f"{role_key.upper()}_ENEMY_ROLE_WEIGHTS")
    ally_weights  = getattr(scoring_config, f"{role_key.upper()}_ALLY_ROLE_WEIGHTS")
    role_blend    = getattr(scoring_config, f"{role_key.upper()}_ROLE_BLEND")

    counter_score = sum(
        matchup_data[(e["champion"].lower(), "enemy")] * enemy_weights.get(e["role"].lower(), 0.0)
        for e in enemies if (e["champion"].lower(), "enemy") in matchup_data
    )
    synergy_score = sum(
        matchup_data[(a["champion"].lower(), "ally")] * ally_weights.get(a["role"].lower(), 0.0)
        for a in allies if (a["champion"].lower(), "ally") in matchup_data
    )
    final = role_blend["W_counter"] * counter_score + role_blend["W_synergy"] * synergy_score
    return max(0.0, 0.5 + final)


def compute_rating(
    win_rate: float,
    allies: List[Dict[str, str]],
    enemies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
) -> float:
    """
    Transparent rating = base WR + Σ synergy deltas + Σ counter deltas (all in %).

    This is the primary sort key and the value shown to the user.
    """
    syn_sum = sum(
        matchup_data[(a["champion"].lower(), "ally")] * 100
        for a in allies if (a["champion"].lower(), "ally") in matchup_data
    )
    ctr_sum = sum(
        matchup_data[(e["champion"].lower(), "enemy")] * 100
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
            found.append({
                "champion": ally["champion"],
                "role": ally["role"],
                "delta": _fmt(matchup_data[key]),
                "n": matchup_n.get(key, 0),
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
            found.append({
                "champion": enemy["champion"],
                "role": enemy["role"],
                "delta": _fmt(matchup_data[key]),
                "n": matchup_n.get(key, 0),
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
