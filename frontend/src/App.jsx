import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import DraftForm from './components/DraftForm'
import { getRecommendations, getChampions, getPatches } from './api/client'
import { useLCUSession } from './services/lcu'

const RecommendationList = lazy(() => import('./components/RecommendationList'))
const ConfigPanel = lazy(() => import('./components/ConfigPanel'))

const ROLE_ALLY_SLOTS = {
  top:     ['jungle', 'mid', 'adc', 'support'],
  jungle:  ['top', 'mid', 'adc', 'support'],
  mid:     ['top', 'jungle', 'adc', 'support'],
  adc:     ['top', 'jungle', 'mid', 'support'],
  support: ['top', 'jungle', 'mid', 'adc'],
}

const ENEMY_SLOTS = ['top', 'jungle', 'mid', 'adc', 'support']

export const DEFAULT_CONFIG = {
  penalize: true,
  penalizeThreshold: 1000,
  roleWeights: {
    top: {
      enemy: { top: 1.0, jungle: 1.0, mid: 1.0, support: 1.0, adc: 1.0 },
      ally:  { jungle: 1.0, mid: 1.0, support: 1.0, adc: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
    jungle: {
      enemy: { jungle: 1.0, mid: 1.0, top: 1.0, support: 1.0, adc: 1.0 },
      ally:  { mid: 1.0, top: 1.0, support: 1.0, adc: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
    mid: {
      enemy: { mid: 1.0, jungle: 1.0, support: 1.0, adc: 1.0, top: 1.0 },
      ally:  { jungle: 1.0, support: 1.0, adc: 1.0, top: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
    adc: {
      enemy: { adc: 1.0, support: 1.0, jungle: 1.0, mid: 1.0, top: 1.0 },
      ally:  { support: 1.0, jungle: 1.0, mid: 1.0, top: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
    support: {
      enemy: { support: 1.0, adc: 1.0, jungle: 1.0, mid: 1.0, top: 1.0 },
      ally:  { adc: 1.0, jungle: 1.0, mid: 1.0, top: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
  }
}

function makeAllies(slots, existing = []) {
  return slots.map(slot => ({
    champion: existing.find(a => a.role === slot)?.champion || '',
    role: slot,
  }))
}

function makeEnemies(existing = []) {
  return ENEMY_SLOTS.map(slot => ({
    champion: existing.find(e => e.role === slot)?.champion || '',
    role: slot,
  }))
}

function parseUrlDraft() {
  const p = new URLSearchParams(window.location.search)
  const role = p.get('role')
  if (!role || !ROLE_ALLY_SLOTS[role]) return null
  return { role, params: p }
}

const _url = parseUrlDraft()

export default function App() {
  const [activeTab, setActiveTab] = useState('draft')
  const [role, setRole] = useState(_url?.role ?? 'adc')
  const [allies, setAllies] = useState(() => _url
    ? ROLE_ALLY_SLOTS[_url.role].map(s => ({ role: s, champion: _url.params.get(`a.${s}`) ?? '' }))
    : makeAllies(ROLE_ALLY_SLOTS['adc']))
  const [enemies, setEnemies] = useState(() => _url
    ? ENEMY_SLOTS.map(s => ({ role: s, champion: _url.params.get(`e.${s}`) ?? '' }))
    : makeEnemies())
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [champions, setChampions] = useState([])
  const [patch, setPatch] = useState(_url?.params.get('patch') ?? '16.11')
  const [tier, setTier] = useState(_url?.params.get('tier') ?? 'emerald_plus')
  const [availablePatches, setAvailablePatches] = useState(['16.11'])
  const [selectedRec, setSelectedRec] = useState(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [lowDetail, setLowDetail] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const debounceRef = useRef(null)

  const { connected: lcuConnected, session: lcuSession } = useLCUSession()

  // Auto-fill draft form when the LCU session changes.
  // Role must be applied first so ally slots are rebuilt for the correct role
  // before champions are filled in — otherwise role-based slot matching fails.
  useEffect(() => {
    if (!lcuConnected || !lcuSession) return

    const detectedRole = lcuSession.my_role || role
    const slots = ROLE_ALLY_SLOTS[detectedRole] || ROLE_ALLY_SLOTS['adc']

    if (lcuSession.my_role) setRole(lcuSession.my_role)

    setAllies(makeAllies(slots).map(slot => {
      const match = lcuSession.allies.find(a => a.role === slot.role)
      return match ? { ...slot, champion: match.champion } : slot
    }))

    setEnemies(makeEnemies().map((slot, i) => {
      const e = lcuSession.enemies[i]
      return e ? { ...slot, champion: e.champion } : slot
    }))
  }, [lcuSession, lcuConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getChampions().then(setChampions).catch(() => {})
    getPatches().then(patches => {
      setAvailablePatches(patches)
      if (patches.length > 0) setPatch(patches[0])
    }).catch(() => {})
  }, [])

  const handleRoleChange = (newRole) => {
    setRole(newRole)
    setAllies(makeAllies(ROLE_ALLY_SLOTS[newRole] || ROLE_ALLY_SLOTS['adc'], allies))
  }

  const handleAllyChange = (index, champion) => {
    const updated = [...allies]
    updated[index] = { ...updated[index], champion }
    setAllies(updated)
  }

  const handleEnemyChange = (index, champion) => {
    const updated = [...enemies]
    updated[index] = { ...updated[index], champion }
    setEnemies(updated)
  }

  const handleSubmit = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelectedRec(null)
    try {
      const result = await getRecommendations(
        role,
        allies.filter(a => a.champion.trim()),
        enemies.filter(e => e.champion.trim()),
        patch,
        tier
      )
      setRecommendations(result.recommendations || [])
    } catch (err) {
      setError('Failed to get recommendations. Is the backend running?')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [role, allies, enemies, patch, tier])

  // Check if at least one entered value matches a known champion name
  const hasValidChampion = useMemo(() => {
    const champSet = new Set(champions.map(c => c.toLowerCase()))
    return allies.some(a => champSet.has(a.champion.trim().toLowerCase())) ||
           enemies.some(e => champSet.has(e.champion.trim().toLowerCase()))
  }, [allies, enemies, champions])

  // Auto-submit: debounce 600ms after any champion/patch/tier/role change
  useEffect(() => {
    if (!hasValidChampion) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(handleSubmit, 600)
    return () => clearTimeout(debounceRef.current)
  }, [handleSubmit, hasValidChampion])

  // Keep URL in sync with draft state so any URL can be shared
  useEffect(() => {
    const p = new URLSearchParams()
    p.set('role', role)
    allies.forEach(a => { if (a.champion.trim()) p.set(`a.${a.role}`, a.champion.trim()) })
    enemies.forEach(e => { if (e.champion.trim()) p.set(`e.${e.role}`, e.champion.trim()) })
    p.set('patch', patch)
    p.set('tier', tier)
    window.history.replaceState(null, '', `?${p}`)
  }, [role, allies, enemies, patch, tier])

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [])

  return (
    <div className="app-container" data-fx="refined" data-detail={lowDetail ? 'low' : undefined}>
      <header className="header">
        <div className="header-logo">
          <img src="/rabadon.png" alt="" className="header-logo-img" />
          <h1>Rabadon.GG</h1>
        </div>
        <p>Real-time champion select analysis</p>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'draft' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('draft')}
        >Draft</button>
        <button
          className={`tab-btn ${activeTab === 'config' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('config')}
        >Configuration</button>
        <button
          className={`tab-btn ${activeTab === 'about' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('about')}
        >About</button>
      </nav>

      <main>
        {activeTab === 'draft' && (
          <>
            <DraftForm
              role={role}
              allies={allies}
              enemies={enemies}
              champions={champions}
              onRoleChange={handleRoleChange}
              onAllyChange={handleAllyChange}
              onEnemyChange={handleEnemyChange}
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
              patch={patch}
              tier={tier}
              onShare={handleShare}
              shareCopied={shareCopied}
              lcuConnected={lcuConnected}
            />

            {(recommendations.length > 0 || loading) && (
              <div className="results-section">
                <Suspense fallback={null}>
                  <RecommendationList
                    recommendations={recommendations}
                    loading={loading}
                    selectedIndex={selectedRec}
                    onSelect={setSelectedRec}
                    config={config}
                    playerRole={role}
                    onTogglePenalty={() => setConfig(c => ({ ...c, penalize: !c.penalize }))}
                  />
                </Suspense>
              </div>
            )}

          </>
        )}

        {activeTab === 'config' && (
          <Suspense fallback={null}>
            <ConfigPanel
              config={config}
              onChange={setConfig}
              defaultConfig={DEFAULT_CONFIG}
              patch={patch}
              tier={tier}
              availablePatches={availablePatches}
              onPatchChange={setPatch}
              onTierChange={setTier}
              lowDetail={lowDetail}
              onLowDetailChange={setLowDetail}
            />
          </Suspense>
        )}

        {activeTab === 'about' && (
          <div className="about-panel">
            <div className="about-section">
              <h2 className="about-heading">What is Rabadon.GG?</h2>
              <p>
                Rabadon.GG is a champion-select assistant for League of Legends. Enter your role and the champions already picked on both sides — it scores every viable champion for your role against the real draft and surfaces the top 10 picks, ranked by how well they perform <em>in this specific game</em>.
              </p>
            </div>

            <div className="about-section">
              <h2 className="about-heading">How the scoring works</h2>
              <p>
                Every score starts from the champion's base win rate for your role and tier. On top of that, two adjustments are added:
              </p>
              <div className="about-score-formula">
                Rating = Base WR + <span className="enemy-color">Counter Δ</span> + <span className="ally-color">Synergy Δ</span>
              </div>
              <ul className="about-list">
                <li><span className="enemy-color">Counter Δ</span> — the sum of win-rate deltas this champion achieves against each enemy in the draft. Positive means this pick counters the enemy composition; negative means it struggles.</li>
                <li><span className="ally-color">Synergy Δ</span> — the sum of win-rate deltas when this champion is paired with each ally. Positive means strong team synergy.</li>
              </ul>
              <p>
                All delta values are calculated on our servers using data from the official Riot Games API — millions of real games from your selected patch and tier. No guesswork, no tier lists, no editorial opinion.
              </p>
            </div>

            <div className="about-section">
              <h2 className="about-heading">Why it's better than a tier list</h2>
              <ul className="about-list">
                <li><strong>Draft-aware:</strong> A champion that's mediocre in a vacuum might be the perfect pick into a specific enemy comp. Rabadon scores the full context, not just the champion in isolation.</li>
                <li><strong>Data-driven:</strong> Every number traces back to real match outcomes. The algorithm doesn't know what's "meta" — it just reads the win rates.</li>
                <li><strong>Configurable:</strong> Role weighting lets you decide how much each enemy or ally lane should influence the score. Set counter weight higher if you're playing carry-heavy; lean into synergy weight when team coordination matters.</li>
                <li><strong>Sample-size honest:</strong> Rare matchups get flagged and optionally down-weighted. A 60% win rate across 50 games is not the same as 60% across 10,000 games.</li>
              </ul>
            </div>

            <div className="about-section">
              <h2 className="about-heading">Data source</h2>
              <p>
                Counter and synergy win rates are computed on our servers by processing match data from the official Riot Games API. You can select the patch window (current patch, previous patches, or a rolling 30-day aggregate) and the rank tier in the Configuration tab.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
