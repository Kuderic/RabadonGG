# scoring_config.py
# Edit these values to tune the recommendation formula.
# All weights are relative — they don't need to sum to 1.

# ── ADC ──────────────────────────────────────────────────────────────────────

ADC_ENEMY_ROLE_WEIGHTS = {
    "adc":     1.00,  # mirror matchup — highest
    "support": 0.85,  # lane partner, high impact
    "jungle":  0.50,
    "mid":     0.50,
    "top":     0.40,
}

ADC_ALLY_ROLE_WEIGHTS = {
    "support": 1.00,  # direct lane synergy
    "jungle":  0.70,
    "mid":     0.60,
    "top":     0.50,
}

ADC_ROLE_BLEND = {"W_counter": 0.65, "W_synergy": 0.35}

# ── Support ───────────────────────────────────────────────────────────────────

SUPPORT_ENEMY_ROLE_WEIGHTS = {
    "support": 1.00,
    "adc":     0.85,
    "jungle":  0.50,
    "mid":     0.45,
    "top":     0.35,
}

SUPPORT_ALLY_ROLE_WEIGHTS = {
    "adc":     1.00,
    "jungle":  0.65,
    "mid":     0.50,
    "top":     0.40,
}

SUPPORT_ROLE_BLEND = {"W_counter": 0.45, "W_synergy": 0.55}

# ── Mid ───────────────────────────────────────────────────────────────────────

MID_ENEMY_ROLE_WEIGHTS = {
    "mid":     1.00,
    "jungle":  0.75,  # frequent gank target
    "support": 0.45,
    "adc":     0.40,
    "top":     0.35,
}

MID_ALLY_ROLE_WEIGHTS = {
    "jungle":  1.00,
    "support": 0.60,
    "adc":     0.50,
    "top":     0.45,
}

MID_ROLE_BLEND = {"W_counter": 0.55, "W_synergy": 0.45}

# ── Jungle ────────────────────────────────────────────────────────────────────

JUNGLE_ENEMY_ROLE_WEIGHTS = {
    "jungle":  1.00,
    "mid":     0.65,  # scuttlecrab + herald contests
    "top":     0.55,
    "support": 0.50,
    "adc":     0.40,
}

JUNGLE_ALLY_ROLE_WEIGHTS = {
    "mid":     1.00,
    "top":     0.70,
    "support": 0.65,
    "adc":     0.50,
}

JUNGLE_ROLE_BLEND = {"W_counter": 0.50, "W_synergy": 0.50}

# ── Top ───────────────────────────────────────────────────────────────────────

TOP_ENEMY_ROLE_WEIGHTS = {
    "top":     1.00,
    "jungle":  0.70,  # frequent gank target
    "mid":     0.40,
    "support": 0.35,
    "adc":     0.30,
}

TOP_ALLY_ROLE_WEIGHTS = {
    "jungle":  1.00,
    "mid":     0.55,
    "support": 0.50,
    "adc":     0.40,
}

TOP_ROLE_BLEND = {"W_counter": 0.60, "W_synergy": 0.40}
