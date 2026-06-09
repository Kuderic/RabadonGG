import { useCallback, useEffect, useRef, useState } from 'react'
import { champIconUrl, champPrimaryRole } from '../utils/champion'
import { computeComponents } from '../utils/scoring'
import { getRecommendations, getPatches } from '../api/client'
import { useLCUSession } from '../services/lcu'
import { DEFAULT_CONFIG } from '../App'

const IS_TAURI = typeof window !== 'undefined' && window.__TAURI__ != null

function getTauriWindow() {
  return IS_TAURI ? window.__TAURI__?.window?.getCurrentWindow?.() : null
}

function PickRow({ rec, rank, role }) {
  const { totalDelta, customOffset } = computeComponents(rec, DEFAULT_CONFIG, role)
  const adjusted = totalDelta + customOffset
  const sign = adjusted >= 0 ? '+' : ''
  const deltaClass = adjusted >= 0 ? 'overlay-delta positive' : 'overlay-delta negative'
  const isTop3 = rank <= 3

  return (
    <div className="overlay-pick-row">
      <span className={isTop3 ? 'overlay-rank' : 'overlay-rank overlay-rank--other'}>
        {rank}
      </span>
      <img
        className="overlay-champ-icon"
        src={champIconUrl(rec.champion)}
        alt={rec.champion}
        onError={e => { e.target.style.visibility = 'hidden' }}
      />
      <span className="overlay-champ-name">{rec.champion}</span>
      <span className="overlay-wr">{rec.win_rate.toFixed(1)}%</span>
      <span className={deltaClass}>{sign}{adjusted.toFixed(1)}</span>
    </div>
  )
}

export default function OverlayApp() {
  const [recommendations, setRecommendations] = useState([])
  const [patch, setPatch] = useState('16.11')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)
  const prevSessionKeyRef = useRef(null)

  const { session: lcuSession } = useLCUSession()

  // Restore saved position on mount
  useEffect(() => {
    const appWindow = getTauriWindow()
    if (!appWindow) return
    const saved = localStorage.getItem('overlay-pos')
    if (saved) {
      try {
        const { x, y } = JSON.parse(saved)
        appWindow.setPosition(new window.__TAURI__.window.PhysicalPosition(x, y))
      } catch (_) {}
    }
    // Save position when dragged
    appWindow.onMoved(pos => {
      localStorage.setItem('overlay-pos', JSON.stringify({ x: pos.payload.x, y: pos.payload.y }))
    })
  }, [])

  // Fetch current patch on mount
  useEffect(() => {
    getPatches().then(patches => {
      if (patches?.length) setPatch(patches[0])
    }).catch(() => {})
  }, [])

  const handleClose = () => {
    getTauriWindow()?.hide()
  }

  const fetchRecs = useCallback(async (session, currentPatch) => {
    if (!session?.my_role || session.my_role === 'fill') return

    const allies = (session.allies || []).filter(a => a.champion)
    const enemies = (session.enemies || [])
      .filter(e => e.champion)
      .map(e => ({
        champion: e.champion,
        role: e.role && e.role !== 'fill' ? e.role : (champPrimaryRole(e.champion) || 'fill'),
      }))

    if (allies.length === 0 && enemies.length === 0) return

    setLoading(true)
    setError(null)
    try {
      const result = await getRecommendations(
        session.my_role, allies, enemies, currentPatch, 'emerald_plus'
      )
      setRecommendations((result.recommendations || []).slice(0, 5))
    } catch (err) {
      setError('No data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch when draft changes
  useEffect(() => {
    if (!lcuSession?.my_role) return

    // Build a simple fingerprint to avoid redundant fetches
    const key = JSON.stringify({
      role: lcuSession.my_role,
      allies: lcuSession.allies?.map(a => a.champion).join(','),
      enemies: lcuSession.enemies?.map(e => e.champion).join(','),
    })
    if (key === prevSessionKeyRef.current) return
    prevSessionKeyRef.current = key

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchRecs(lcuSession, patch), 600)
  }, [lcuSession, patch, fetchRecs])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const hasSession = !!lcuSession?.my_role
  const role = lcuSession?.my_role || 'adc'

  return (
    <div className="overlay-root">
      <div className="overlay-panel">
        <div className="overlay-titlebar" data-tauri-drag-region>
          <span className="overlay-titlebar-label" data-tauri-drag-region>
            RABADON.GG
          </span>
          <button className="overlay-close-btn" onClick={handleClose} title="Hide overlay">
            ✕
          </button>
        </div>

        {!hasSession ? (
          <div className="overlay-empty">Waiting for champion select…</div>
        ) : loading ? (
          <div className="overlay-empty">Analyzing draft…</div>
        ) : error ? (
          <div className="overlay-empty">{error}</div>
        ) : recommendations.length === 0 ? (
          <div className="overlay-empty">No recommendations yet</div>
        ) : (
          <div className="overlay-picks">
            {recommendations.map((rec, i) => (
              <PickRow key={rec.champion} rec={rec} rank={i + 1} role={role} />
            ))}
          </div>
        )}

        <div className="overlay-status">
          <span className="overlay-status-dot" />
          <span>{role.toUpperCase()}</span>
        </div>
      </div>
    </div>
  )
}
