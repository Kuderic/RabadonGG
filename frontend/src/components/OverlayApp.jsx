import { useCallback, useEffect, useRef, useState } from 'react'
import { champIconUrl, champPrimaryRole } from '../utils/champion'
import { computeComponents } from '../utils/scoring'
import { getRecommendations } from '../api/client'
import { useLCUSession } from '../services/lcu'
import { DEFAULT_CONFIG } from '../App'

const IS_TAURI = typeof window !== 'undefined' && window.__TAURI__ != null

const TIER = 'emerald_plus'
const TIER_LABEL = 'Emerald+'

const ROLE_ORDER = ['top', 'jungle', 'mid', 'adc', 'support']
const ROLE_LABEL = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'BOT', support: 'SUP' }
const ROLE_ICON = {
  top:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png',
  jungle:  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png',
  mid:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png',
  adc:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png',
  support: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png',
}

function getTauriWindow() {
  return IS_TAURI ? window.__TAURI__?.window?.getCurrentWindow?.() : null
}

export const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`
const hideImg = e => { e.target.style.visibility = 'hidden' }

export function hasLowSample(rec) {
  const thr = DEFAULT_CONFIG.penalizeThreshold
  return [...(rec.synergy_breakdown || []), ...(rec.counter_breakdown || [])]
    .some(b => b.n > 0 && b.n < thr)
}

function PickRow({ rec, rank, role }) {
  const { synContrib, ctrContrib, totalDelta, customOffset } = computeComponents(rec, DEFAULT_CONFIG, role)
  const adjusted = totalDelta + customOffset
  const lowN = hasLowSample(rec)

  return (
    <div className={rank === 1 ? 'overlay-pick overlay-pick--best' : 'overlay-pick'}>
      <span className={rank <= 3 ? 'overlay-rank' : 'overlay-rank overlay-rank--dim'}>{rank}</span>
      <img className="overlay-icon" src={champIconUrl(rec.champion)} alt={rec.champion} onError={hideImg} />
      <div className="overlay-mid">
        <span className="overlay-name">{rec.champion}</span>
        <span className="overlay-sub">
          <span className="wr">{rec.win_rate.toFixed(1)}%</span>
          {rec.total_games > 0 && <span className="games">{(rec.total_games / 1000).toFixed(0)}K</span>}
          {lowN && <span className="overlay-lown" title="Low sample size — interpret with caution">⚠</span>}
        </span>
      </div>
      <div className="overlay-right">
        <span className={`overlay-delta ${adjusted >= 0 ? 'pos' : 'neg'}`}>{fmt(adjusted)}</span>
        <span className="overlay-sc">
          <span className="s" title="Synergy with your allies">S {fmt(synContrib)}</span>
          <span className="c" title="Counter vs enemy laners">C {fmt(ctrContrib)}</span>
        </span>
      </div>
    </div>
  )
}

function MatchupStrip({ role, enemies }) {
  // enemies is already role-resolved by the main app; index by role directly.
  const byRole = {}
  for (const e of enemies || []) {
    if (e.champion && e.role) byRole[e.role] = e.champion
  }
  return (
    <div className="overlay-matchup">
      <span className="overlay-myrole">
        {ROLE_ICON[role] && <img src={ROLE_ICON[role]} alt="" onError={hideImg} />}
        <span>{ROLE_LABEL[role] || role.toUpperCase()}</span>
      </span>
      <span className="overlay-vs">VS</span>
      <span className="overlay-enemies">
        {ROLE_ORDER.map(r => byRole[r]
          ? <img key={r} className="overlay-enemy" src={champIconUrl(byRole[r])} alt={byRole[r]} title={byRole[r]} onError={hideImg} />
          : <span key={r} className="overlay-enemy overlay-enemy--empty"><img src={ROLE_ICON[r]} alt="" onError={hideImg} /></span>
        )}
      </span>
    </div>
  )
}

export function readDraft() {
  try { return JSON.parse(localStorage.getItem('rabadon-overlay-draft') || 'null') }
  catch { return null }
}

export default function OverlayApp() {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)
  const prevDraftKeyRef = useRef(null)

  // Connection status only — draft content comes from the shared localStorage state.
  const { connected: lcuConnected } = useLCUSession()

  // Draft state written by the main window on every relevant change.
  const [draft, setDraft] = useState(readDraft)
  useEffect(() => {
    const handler = e => {
      if (e.key !== 'rabadon-overlay-draft') return
      try { setDraft(JSON.parse(e.newValue || 'null')) } catch {}
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Restore saved position on mount + persist on drag.
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
    appWindow.onMoved(pos => {
      localStorage.setItem('overlay-pos', JSON.stringify({ x: pos.payload.x, y: pos.payload.y }))
    })
  }, [])

  const handleClose = () => { getTauriWindow()?.hide() }

  const fetchRecs = useCallback(async (role, allies, enemies, patch, tier) => {
    if (!role || role === 'fill') return
    const filteredAllies = (allies || []).filter(a => a.champion)
    const filteredEnemies = (enemies || [])
      .filter(e => e.champion)
      .map(e => ({
        champion: e.champion,
        role: e.role && e.role !== 'fill' ? e.role : (champPrimaryRole(e.champion) || 'fill'),
      }))
    if (filteredAllies.length === 0 && filteredEnemies.length === 0) return

    setLoading(true)
    setError(null)
    try {
      const result = await getRecommendations(role, filteredAllies, filteredEnemies, patch, tier)
      setRecommendations((result.recommendations || []).slice(0, 5))
    } catch {
      setError('No data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!draft?.role || draft.role === 'fill') return
    const key = JSON.stringify({
      role: draft.role,
      allies: (draft.allies || []).map(a => a.champion).join(','),
      enemies: (draft.enemies || []).map(e => e.champion).join(','),
    })
    if (key === prevDraftKeyRef.current) return
    prevDraftKeyRef.current = key
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(
      () => fetchRecs(draft.role, draft.allies, draft.enemies, draft.patch ?? '16.11', draft.tier ?? TIER),
      600
    )
  }, [draft, fetchRecs])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const hasSession = !!(draft?.phase && draft?.role && draft.role !== 'fill')
  const role = draft?.role || 'adc'
  const enemies = draft?.enemies || []
  const patch = draft?.patch ?? '16.11'

  const statusText = !lcuConnected ? 'Waiting for League client'
    : !hasSession ? 'League client connected'
    : 'Champion select'
  const statusCls = !lcuConnected ? '' : !hasSession ? 'connected' : 'live'

  return (
    <div className="overlay-root">
      <div className="overlay-panel">
        <div className="overlay-head" data-tauri-drag-region>
          <span className="overlay-logo" data-tauri-drag-region />
          <span className="overlay-word" data-tauri-drag-region>RABADON.GG</span>
          <span className="overlay-head-spacer" data-tauri-drag-region />
          <span className="overlay-patch">{patch}</span>
          <button className="overlay-close" onClick={handleClose} title="Hide overlay">✕</button>
        </div>

        {hasSession && <MatchupStrip role={role} enemies={enemies} />}

        {!hasSession ? (
          <div className="overlay-empty">Waiting for champion select…</div>
        ) : loading ? (
          <div className="overlay-empty">Analyzing draft…</div>
        ) : error ? (
          <div className="overlay-empty">{error}</div>
        ) : recommendations.length === 0 ? (
          <div className="overlay-empty">No recommendations yet</div>
        ) : (
          <>
            <div className="overlay-picks-head">
              <span className="l">Top Picks</span>
              <span className="r">Win% · Δ</span>
            </div>
            <div className="overlay-picks">
              {recommendations.map((rec, i) => (
                <PickRow key={rec.champion} rec={rec} rank={i + 1} role={role} />
              ))}
            </div>
          </>
        )}

        <div className="overlay-foot">
          <span className={`overlay-foot-dot ${statusCls}`} />
          <span>{statusText}</span>
          {hasSession && <span className="tier">{TIER_LABEL}</span>}
        </div>
      </div>
    </div>
  )
}
