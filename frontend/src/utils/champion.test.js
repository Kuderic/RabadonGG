import { describe, it, expect } from 'vitest'
import { champDDragonKey, champSlug, champPrimaryRole, filterChampions } from './champion'
import roster from './champion.roster.json'

describe('champDDragonKey', () => {
  it('removes spaces: "Miss Fortune" → "MissFortune"', () => {
    expect(champDDragonKey('Miss Fortune')).toBe('MissFortune')
  })

  it('removes apostrophes: "Kog\'Maw" → "KogMaw"', () => {
    expect(champDDragonKey("Kog'Maw")).toBe('KogMaw')
  })

  it('maps Wukong exception: "Wukong" → "MonkeyKing"', () => {
    expect(champDDragonKey('Wukong')).toBe('MonkeyKing')
  })

  it('maps Nunu exception: "Nunu & Willump" → "Nunu"', () => {
    expect(champDDragonKey('Nunu & Willump')).toBe('Nunu')
  })

  it('passthrough: "Ahri" → "Ahri"', () => {
    expect(champDDragonKey('Ahri')).toBe('Ahri')
  })

  it('removes spaces: "Aurelion Sol" → "AurelionSol"', () => {
    expect(champDDragonKey('Aurelion Sol')).toBe('AurelionSol')
  })

  it('uses exception: "Cho\'Gath" → "Chogath"', () => {
    expect(champDDragonKey("Cho'Gath")).toBe('Chogath')
  })
})

describe('champSlug', () => {
  it('"Miss Fortune" → "missfortune"', () => {
    expect(champSlug('Miss Fortune')).toBe('missfortune')
  })

  it('"Kog\'Maw" → "kogmaw"', () => {
    expect(champSlug("Kog'Maw")).toBe('kogmaw')
  })

  it('"Nunu & Willump" → "nunuwillump"', () => {
    expect(champSlug('Nunu & Willump')).toBe('nunuwillump')
  })

  it('"Ahri" → "ahri"', () => {
    expect(champSlug('Ahri')).toBe('ahri')
  })

  it('"Kai\'Sa" → "kaisa"', () => {
    expect(champSlug("Kai'Sa")).toBe('kaisa')
  })
})

describe('champPrimaryRole', () => {
  it('"Darius" → "top"', () => {
    expect(champPrimaryRole('Darius')).toBe('top')
  })

  it('"Lee Sin" → "jungle" (stored as LeeSin)', () => {
    expect(champPrimaryRole('Lee Sin')).toBe('jungle')
  })

  it('"Ahri" → "mid"', () => {
    expect(champPrimaryRole('Ahri')).toBe('mid')
  })

  it('"Jinx" → "adc"', () => {
    expect(champPrimaryRole('Jinx')).toBe('adc')
  })

  it('"Thresh" → "support"', () => {
    expect(champPrimaryRole('Thresh')).toBe('support')
  })

  it('"Draven" → "adc"', () => {
    expect(champPrimaryRole('Draven')).toBe('adc')
  })

  it('"Blitzcrank" → "support"', () => {
    expect(champPrimaryRole('Blitzcrank')).toBe('support')
  })

  it('unknown champion returns null', () => {
    expect(champPrimaryRole('NotAChampion')).toBe(null)
  })

  it('"Miss Fortune" → "adc" (stored as MissFortune)', () => {
    expect(champPrimaryRole('Miss Fortune')).toBe('adc')
  })

  it('"Kai\'Sa" → "adc" (stored as KaiSa)', () => {
    expect(champPrimaryRole("Kai'Sa")).toBe('adc')
  })
})

// Regression guard for the "champion defaults to top lane" class of bug:
// every champion in the live roster must resolve to a primary role in the
// hardcoded map. champion.roster.json is a snapshot of GET /api/champions —
// refresh it when Riot ships a new champion, which will fail this test until
// the champion is added to CHAMPION_PRIMARY_ROLE in champion.js.
// (The backend also serves a data-derived fallback via /api/champions, but the
// hardcoded map is the fast path and should stay complete for shipped champions.)
describe('champPrimaryRole — full roster coverage', () => {
  const missing = roster.filter(name => champPrimaryRole(name) === null)

  it('every champion in the roster has a primary role', () => {
    expect(missing).toEqual([])
  })
})

describe('filterChampions', () => {
  const ALL = ['Ahri', 'Annie', 'Akali', 'Brand', 'Blitzcrank', 'Miss Fortune', "Kog'Maw"]

  it('query "ah" returns Ahri first and includes it', () => {
    const result = filterChampions(ALL, 'ah')
    expect(result[0]).toBe('Ahri')
    expect(result).toContain('Ahri')
  })

  it('query "an" includes Annie', () => {
    const result = filterChampions(ALL, 'an')
    expect(result).toContain('Annie')
  })

  it('query "blit" returns [Blitzcrank]', () => {
    expect(filterChampions(ALL, 'blit')).toEqual(['Blitzcrank'])
  })

  it('query "miss" includes Miss Fortune (space-normalized match)', () => {
    const result = filterChampions(ALL, 'miss')
    expect(result).toContain('Miss Fortune')
  })

  it("query \"kogm\" includes Kog'Maw (apostrophe-normalized)", () => {
    const result = filterChampions(ALL, 'kogm')
    expect(result).toContain("Kog'Maw")
  })

  it('query "a" returns multiple results including Ahri, Akali, Annie', () => {
    const result = filterChampions(ALL, 'a')
    expect(result).toContain('Ahri')
    expect(result).toContain('Akali')
    expect(result).toContain('Annie')
  })

  it('results are capped at 8', () => {
    const big = Array.from({ length: 20 }, (_, i) => `Ahri${i}`)
    const result = filterChampions(big, 'a')
    expect(result.length).toBeLessThanOrEqual(8)
  })

  it('empty query returns []', () => {
    expect(filterChampions(ALL, '')).toEqual([])
  })

  it('no-match query returns []', () => {
    expect(filterChampions(ALL, 'zzz')).toEqual([])
  })
})
