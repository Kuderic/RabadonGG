import { describe, it, expect } from 'vitest'

// fmt is defined inline here because importing from OverlayApp.jsx would pull
// in JSX and '../App' dependencies that aren't transform-safe under the node
// test environment configured in vite.config.js.
// Source: export const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`
const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`

// buildByRole mirrors the byRole construction logic inside MatchupStrip in
// OverlayApp.jsx. The component itself is not exported, so we replicate the
// logic inline for unit testing purposes.
// Source:
//   const byRole = {}
//   for (const e of enemies || []) {
//     if (e.champion && e.role) byRole[e.role] = e.champion
//   }
function buildByRole(enemies) {
  const byRole = {}
  for (const e of enemies || []) {
    if (e.champion && e.role) byRole[e.role] = e.champion
  }
  return byRole
}

// ---------------------------------------------------------------------------
// fmt
// ---------------------------------------------------------------------------

describe('fmt', () => {
  it('positive value gets a leading + sign', () => {
    expect(fmt(3.8)).toBe('+3.8')
  })

  it('negative value keeps its - sign with no +', () => {
    expect(fmt(-0.4)).toBe('-0.4')
  })

  it('zero is treated as non-negative and gets +', () => {
    expect(fmt(0)).toBe('+0.0')
  })

  it('explicit 0.0 also gets +', () => {
    expect(fmt(0.0)).toBe('+0.0')
  })

  it('positive value rounds to 1 decimal place', () => {
    expect(fmt(1.25)).toBe('+1.3')
  })

  it('negative value rounds to 1 decimal place', () => {
    expect(fmt(-1.25)).toBe('-1.3')
  })

  it('large positive value formats correctly', () => {
    expect(fmt(10.0)).toBe('+10.0')
  })
})

// ---------------------------------------------------------------------------
// buildByRole (MatchupStrip byRole construction logic)
// ---------------------------------------------------------------------------

describe('buildByRole — empty / null input', () => {
  it('empty array produces an object with no own keys', () => {
    const result = buildByRole([])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('null enemies uses the || [] guard and returns an empty object', () => {
    const result = buildByRole(null)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('undefined enemies uses the || [] guard and returns an empty object', () => {
    const result = buildByRole(undefined)
    expect(Object.keys(result)).toHaveLength(0)
  })
})

describe('buildByRole — entries that should be ignored', () => {
  it('entry with no role field is not added to byRole', () => {
    const result = buildByRole([{ champion: 'Jinx' }])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('entry with no champion field is not added to byRole', () => {
    const result = buildByRole([{ role: 'adc' }])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('entry where champion is an empty string is ignored', () => {
    const result = buildByRole([{ role: 'adc', champion: '' }])
    expect(result).not.toHaveProperty('adc')
  })
})

describe('buildByRole — overwrite behaviour', () => {
  it('two entries for the same role: last one wins', () => {
    const enemies = [
      { role: 'top', champion: 'Darius' },
      { role: 'top', champion: 'Garen' },
    ]
    const result = buildByRole(enemies)
    expect(result.top).toBe('Garen')
  })
})

describe('buildByRole — normal 5-enemy array', () => {
  const enemies = [
    { role: 'top',     champion: 'Darius' },
    { role: 'jungle',  champion: 'LeeSin' },
    { role: 'mid',     champion: 'Zed' },
    { role: 'adc',     champion: 'Jinx' },
    { role: 'support', champion: 'Thresh' },
  ]

  it('maps each role to its champion', () => {
    const result = buildByRole(enemies)
    expect(result.top).toBe('Darius')
    expect(result.jungle).toBe('LeeSin')
    expect(result.mid).toBe('Zed')
    expect(result.adc).toBe('Jinx')
    expect(result.support).toBe('Thresh')
  })

  it('produces exactly 5 keys for 5 distinct roles', () => {
    const result = buildByRole(enemies)
    expect(Object.keys(result)).toHaveLength(5)
  })
})
