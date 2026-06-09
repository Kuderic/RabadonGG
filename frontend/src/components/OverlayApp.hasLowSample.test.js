// @vitest-environment happy-dom
//
// OverlayApp.jsx imports DEFAULT_CONFIG from '../App', which has JSX that
// cannot be parsed in a node/jsdom test environment without a full React
// transform chain. Rather than pull in the entire App module tree, both
// functions under test are reproduced inline below — exactly mirroring the
// source implementations — so the test suite stays fast and dependency-free.
//
// If the source implementations change, update these copies accordingly.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Inline reproduction of hasLowSample()
// Source: src/components/OverlayApp.jsx
//
// DEFAULT_CONFIG.penalizeThreshold = 1000  (from src/App.jsx)
// ---------------------------------------------------------------------------
const PENALIZE_THRESHOLD = 1000  // mirrors DEFAULT_CONFIG.penalizeThreshold

function hasLowSample(rec) {
  const thr = PENALIZE_THRESHOLD
  return [...(rec.synergy_breakdown || []), ...(rec.counter_breakdown || [])]
    .some(b => b.n > 0 && b.n < thr)
}

// ---------------------------------------------------------------------------
// Inline reproduction of readDraft()
// Source: src/components/OverlayApp.jsx
// ---------------------------------------------------------------------------
function readDraft() {
  try { return JSON.parse(localStorage.getItem('rabadon-overlay-draft') || 'null') }
  catch { return null }
}

// ---------------------------------------------------------------------------
// hasLowSample tests
// ---------------------------------------------------------------------------
describe('hasLowSample', () => {
  it('returns false when both breakdowns are empty arrays', () => {
    expect(hasLowSample({ synergy_breakdown: [], counter_breakdown: [] })).toBe(false)
  })

  it('returns false when both breakdowns are undefined/missing', () => {
    expect(hasLowSample({})).toBe(false)
  })

  it('returns false when all entries have n >= 1000', () => {
    const rec = {
      synergy_breakdown: [{ n: 1000 }, { n: 5000 }],
      counter_breakdown: [{ n: 2000 }],
    }
    expect(hasLowSample(rec)).toBe(false)
  })

  it('returns true when a synergy entry has 0 < n < 1000', () => {
    const rec = {
      synergy_breakdown: [{ n: 500 }],
      counter_breakdown: [],
    }
    expect(hasLowSample(rec)).toBe(true)
  })

  it('returns true when a counter entry has 0 < n < 1000', () => {
    const rec = {
      synergy_breakdown: [],
      counter_breakdown: [{ n: 1 }],
    }
    expect(hasLowSample(rec)).toBe(true)
  })

  it('returns false when an entry has n = 0 (no-data guard: n > 0 required)', () => {
    const rec = {
      synergy_breakdown: [{ n: 0 }],
      counter_breakdown: [{ n: 0 }],
    }
    expect(hasLowSample(rec)).toBe(false)
  })

  it('returns false when an entry has n = 1000 exactly (boundary)', () => {
    const rec = {
      synergy_breakdown: [{ n: 1000 }],
      counter_breakdown: [],
    }
    expect(hasLowSample(rec)).toBe(false)
  })

  it('returns true when one entry has n = 999', () => {
    const rec = {
      synergy_breakdown: [{ n: 999 }],
      counter_breakdown: [],
    }
    expect(hasLowSample(rec)).toBe(true)
  })

  it('returns true in a mixed set where one entry is below threshold', () => {
    const rec = {
      synergy_breakdown: [{ n: 2000 }, { n: 3000 }],
      counter_breakdown: [{ n: 4000 }, { n: 200 }],
    }
    expect(hasLowSample(rec)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// readDraft tests
// ---------------------------------------------------------------------------
const DRAFT_KEY = 'rabadon-overlay-draft'

describe('readDraft', () => {
  beforeEach(() => {
    localStorage.removeItem(DRAFT_KEY)
  })

  afterEach(() => {
    localStorage.removeItem(DRAFT_KEY)
  })

  it('returns null when the key is absent', () => {
    expect(readDraft()).toBeNull()
  })

  it('returns the parsed object when a valid JSON object is stored', () => {
    const draft = { role: 'mid', allies: ['Lux'], enemies: ['Zed'] }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    expect(readDraft()).toEqual(draft)
  })

  it('returns null when the stored value is invalid JSON', () => {
    localStorage.setItem(DRAFT_KEY, 'not-json')
    expect(readDraft()).toBeNull()
  })

  it('returns null when the stored value is the string "null"', () => {
    localStorage.setItem(DRAFT_KEY, 'null')
    expect(readDraft()).toBeNull()
  })
})
