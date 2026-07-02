import { useCallback, useEffect, useRef, useState } from 'react'
import { champIconUrl, champPrimaryRole } from '../utils/champion'
import { computeComponents } from '../utils/scoring'
import { getRecommendations } from '../api/client'
import { useLCUSession } from '../services/lcu'
import { DEFAULT_CONFIG } from '../App'
import { TIER_OPTIONS } from './TierSelector'

const IS_TAURI = typeof window !== 'undefined' && window.__TAURI__ != null

const TIER = 'emerald_plus'
const TIER_OPT = TIER_OPTIONS.find(t => t.value === TIER) || TIER_OPTIONS[1]

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

const ADV_MAX = 30

function DraftAdvantage({ advantage, onViewDetails }) {
  if (!advantage) return null
  const { allyDelta, enemyDelta, allyLocked, enemyLocked } = advantage
  if (allyLocked + enemyLocked === 0) return null

  const net = allyDelta - enemyDelta
  const lead = Math.abs(net) < 0.5 ? 'even' : (net > 0 ? 'ally' : 'enemy')
  const whoLabel = lead === 'even' ? 'Even' : (lead === 'ally' ? 'Allied' : 'Enemy')
  const mag = Math.min(Math.abs(net) / ADV_MAX, 1) * 50
  const fillLeft = lead === 'ally' ? 50 - mag : 50

  return (
    <div className="adv-sec">
      <div className="adv-sec-head">
        <span className="adv-sec-title">Draft Overview</span>
        <button className="adv-details adv-sec-btn" onClick={onViewDetails}>Details <span className="arw">›</span></button>
      </div>
      <div className="advb advb--bottom">
        <div className="advb-side advb-side--ally">
          <span className="advb-side-lbl">Ally</span>
          <span className="advb-side-val adv-num adv-num--ally">{fmt(allyDelta)}</span>
        </div>
        <div className="advb-mid">
          <div className="advb-readout">
            <span className="advb-cap">Adv</span>
            <span className={`advb-lead adv-num adv-num--${lead}`}>{lead === 'even' ? '—' : fmt(Math.abs(net))}</span>
            <span className="advb-who">{whoLabel}</span>
          </div>
          <div className="adv-track">
            <div className="adv-track-center" />
            {lead !== 'even' &&
              <div className={`adv-fill adv-fill--${lead}`} style={{ left: `${fillLeft}%`, width: `${mag}%` }} />}
          </div>
        </div>
        <div className="advb-side advb-side--enemy">
          <span className="advb-side-lbl">Enemy</span>
          <span className="advb-side-val adv-num adv-num--enemy">{fmt(enemyDelta)}</span>
        </div>
      </div>
    </div>
  )
}

export function hasLowSample(rec) {
  const thr = DEFAULT_CONFIG.penalizeThreshold
  return [...(rec.synergy_breakdown || []), ...(rec.counter_breakdown || [])]
    .some(b => b.n > 0 && b.n < thr)
}

