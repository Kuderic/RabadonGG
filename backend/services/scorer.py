"""Pure scoring logic for champion recommendations.

This module computes a weighted score for a given champion candidate
using conditional matchup data and role-based weights from scoring_config.
"""

from typing import Dict, List, Tuple

import scoring_config


def score_champion(
    candidate: str,
    role: str,
    allies: List[Dict[str, str]],
    enemies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
) -> float:
    """
    Compute a weighted score for a champion candidate.

    This is a pure function with no I/O. It aggregates conditional winrate
    deltas using role-based weights from scoring_config.

    Args:
        candidate: Champion being evaluated
        role: Player's role (adc, support, mid, jungle, top)
        allies: List of ally dicts with keys 'champion' and 'role'
        enemies: List of enemy dicts with keys 'champion' and 'role'
        matchup_data: Dict mapping (champion_pair, relationship) tuples
                      to winrate deltas. Relationship is 'ally' or 'enemy'.
                      E.g., {('Thresh', 'ally'): 0.015, ('Draven', 'enemy'): -0.012}

    Returns:
        Weighted composite score. Higher is better.
    """
    # Get role weights from config
    role_key = role.lower()
    if role_key not in [
        "adc", "support", "mid", "jungle", "top"
    ]:
        raise ValueError(f"Unknown role: {role_key}")

    # Fetch config for this role
    enemy_weights = getattr(
        scoring_config, f"{role_key.upper()}_ENEMY_ROLE_WEIGHTS"
    )
    ally_weights = getattr(
        scoring_config, f"{role_key.upper()}_ALLY_ROLE_WEIGHTS"
    )
    role_blend = getattr(scoring_config, f"{role_key.upper()}_ROLE_BLEND")

    # Compute weighted counter score (vs. enemies)
    counter_score = 0.0
    for enemy in enemies:
        enemy_champ = enemy["champion"].lower()
        enemy_role = enemy["role"].lower()
        key = (enemy_champ, "enemy")

        if key in matchup_data:
            delta = matchup_data[key]
            weight = enemy_weights.get(enemy_role, 0.0)
            counter_score += delta * weight

    # Compute weighted synergy score (vs. allies)
    synergy_score = 0.0
    for ally in allies:
        ally_champ = ally["champion"].lower()
        ally_role = ally["role"].lower()
        key = (ally_champ, "ally")

        if key in matchup_data:
            delta = matchup_data[key]
            weight = ally_weights.get(ally_role, 0.0)
            synergy_score += delta * weight

    # Blend counter and synergy scores
    w_counter = role_blend["W_counter"]
    w_synergy = role_blend["W_synergy"]

    # Normalize to make the final score interpretable (0.0 to 1.0 range)
    # by scaling and offsetting
    final_score = (w_counter * counter_score) + (w_synergy * synergy_score)

    # Offset to keep in roughly 0.5-1.0 range for display
    final_score = max(0.0, 0.5 + final_score)

    return final_score


def _fmt(delta: float) -> str:
    sign = "+" if delta >= 0 else ""
    return f"{sign}{delta * 100:.1f}%"


def get_synergy_breakdown(
    allies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
    matchup_n: Dict[Tuple[str, str], int],
) -> tuple[List[Dict], List[str]]:
    """Return (per-ally delta list, missing ally names list) for tooltip display."""
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
    """Return (per-enemy delta list, missing enemy names list) for tooltip display."""
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
    """
    Format the average ally synergy delta as a percentage string.

    Args:
        candidate: Champion name
        allies: List of ally dicts
        matchup_data: Conditional data dict

    Returns:
        String like '+1.1%' or '-0.3%'
    """
    deltas = []
    for ally in allies:
        ally_champ = ally["champion"].lower()
        key = (ally_champ, "ally")
        if key in matchup_data:
            deltas.append(matchup_data[key])

    if not deltas:
        return "+0.0%"

    avg_delta = sum(deltas) / len(deltas)
    sign = "+" if avg_delta >= 0 else ""
    return f"{sign}{avg_delta * 100:.1f}%"


def get_counter_delta_string(
    candidate: str,
    enemies: List[Dict[str, str]],
    matchup_data: Dict[Tuple[str, str], float],
) -> str:
    """
    Format the average enemy counter delta as a percentage string.

    Args:
        candidate: Champion name
        enemies: List of enemy dicts
        matchup_data: Conditional data dict

    Returns:
        String like '+1.2%' or '-0.5%'
    """
    deltas = []
    for enemy in enemies:
        enemy_champ = enemy["champion"].lower()
        key = (enemy_champ, "enemy")
        if key in matchup_data:
            deltas.append(matchup_data[key])

    if not deltas:
        return "+0.0%"

    avg_delta = sum(deltas) / len(deltas)
    sign = "+" if avg_delta >= 0 else ""
    return f"{sign}{avg_delta * 100:.1f}%"
