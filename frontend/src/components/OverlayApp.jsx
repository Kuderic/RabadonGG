import { useEffect, useRef, useState } from 'react'
import { champIconUrl } from '../utils/champion'
import { computeComponents } from '../utils/scoring'
import { DEFAULT_CONFIG } from '../App'

const IS_TAURI = typeof window !== 'undefined' && window.__TAURI__ != null

function getTauriWindow() {
  return IS_TAURI ? window.__TAURI__.window.getCurrentWindow() : null
}

function PickRow({ rec, rank, role }) {
  const { totalDelta } = computeComponents(rec, DEFAULT_CONFIG, role)
  const sign = totalDelta >= 0 ? '+' : ''
  const deltaClass = totalDelta >= 0 ? 'overlay-delta positive' : 'overlay-delta negative'
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
      <span className={deltaClass}>{sign}{totalDelta.toFixed(1)}</span>
    </div>
  )
}

export default function OverlayApp() {
  const [recommendations, setRecommendations] = useState([])
  const [role, setRole] = useState('adc')
  const [loading, setLoading] = useState(true)
  const unlistenRef = useRef(null)
  const unlistenMovedRef = useRef(null)

  useEffect(() => {
    const appWindow = getTauriWindow()

    // Enable click-through on the transparent background; the panel itself
    // toggles this off on mouseenter so it can receive clicks.
    if (appWindow) {
      appWindow.setIgnoreCursorEvents(true)
    }

    // Restore saved position
    if (appWindow) {
      const saved = localStorage.getItem('overlay-pos')
      if (saved) {
        try {
          const { x, y } = JSON.parse(saved)
          appWindow.setPosition(new window.__TAURI__.window.PhysicalPosition(x, y))
        } catch (_) {}
      }
    }

    // Save position whenever the window is dragged
    if (appWindow) {
      appWindow.onMoved(pos => {
        localStorage.setItem('overlay-pos', JSON.stringify({ x: pos.payload.x, y: pos.payload.y }))
      }).then(unlisten => {
        unlistenMovedRef.current = unlisten
      })
    }

    // Listen for recommendation data pushed by the main window
    if (IS_TAURI) {
      window.__TAURI__.event.listen('overlay-recs', event => {
        const { recommendations: recs, role: r } = event.payload ?? {}
        if (Array.isArray(recs)) {
          setRecommendations(recs.slice(0, 5))
          setRole(r || 'adc')
          setLoading(false)
        }
      }).then(unlisten => {
        unlistenRef.current = unlisten
      })
    }

    return () => {
      unlistenRef.current?.()
      unlistenMovedRef.current?.()
    }
  }, [])

  const handlePanelEnter = () => {
    getTauriWindow()?.setIgnoreCursorEvents(false)
  }
  const handlePanelLeave = () => {
    // Small delay so the click that exits the panel is not swallowed
    setTimeout(() => getTauriWindow()?.setIgnoreCursorEvents(true), 0)
  }

  const handleClose = () => {
    getTauriWindow()?.hide()
  }

  return (
    <div className="overlay-root">
      <div
        className="overlay-panel"
        onMouseEnter={handlePanelEnter}
        onMouseLeave={handlePanelLeave}
      >
        <div className="overlay-titlebar" data-tauri-drag-region>
          <span className="overlay-titlebar-label" data-tauri-drag-region>
            RABADON.GG
          </span>
          <button className="overlay-close-btn" onClick={handleClose} title="Hide overlay">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="overlay-empty">Waiting for draft…</div>
        ) : recommendations.length === 0 ? (
          <div className="overlay-empty">No data yet</div>
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