function PickRow({ rec, rank, role, onFocus, you, locked }) {
  const { synContrib, ctrContrib, totalDelta, customOffset } = computeComponents(rec, DEFAULT_CONFIG, role)
  const adjusted = totalDelta + customOffset
  const lowN = hasLowSample(rec)

  const pickClass = [
    'overlay-pick',
    rank === 1 && !you ? 'overlay-pick--best' : '',
    you ? 'overlay-pick--you overlay-pick--clickable' : 'overlay-pick--clickable',
    locked ? 'overlay-pick--locked' : '',
  ].filter(Boolean).join(' ')

  const rankClass = [
    'overlay-rank',
    you ? 'overlay-rank--you' : rank > 3 ? 'overlay-rank--dim' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={pickClass}
      onClick={onFocus}
      title={you ? 'Click to open lookup in Rabadon.GG' : 'Click to open full breakdown in Rabadon.GG'}
    >
      <span className={rankClass}>{rank}</span>
      <img className="overlay-icon" src={champIconUrl(rec.champion)} alt={rec.champion} onError={hideImg} />
      <div className="overlay-mid">
        <span className="overlay-name">{rec.champion}</span>
        <span className="overlay-sub">
          <span className="wr">{rec.win_rate.toFixed(1)}%</span>
          {rec.total_games > 0 && <span className="games">{(rec.total_games / 1000).toFixed(0)}K</span>}
          {lowN && <span className="overlay-lown" title="Low sample size — interpret with caution">⚠</span>}
        </span>
      </div>
      <div className="overlay-metrics">
        <span className="overlay-sc">
          <span className="s" title="Synergy with your allies">S {fmt(synContrib)}</span>
          <span className="c" title="Counter vs enemy laners">C {fmt(ctrContrib)}</span>
        </span>
        <span className={`overlay-delta ${adjusted >= 0 ? 'pos' : 'neg'}`}>{fmt(adjusted)}</span>
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

function makeDeltaScore(sortMode, role) {
  return r => {
    const { totalDelta, customOffset } = computeComponents(r, DEFAULT_CONFIG, role)
    return sortMode !== 'delta' ? r.win_rate + totalDelta + customOffset : totalDelta + customOffset
  }
}

export default function OverlayApp() {
  const [recommendations, setRecommendations] = useState([])
  const [poolPicks, setPoolPicks] = useState([])
  const [yourPick, setYourPick] = useState(null)
  const [tab, setTab] = useState('overall')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)
  const prevDraftKeyRef = useRef(null)
  const prevPhaseRef = useRef(null)
  const panelRef = useRef(null)
  // Full unsorted result arrays — kept so re-sorting doesn't need a re-fetch.
  const allRecsRef = useRef([])
  const allPoolRef = useRef([])
  const intentRecRef = useRef(null) // raw intent champion rec, for rank recalc on sort change
  const [overlaySort, setOverlaySort] = useState(
    () => localStorage.getItem('rabadon-overlay-sort') || 'wr_delta'
  )
  const overlaySortRef = useRef(overlaySort)
  overlaySortRef.current = overlaySort

  const [advantage, setAdvantage] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rabadon-overlay-advantage') || 'null') }
    catch { return null }
  })

  useEffect(() => {
    try { localStorage.setItem('rabadon-overlay-sort', overlaySort) } catch {}
  }, [overlaySort])

  // Connection status only — draft content comes from the shared localStorage state.
  const { connected: lcuConnected } = useLCUSession()

  // Draft state written by the main window on every relevant change.
  const [draft, setDraft] = useState(readDraft)
  const draftRoleRef = useRef(null)
  draftRoleRef.current = draft?.role ?? null

  // Overlay appearance settings — read from localStorage, react to changes from main window.
  const [overlayScale, setOverlayScale] = useState(
    () => parseInt(localStorage.getItem('rabadon-overlay-scale') || '100', 10)
  )
  const [overlayTransparent, setOverlayTransparent] = useState(
    () => localStorage.getItem('rabadon-overlay-transparent') !== 'false'
  )

  useEffect(() => {
    const handler = e => {
      if (e.key === 'rabadon-overlay-draft') {
        try { setDraft(JSON.parse(e.newValue || 'null')) } catch {}
      } else if (e.key === 'rabadon-overlay-scale') {
        setOverlayScale(parseInt(e.newValue || '100', 10))
      } else if (e.key === 'rabadon-overlay-transparent') {
        setOverlayTransparent(e.newValue !== 'false')
      } else if (e.key === 'rabadon-overlay-sort') {
        setOverlaySort(e.newValue || 'wr_delta')
      } else if (e.key === 'rabadon-overlay-advantage') {
        try { setAdvantage(JSON.parse(e.newValue || 'null')) } catch {}
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Prevent scrollbars: the overlay window has fixed dimensions and resizes with zoom.
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
  }, [])

  // Apply zoom only (zoom doesn't affect offsetWidth/Height, so keep separate from resize).
  useEffect(() => {
    document.documentElement.style.zoom = overlayScale / 100
  }, [overlayScale])

  // Resize the Tauri window to the panel's actual rendered content height.
  // offsetWidth/Height are pre-zoom layout px in Chromium — multiply by scale
  // for physical size. ResizeObserver fires on content changes, not zoom changes.
  useEffect(() => {
    if (!IS_TAURI) return
    const panel = panelRef.current
    if (!panel) return
    const sync = () => {
      const scale = overlayScale / 100
      window.__TAURI__.core.invoke('resize_overlay', {
        width:  Math.round((panel.offsetWidth  + 2) * scale),
        height: Math.round((panel.offsetHeight + 2) * scale),
      }).catch(() => {})
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(panel)
    return () => ro.disconnect()
  }, [overlayScale])

  // Apply transparency via a class toggle. Class-based is more reliable than
  // var() inside rgba() in some WebView2 builds.
  useEffect(() => {
    if (!panelRef.current) return
    panelRef.current.classList.toggle('overlay-panel--opaque', !overlayTransparent)
  }, [overlayTransparent])

  // Re-sort existing results when the sort mode changes — no re-fetch needed.
  // Does NOT run on role change: allRecsRef holds data for the previous role until
  // the debounced fetch completes, so re-sorting early would apply wrong-role data.
  useEffect(() => {
    if (!allRecsRef.current.length) return
    const currentRole = draftRoleRef.current || 'adc'
    const score = makeDeltaScore(overlaySort, currentRole)
    setRecommendations([...allRecsRef.current].sort((a, b) => score(b) - score(a)).slice(0, 10))
    setPoolPicks([...allPoolRef.current].sort((a, b) => score(b) - score(a)).slice(0, 10))
    if (intentRecRef.current) {
      const intentScore = score(intentRecRef.current)
      const rank = allRecsRef.current.filter(r => score(r) > intentScore).length + 1
      setYourPick(prev => prev ? { ...prev, rank } : prev)
    }
  }, [overlaySort]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleClose = () => {
    try { localStorage.setItem('rabadon-overlay-dismissed', '1') } catch {}
    getTauriWindow()?.hide()
  }

  const handleFocusChamp = useCallback((champion) => {
    try { localStorage.setItem('rabadon-overlay-focus', champion) } catch (_) {}
    if (IS_TAURI) window.__TAURI__.core.invoke('focus_main').catch(() => {})
  }, [])

  const handleViewOverview = useCallback(() => {
    try { localStorage.setItem('rabadon-overlay-nav', 'overview') } catch (_) {}
    if (IS_TAURI) window.__TAURI__.core.invoke('focus_main').catch(() => {})
  }, [])

  const fetchRecs = useCallback(async (role, allies, enemies, patch, tier, pool, intentChamp) => {
    if (!role || role === 'fill') return
    const filteredAllies = (allies || []).filter(a => a.champion)
    const filteredEnemies = (enemies || [])
      .filter(e => e.champion)
      .map(e => ({
        champion: e.champion,
        role: e.role && e.role !== 'fill' ? e.role : (champPrimaryRole(e.champion) || 'fill'),
      }))
    if (filteredAllies.length === 0 && filteredEnemies.length === 0) {
      setRecommendations([])
      setPoolPicks([])
      setYourPick(null)
      return
    }

    const poolForRole = (pool || [])
      .filter(p => p.roles.length === 0 || p.roles.includes(role))
      .map(p => p.champion)

    // Include intent champ in the pool request so the backend scores it.
    const poolForRequest = intentChamp
      ? [...new Set([...poolForRole, intentChamp])]
      : poolForRole

    setLoading(true)
    setError(null)
    try {
      const result = await getRecommendations(role, filteredAllies, filteredEnemies, patch, tier, poolForRequest)
      let blacklisted
      try {
        const bl = JSON.parse(localStorage.getItem('rabadon_champ_blacklist') || '{}')
        blacklisted = new Set((bl[role] || []).map(c => c.toLowerCase()))
      } catch { blacklisted = new Set() }
      const allRecs = (result.recommendations || []).filter(r => !blacklisted.has(r.champion.toLowerCase()))
      const poolFiltered = (result.pool_picks || []).filter(p => poolForRole.includes(p.champion) && !blacklisted.has(p.champion.toLowerCase()))
      // Store full arrays for re-sorting when sort mode changes without re-fetching.
      allRecsRef.current = allRecs
      allPoolRef.current = poolFiltered
      const score = makeDeltaScore(overlaySortRef.current, role)
      setRecommendations([...allRecs].sort((a, b) => score(b) - score(a)).slice(0, 10))
      setPoolPicks([...poolFiltered].sort((a, b) => score(b) - score(a)).slice(0, 10))

      // Pin "your pick" section if there's an intent champion
      if (intentChamp) {
        const intentRec = (result.pool_picks || []).find(
          p => p.champion.toLowerCase() === intentChamp.toLowerCase()
        )
        intentRecRef.current = intentRec || null
        if (intentRec) {
          const intentScore = score(intentRec)
          const rank = allRecs.filter(r => score(r) > intentScore).length + 1
          // field = allRecs + the intent champ itself (which is in pool_picks, not allRecs)
          setYourPick({ ...intentRec, rank, field: allRecs.length + 1 })
        } else {
          setYourPick(null)
        }
      } else {
        intentRecRef.current = null
        setYourPick(null)
      }
    } catch {
      setError('No data')
      setYourPick(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Clear stale results on session boundaries only (start or end), not between
  // phases within a session (e.g. BAN_PICK → FINALIZATION) to avoid a flash.
  useEffect(() => {
    const phase = draft?.phase ?? null
    const prev = prevPhaseRef.current
    const isNewSession = !prev && !!phase
    const isSessionEnd = !!prev && !phase
    if (isNewSession || isSessionEnd) {
      setRecommendations([])
      setPoolPicks([])
      setYourPick(null)
      prevDraftKeyRef.current = null
    }
    if (isSessionEnd) {
      getTauriWindow()?.hide()
    }
    prevPhaseRef.current = phase
  }, [draft?.phase])

  useEffect(() => {
    if (!draft?.role || draft.role === 'fill') return
    const key = JSON.stringify({
      role: draft.role,
      allies: (draft.allies || []).map(a => a.champion).join(','),
      enemies: (draft.enemies || []).map(e => e.champion).join(','),
      intentChamp: draft.intentChamp ?? null,
    })
    if (key === prevDraftKeyRef.current) return
    prevDraftKeyRef.current = key
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(
      () => fetchRecs(draft.role, draft.allies, draft.enemies, draft.patch ?? '16.11', draft.tier ?? TIER, draft.pool, draft.intentChamp ?? null),
      600
    )
  }, [draft, fetchRecs])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const hasSession = !!(draft?.phase && draft?.role && draft.role !== 'fill')
  const role = draft?.role || 'adc'
  const enemies = draft?.enemies || []
  const patch = draft?.patch ?? '16.11'
  const lockedChamp = draft?.lockedChamp ?? null
  const isLocked = !!(lockedChamp && yourPick && yourPick.champion.toLowerCase() === lockedChamp.toLowerCase())

  const statusText = !lcuConnected ? 'Waiting for League client'
    : !hasSession ? 'League client connected'
    : 'Champion select'
  const statusCls = !lcuConnected ? '' : !hasSession ? 'connected' : 'live'

  return (
    <div className="overlay-root">
      <div className="overlay-panel" ref={panelRef}>
        <div className="overlay-head" data-tauri-drag-region>
          <span className="overlay-logo" data-tauri-drag-region />
          <span className="overlay-word" data-tauri-drag-region>RABADON.GG</span>
          <span className="overlay-head-spacer" data-tauri-drag-region />
          <span className="overlay-tier-badge" title={TIER_OPT.label}>
            {TIER_OPT.icon && <img src={TIER_OPT.icon} alt="" className="overlay-tier-icon" onError={e => { e.target.style.display = 'none' }} />}
            <span>{TIER_OPT.label}</span>
          </span>
          <span className="overlay-patch">{patch === '30' ? '30d' : patch}</span>
          <button className="overlay-close" onClick={handleClose} title="Hide overlay">✕</button>
        </div>

        {hasSession && <MatchupStrip role={role} enemies={enemies} />}

        {!hasSession ? (
          <div className="overlay-empty">Waiting for champion select…</div>
        ) : (loading && recommendations.length === 0) ? (
          <div className="overlay-empty">Analyzing draft…</div>
        ) : error ? (
          <div className="overlay-empty">{error}</div>
        ) : recommendations.length === 0 ? (
          <div className="overlay-empty">No recommendations yet</div>
        ) : (
          <>
            <div className="overlay-picks-head">
              <div className="overlay-tabs">
                <button className={`overlay-tab ${tab === 'overall' ? 'overlay-tab--active' : ''}`} onClick={() => setTab('overall')}>Top Picks</button>
                {poolPicks.length > 0 && (
                  <button className={`overlay-tab ${tab === 'pool' ? 'overlay-tab--active' : ''}`} onClick={() => setTab('pool')}>My Pool</button>
                )}
              </div>
              <div className="ov-sort-toggle">
                <button className={`ov-sort-btn${overlaySort === 'wr_delta' ? ' active' : ''}`} onClick={() => setOverlaySort('wr_delta')}>WR+Δ</button>
                <button className={`ov-sort-btn${overlaySort === 'delta' ? ' active' : ''}`} onClick={() => setOverlaySort('delta')}>Δ</button>
              </div>
            </div>
            <div className="overlay-picks">
              {(tab === 'pool' ? poolPicks : recommendations).map((rec, i) => (
                <PickRow key={rec.champion} rec={rec} rank={i + 1} role={role} onFocus={() => handleFocusChamp(rec.champion)} />
              ))}
            </div>
            {yourPick ? (
              <div className={`overlay-yourpick${isLocked ? ' overlay-yourpick--locked' : ''}`}>
                <div className="overlay-yourpick-head">
                  <span className="l">Your pick{isLocked ? ' · LOCKED' : ''}</span>
                  {yourPick.rank === 1
                    ? <span className="cmp best">✓ best available</span>
                    : <span className="cmp">#{yourPick.rank} of {yourPick.field}</span>}
                </div>
                <PickRow rec={yourPick} rank={yourPick.rank} role={role} you locked={isLocked} onFocus={() => handleFocusChamp(yourPick.champion)} />
              </div>
            ) : hasSession && (
              lockedChamp
                ? <div className="overlay-yourpick-empty">Fetching your pick…</div>
                : null
            )}
            <DraftAdvantage advantage={advantage} onViewDetails={handleViewOverview} />
          </>
        )}

        <div className="overlay-foot">
          <span className={`overlay-foot-dot ${statusCls}`} />
          <span>{statusText}</span>
        </div>
      </div>
    </div>
  )
}
