import { useState, useEffect } from 'react'
import DraftForm from './components/DraftForm'
import RecommendationList from './components/RecommendationList'
import BreakdownPanel from './components/BreakdownPanel'
import ConfigPanel from './components/ConfigPanel'
import { getRecommendations, getChampions, getPatches } from './api/client'

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

export default function App() {
  const [activeTab, setActiveTab] = useState('draft')
  const [role, setRole] = useState('adc')
  const [allies, setAllies] = useState(() => makeAllies(ROLE_ALLY_SLOTS['adc']))
  const [enemies, setEnemies] = useState(() => makeEnemies())
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [champions, setChampions] = useState([])
  const [patch, setPatch] = useState('16.11')
  const [tier, setTier] = useState('emerald_plus')
  const [availablePatches, setAvailablePatches] = useState(['16.11'])
  const [selectedRec, setSelectedRec] = useState(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)

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

  const handleSubmit = async () => {
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
  }

  const hasInput =
    allies.some(a => a.champion.trim()) ||
    enemies.some(e => e.champion.trim())

  return (
    <div className="app-container">
      <div className="header">
        <div className="header-logo">
          <img src="/rabadon.png" alt="" className="header-logo-img" />
          <h1>Rabadon.GG</h1>
        </div>
        <p>Real-time champion select analysis</p>
      </div>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'draft' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('draft')}
        >Draft</button>
        <button
          className={`tab-btn ${activeTab === 'config' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('config')}
        >Configuration</button>
      </nav>

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
            hasInput={hasInput}
            patch={patch}
            tier={tier}
          />

          {(recommendations.length > 0 || loading) && (
            <div className="results-section">
              <RecommendationList
                recommendations={recommendations}
                loading={loading}
                selectedIndex={selectedRec}
                onSelect={setSelectedRec}
                config={config}
                playerRole={role}
                onTogglePenalty={() => setConfig(c => ({ ...c, penalize: !c.penalize }))}
              />
            </div>
          )}

          {selectedRec !== null && recommendations[selectedRec] && (
            <>
              <div className="breakdown-backdrop" onClick={() => setSelectedRec(null)} />
              <div className="breakdown-section">
                <div className="sheet-handle" />
                <BreakdownPanel
                  rec={recommendations[selectedRec]}
                  rank={selectedRec + 1}
                  onClose={() => setSelectedRec(null)}
                  settings={config}
                  playerRole={role}
                />
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'config' && (
        <ConfigPanel
          config={config}
          onChange={setConfig}
          defaultConfig={DEFAULT_CONFIG}
          patch={patch}
          tier={tier}
          availablePatches={availablePatches}
          onPatchChange={setPatch}
          onTierChange={setTier}
        />
      )}
    </div>
  )
}
