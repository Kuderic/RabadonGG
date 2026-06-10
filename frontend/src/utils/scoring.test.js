import { describe, it, expect } from 'vitest'
import { getMultiplier, computeComponents } from './scoring'

describe('getMultiplier', () => {
  it('penalize:false always returns 1 regardless of n', () => {
    expect(getMultiplier(0, { penalize: false, penalizeThreshold: 1000 })).toBe(1)
    expect(getMultiplier(500, { penalize: false, penalizeThreshold: 1000 })).toBe(1)
    expect(getMultiplier(null, { penalize: false, penalizeThreshold: 1000 })).toBe(1)
  })

  it('penalize:true, n above threshold returns 1', () => {
    expect(getMultiplier(1500, { penalize: true, penalizeThreshold: 1000 })).toBe(1)
  })

  it('penalize:true, n exactly at threshold returns 1', () => {
    expect(getMultiplier(1000, { penalize: true, penalizeThreshold: 1000 })).toBe(1)
  })

  it('penalize:true, n below threshold returns a value strictly between 0 and 1', () => {
    const m500 = getMultiplier(500, { penalize: true, penalizeThreshold: 1000 })
    expect(m500).toBeGreaterThan(0)
    expect(m500).toBeLessThan(1)
  })

  it('penalize:true, higher n yields a higher multiplier (monotonically increasing)', () => {
    const cfg = { penalize: true, penalizeThreshold: 1000 }
    expect(getMultiplier(500, cfg)).toBeGreaterThan(getMultiplier(100, cfg))
  })

  it('penalize:true, n=0 returns 0', () => {
    expect(getMultiplier(0, { penalize: true, penalizeThreshold: 1000 })).toBe(0)
  })

  it('penalize:true, n=null returns 0', () => {
    expect(getMultiplier(null, { penalize: true, penalizeThreshold: 1000 })).toBe(0)
  })

  it('penalize:true, n=undefined returns 0', () => {
    expect(getMultiplier(undefined, { penalize: true, penalizeThreshold: 1000 })).toBe(0)
  })

  it('null config returns 1', () => {
    expect(getMultiplier(500, null)).toBe(1)
  })
})

const baseRoleWeights = {
  adc: {
    enemy:  { adc: 1, support: 1, jungle: 1, mid: 1, top: 1 },
    ally:   { support: 1, jungle: 1, mid: 1, top: 1 },
    blend:  { counter: 1, synergy: 1 },
  },
}

const noConfig = {
  penalize: false,
  penalizeThreshold: 1000,
  roleWeights: baseRoleWeights,
}

const rec = {
  win_rate: 52.0,
  synergy_breakdown: [
    { role: 'support', delta: '+2.0', n: 5000 },
    { role: 'jungle',  delta: '+1.0', n: 3000 },
  ],
  counter_breakdown: [
    { role: 'adc',     delta: '+1.5', n: 2000 },
    { role: 'support', delta: '-0.5', n: 1500 },
  ],
}

describe('computeComponents — no penalty, all weights=1', () => {
  it('adjSyn ≈ 3.0 (2.0 + 1.0)', () => {
    const { adjSyn } = computeComponents(rec, noConfig, 'adc')
    expect(adjSyn).toBeCloseTo(3.0)
  })

  it('adjCtr ≈ 1.0 (1.5 + (-0.5))', () => {
    const { adjCtr } = computeComponents(rec, noConfig, 'adc')
    expect(adjCtr).toBeCloseTo(1.0)
  })

  it('synContrib ≈ 3.0', () => {
    const { synContrib } = computeComponents(rec, noConfig, 'adc')
    expect(synContrib).toBeCloseTo(3.0)
  })

  it('ctrContrib ≈ 1.0', () => {
    const { ctrContrib } = computeComponents(rec, noConfig, 'adc')
    expect(ctrContrib).toBeCloseTo(1.0)
  })

  it('totalDelta ≈ 4.0 (synContrib + ctrContrib)', () => {
    const { totalDelta } = computeComponents(rec, noConfig, 'adc')
    expect(totalDelta).toBeCloseTo(4.0)
  })
})

describe('computeComponents — with penalty', () => {
  const penalizeConfig = {
    penalize: true,
    penalizeThreshold: 1000,
    roleWeights: baseRoleWeights,
  }

  const lowNRec = {
    win_rate: 50.0,
    synergy_breakdown: [{ role: 'support', delta: '+2.0', n: 200 }],
    counter_breakdown: [],
  }

  it('adjSyn is penalized proportionally to getMultiplier for low n', () => {
    const { adjSyn } = computeComponents(lowNRec, penalizeConfig, 'adc')
    expect(adjSyn).toBeCloseTo(2.0 * getMultiplier(200, penalizeConfig))
  })
})

describe('computeComponents — role weights', () => {
  const doubleADCConfig = {
    penalize: false,
    penalizeThreshold: 1000,
    roleWeights: {
      adc: {
        enemy:  { adc: 2, support: 1, jungle: 1, mid: 1, top: 1 },
        ally:   { support: 1, jungle: 1, mid: 1, top: 1 },
        blend:  { counter: 1, synergy: 1 },
      },
    },
  }

  it('adjCtr doubles for the ADC counter entry (adc weight=2)', () => {
    // adc entry: +1.5 × 2 = 3.0; support entry: -0.5 × 1 = -0.5 → total = 2.5
    const { adjCtr } = computeComponents(rec, doubleADCConfig, 'adc')
    expect(adjCtr).toBeCloseTo(2.5)
  })
})

describe('computeComponents — empty breakdowns', () => {
  const emptyRec = {
    win_rate: 50.0,
    synergy_breakdown: [],
    counter_breakdown: [],
  }

  it('adjSyn = 0', () => {
    const { adjSyn } = computeComponents(emptyRec, noConfig, 'adc')
    expect(adjSyn).toBe(0)
  })

  it('adjCtr = 0', () => {
    const { adjCtr } = computeComponents(emptyRec, noConfig, 'adc')
    expect(adjCtr).toBe(0)
  })

  it('totalDelta = 0', () => {
    const { totalDelta } = computeComponents(emptyRec, noConfig, 'adc')
    expect(totalDelta).toBe(0)
  })
})

describe('computeComponents — null/undefined rec fields', () => {
  const sparseRec = {
    win_rate: 50.0,
  }

  it('undefined synergy_breakdown defaults to 0', () => {
    const { adjSyn } = computeComponents(sparseRec, noConfig, 'adc')
    expect(adjSyn).toBe(0)
  })

  it('undefined counter_breakdown defaults to 0', () => {
    const { adjCtr } = computeComponents(sparseRec, noConfig, 'adc')
    expect(adjCtr).toBe(0)
  })

  it('totalDelta = 0 when breakdowns are undefined', () => {
    const { totalDelta } = computeComponents(sparseRec, noConfig, 'adc')
    expect(totalDelta).toBe(0)
  })
})
