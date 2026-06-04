import { useState } from 'react'
import DraftForm from './components/DraftForm'
import RecommendationList from './components/RecommendationList'
import { getRecommendations } from './api/client'

const ROLE_ALLY_SLOTS = {
  top:     ['jungle', 'mid', 'adc', 'support'],
  jungle:  ['top', 'mid', 'adc', 'support'],
  mid:     ['top', 'jungle', 'adc', 'support'],
  adc:     ['top', 'jungle', 'mid', 'support'],
  support: ['top', 'jungle', 'mid', 'adc'],
}

const ENEMY_SLOTS = ['top', 'jungle', 'mid', 'adc', 'support']

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
  const [role, setRole] = useState('adc')
  const [allies, setAllies] = useState(() => makeAllies(ROLE_ALLY_SLOTS['adc']))
  const [enemies, setEnemies] = useState(() => makeEnemies())
  const [recommendations, setRecommendations] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
    try {
      const result = await getRecommendations(
        role,
        allies.filter(a => a.champion.trim()),
        enemies.filter(e => e.champion.trim())
      )
      setRecommendations(result.recommendations || [])
      setMeta({ patch: result.patch, tier: result.tier })
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
        <h1>Rabadon.GG</h1>
        <p>Real-time champion select analysis powered by AI</p>
      </div>

      <DraftForm
        role={role}
        allies={allies}
        enemies={enemies}
        onRoleChange={handleRoleChange}
        onAllyChange={handleAllyChange}
        onEnemyChange={handleEnemyChange}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        hasInput={hasInput}
      />

      {(recommendations.length > 0 || loading) && (
        <div className="results-section">
          <RecommendationList
            recommendations={recommendations}
            meta={meta}
            loading={loading}
          />
        </div>
      )}
    </div>
  )
}
