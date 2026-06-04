# scoring_config.py
# Edit these values to tune the recommendation formula.
# All weights are relative — they don't need to sum to 1.

# ── ADC ──────────────────────────────────────────────────────────────────────

ADC_ENEMY_ROLE_WEIGHTS = {
    "adc":     1.00,  # mirror matchup — highest
    "support": 1.00,  # lane partner, high impact
    "jungle":  1.0,
    "mid":     1.0,
    "top":     1.0,
}

ADC_ALLY_ROLE_WEIGHTS = {
    "support": 1.00,  # direct lane synergy
    "jungle":  1.0,
    "mid":     1.0,
    "top":     1.0,
}

ADC_ROLE_BLEND = {"W_counter": 1.0, "W_synergy": 1.0}

# ── Support ───────────────────────────────────────────────────────────────────

SUPPORT_ENEMY_ROLE_WEIGHTS = {
    "support": 1.00,
    "adc":     1.00,
    "jungle":  1.0,
    "mid":     1.0,
    "top":     1.0,
}

SUPPORT_ALLY_ROLE_WEIGHTS = {
    "adc":     1.00,
    "jungle":  1.0,
    "mid":     1.0,
    "top":     1.0,
}

SUPPORT_ROLE_BLEND = {"W_counter": 1.0, "W_synergy": 1.0}

# ── Mid ───────────────────────────────────────────────────────────────────────

MID_ENEMY_ROLE_WEIGHTS = {
    "mid":     1.00,
    "jungle":  1.00,  # frequent gank target
    "support": 1.00,
    "adc":     1.00,
    "top":     1.0,
}

MID_ALLY_ROLE_WEIGHTS = {
    "jungle":  1.0,
    "support": 1.00,
    "adc":     1.00,
    "top":     1.00,
}

MID_ROLE_BLEND = {"W_counter": 1.0, "W_synergy": 1.0}

# ── Jungle ────────────────────────────────────────────────────────────────────

JUNGLE_ENEMY_ROLE_WEIGHTS = {
    "jungle":  1.0,
    "mid":     1.00,  # scuttlecrab + herald contests
    "top":     1.00,
    "support": 1.00,
    "adc":     1.00,
}

JUNGLE_ALLY_ROLE_WEIGHTS = {
    "mid":     1.0,
    "top":     1.0,
    "support": 1.0,
    "adc":     1.0,
}

JUNGLE_ROLE_BLEND = {"W_counter": 1.0, "W_synergy": 1.0}

# ── Top ───────────────────────────────────────────────────────────────────────

TOP_ENEMY_ROLE_WEIGHTS = {
    "top":     1.00,
    "jungle":  1.00,  # frequent gank target
    "mid":     1.00,
    "support": 1.00,
    "adc":     1.00,
}

TOP_ALLY_ROLE_WEIGHTS = {
    "jungle":  1.00,
    "mid":     1.00,
    "support": 1.00,
    "adc":     1.00,
}

TOP_ROLE_BLEND = {"W_counter": 1.0, "W_synergy": 1.0}
