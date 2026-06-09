// Shared scoring utilities used by RecommendationList and BreakdownPanel

export function getMultiplier(n, config) {
  if (!config?.penalize) return 1
  if (!n || n <= 0) return 0
  if (n >= config.penalizeThreshold) return 1
  return Math.sqrt(n / config.penalizeThreshold)
}

/**
 * Compute role-weighted, penalty-adjusted synergy and counter components.
 * Returns { adjSyn, adjCtr, synContrib, ctrContrib, totalDelta, blend }
 * where synContrib + ctrContrib === totalDelta (blend already applied).
 */
export function computeComponents(rec, config, playerRole, modifiers = {}) {
  const parseD = str => parseFloat(str) || 0
  const rw = config?.roleWeights?.[playerRole]
  const enemyW = rw?.enemy || {}
  const allyW  = rw?.ally  || {}
  const blend  = rw?.blend || { counter: 1, synergy: 1 }

  const adjSyn = (rec.synergy_breakdown || []).reduce((s, b) => {
    return s + parseD(b.delta) * getMultiplier(b.n, config) * (allyW[b.role] ?? 1)
  }, 0)
  const adjCtr = (rec.counter_breakdown || []).reduce((s, b) => {
    return s + parseD(b.delta) * getMultiplier(b.n, config) * (enemyW[b.role] ?? 1)
  }, 0)

  const synContrib = blend.synergy * adjSyn
  const ctrContrib = blend.counter * adjCtr
  const customOffset = modifiers?.[rec.champion] ?? 0
  const totalDelta = synContrib + ctrContrib

  return { adjSyn, adjCtr, synContrib, ctrContrib, totalDelta, customOffset, blend }
}
