import { useState, useEffect, useMemo } from 'react'
import { computeComponents } from '../utils/scoring'
import { champIconUrl } from '../utils/champion'
import BreakdownPanel from './BreakdownPanel'
import { TierDisplay } from './TierSelector'

const ROLE_ICON = {
  top:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png',
  jungle:  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png',
  mid:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png',
  adc:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png',
  support: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png',
}

const ROLE_SHORT = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'BOT', support: 'SUP' }
const ROLE_DISPLAY = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'Bot', support: 'Support' }

const OV_ADV_MAX = 12
const OV_DELTA_MAX = 6

const imgErr = e => { e.target.style.visibility = 'hidden' }
const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

// ── role pill ──────────────────────────────────────────────────────────────
function OvRole({ role, open }) {
  return (
    <div className={`ov-role${open ? ' ov-role--open' : ''}`}>
      <img src={ROLE_ICON[role]} alt="" onError={imgErr} />
      <span>{ROLE_SHORT[role] || role.toUpperCase()}</span>
    </div>
  )
}

// ── delta bar/chip/color — hardcoded bars encoding ─────────────────────────
function OvDelta({ value }) {
  const pos = value >= 0
  const cls = pos ? 'positive' : 'negative'
  const mag = Math.min(Math.abs(value) / OV_DELTA_MAX, 1) * 50
  const left = pos ? 50 : 50 - mag
  return (
    <div className="ov-delta ov-delta--bar">
      <span className={`ov-delta-num ${cls}`}>{fmt(value)}</span>
      <div className="ov-delta-bar-track">
        <div className="ov-delta-bar-mid" />
        <div className={`ov-delta-bar-fill ${cls}`} style={{ left: `${left}%`, width: `${mag}%` }} />
      </div>
    </div>
  )
}

// ── locked slot ────────────────────────────────────────────────────────────
function OvLockedSlot({ slot, side, isYou, config, onOpen }) {
  const { rec, role, champion } = slot
  const c = computeComponents(rec, config, role)
  const lowN = [...(rec.synergy_breakdown || []), ...(rec.counter_breakdown || [])]
    .some(b => b.n > 0 && b.n < (config?.penalizeThreshold || 1000))
  return (
    <div className={`ov-slot is-locked ov-slot--${side}${isYou ? ' ov-slot--you' : ''}`}>
      <div
        className="ov-locked"
        onClick={() => onOpen({ rec, role, side, kind: 'locked' })}
        role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') onOpen({ rec, role, side, kind: 'locked' }) }}
      >
        <OvRole role={role} />
        <img className="ov-champ-icon" src={champIconUrl(champion)} alt={champion} onError={imgErr} />
        <div className="ov-champ-main">
          <div className="ov-champ-name">{champion}</div>
          <div className="ov-champ-meta">
            {isYou && <span className="you-tag">YOU</span>}
            <span className="syn">SYN {fmt(c.synContrib)}</span>
            <span className="sep">·</span>
            <span className="ctr">CTR {fmt(c.ctrContrib)}</span>
            {lowN && <span className="lown" title="Some matchups have low sample size">⚠</span>}
          </div>
        </div>
        <OvDelta value={c.totalDelta} />
      </div>
    </div>
  )
}

// ── inline pick card ───────────────────────────────────────────────────────
function OvPickCard({ rec, role, side, rank, total, best, onOpen }) {
  return (
    <div
      className={`ov-pick-card${best ? ' is-best' : ''}`}
      role="button" tabIndex={0}
      onClick={() => onOpen({ rec, role, side, kind: 'pick', rank })}
      onKeyDown={e => { if (e.key === 'Enter') onOpen({ rec, role, side, kind: 'pick', rank }) }}
    >
      <img className="ov-pc-icon" src={champIconUrl(rec.champion)} alt={rec.champion} onError={imgErr} />
      <div className="ov-pc-body">
        <span className="ov-pc-name">
          <span className="ov-pc-rank">{rank}</span>{rec.champion}
        </span>
        <OvDelta value={total} />
      </div>
    </div>
  )
}

// ── open slot — top-3 picks inline ─────────────────────────────────────────
function OvOpenSlot({ slot, side, isYou, config, sortMode, computeDraftRecs, onOpen }) {
  const { role, candidates } = slot
  const ranked = useMemo(() => (candidates || []).map(rec => {
    const c = computeComponents(rec, config, role)
    const rating = sortMode === 'delta' ? c.totalDelta : rec.win_rate + c.totalDelta
    return { rec, total: c.totalDelta, rating }
  }).sort((a, b) => b.rating - a.rating).slice(0, 3), [candidates, config, role, sortMode])

  return (
    <div className={`ov-slot is-open ov-slot--${side}${isYou ? ' ov-slot--you' : ''}`}>
      <div className="ov-open">
        <OvRole role={role} open />
        {ranked.length > 0 ? (
          <div className="ov-open-picks">
            {ranked.map(({ rec, total }, i) => (
              <OvPickCard key={rec.champion} rec={rec} role={role} side={side}
                rank={i + 1} total={total} best={i === 0} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="ov-open-empty">
            {computeDraftRecs ? 'No candidates — all picks taken.' : '—'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── team column ────────────────────────────────────────────────────────────
function OvColumn({ side, slots, youRole, config, sortMode, computeDraftRecs, onOpen }) {
  const lockedCount = slots.filter(s => s.locked).length
  const teamName = side === 'ally' ? 'Allied Team' : 'Enemy Team'
  return (
    <div className={`ov-col ov-col--${side}`}>
      <div className={`ov-col-head ov-col-head--${side}`}>
        <span className="ov-col-title"><span className="dot" /> {teamName}</span>
        <span className="ov-col-count">{lockedCount}/5 locked</span>
      </div>
      <div className="ov-slots">
        {slots.map(slot => {
          const isYou = side === 'ally' && slot.role === youRole
          return slot.locked
            ? <OvLockedSlot key={slot.role} slot={slot} side={side} isYou={isYou}
                            config={config} onOpen={onOpen} />
            : <OvOpenSlot key={slot.role} slot={slot} side={side} isYou={isYou}
                          config={config} sortMode={sortMode}
                          computeDraftRecs={computeDraftRecs} onOpen={onOpen} />
        })}
      </div>
    </div>
  )
}

// ── scoreline ──────────────────────────────────────────────────────────────
function OvScoreline({ allyDelta, enemyDelta, allyLocked, enemyLocked }) {
  const advantage = allyDelta - enemyDelta
  const lead = Math.abs(advantage) < 0.05 ? 'even' : (advantage > 0 ? 'ally' : 'enemy')
  const mag = Math.min(Math.abs(advantage) / OV_ADV_MAX, 1) * 50
  // ally leads → fill left of center (toward the ally column)
  // enemy leads → fill right of center (toward the enemy column)
  const fillLeft = advantage >= 0 ? 50 - mag : 50
  const fillSide = advantage >= 0 ? 'ally' : 'enemy'
  const whoLabel = lead === 'even' ? 'Even' : (lead === 'ally' ? 'Allied' : 'Enemy')
  return (
    <div className="ov-scoreline">
      <div className="ov-score-team ov-score-team--ally">
        <span className="ov-score-team-label"><span className="dot" /> Allied</span>
        <span className="ov-score-num">{fmt(allyDelta)}</span>
        <span className="ov-score-locked">{allyLocked} locked · summed Δ</span>
      </div>
      <div className="ov-adv">
        <span className="ov-adv-caption">Draft Advantage</span>
        <div className={`ov-adv-readout lead-${lead}`}>
          <span className="v">{lead === 'even' ? '—' : fmt(Math.abs(advantage))}</span>
          <span className="who">{whoLabel}</span>
        </div>
        <div className="ov-adv-track">
          <div className="ov-adv-center" />
          {lead !== 'even' && (
            <div
              className={`ov-adv-fill ov-adv-fill--${fillSide}`}
              style={{ left: `${fillLeft}%`, width: `${mag}%` }}
            />
          )}
        </div>
      </div>
      <div className="ov-score-team ov-score-team--enemy">
        <span className="ov-score-team-label">Enemy <span className="dot" /></span>
        <span className="ov-score-num">{fmt(enemyDelta)}</span>
        <span className="ov-score-locked">{enemyLocked} locked · summed Δ</span>
      </div>
    </div>
  )
}

// ── breakdown modal — wraps existing BreakdownPanel ───────────────────────
function OvBreakdownModal({ payload, config, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!payload) return null
  const { rec, role, side, kind, rank } = payload
  const sideTag = side === 'ally' ? 'Allied team' : 'Enemy team'
  const kindTag = kind === 'locked' ? 'Locked pick' : `Recommended #${rank}`
  return (
    <div className="ov-modal-backdrop" onClick={onClose}>
      <div className="ov-modal" onClick={e => e.stopPropagation()}>
        <div className="ov-modal-context">
          <span className={`tag tag--${side}`}>{sideTag}</span>
          <span className={`tag tag--${kind === 'pick' ? 'pick' : side}`}>{kindTag}</span>
          <span>· {ROLE_DISPLAY[role] || role}</span>
        </div>
        <BreakdownPanel
          rec={rec}
          rank={kind === 'pick' ? rank : '★'}
          onClose={onClose}
          settings={config}
          playerRole={role}
        />
      </div>
    </div>
  )
}

// ── loading placeholder row ────────────────────────────────────────────────
function OvLoadingSlot({ role, side }) {
  return (
    <div className={`ov-slot ov-slot--${side}`}>
      <div className="ov-locked" style={{ opacity: 0.35 }}>
        <OvRole role={role} />
        <div style={{ flex: 1, padding: '10px 14px', color: 'var(--ink-4)', fontFamily: 'var(--font-stat)', fontSize: '11px', letterSpacing: '1px' }}>
          Loading…
        </div>
      </div>
    </div>
  )
}

// ── main view ──────────────────────────────────────────────────────────────
export default function DraftOverview({ overviewData, loading, youRole, config, patch, tier, computeDraftRecs, onComputeDraftRecsChange, sortMode = 'delta' }) {
  const [breakdown, setBreakdown] = useState(null)

  const handleOpenBreakdown = (payload) => setBreakdown(payload)
  const handleCloseBreakdown = () => setBreakdown(null)

  const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']

  const allyDelta = overviewData
    ? overviewData.ally.filter(s => s.locked && s.rec).reduce(
        (sum, s) => sum + computeComponents(s.rec, config, s.role).totalDelta, 0)
    : 0
  const enemyDelta = overviewData
    ? overviewData.enemy.filter(s => s.locked && s.rec).reduce(
        (sum, s) => sum + computeComponents(s.rec, config, s.role).totalDelta, 0)
    : 0
  const allyLocked = overviewData ? overviewData.ally.filter(s => s.locked).length : 0
  const enemyLocked = overviewData ? overviewData.enemy.filter(s => s.locked).length : 0
  const totalLocked = allyLocked + enemyLocked

  const patchLabel = patch === '30' ? '30 Days' : `Patch ${patch}`

  const isEmpty = !loading && !overviewData

  return (
    <div className="results-section ov-section">
      <div className="ov-head">
        <span className="ov-head-title">Draft Overview</span>
        <span className="ov-head-sub">· champion-select board</span>
        <div className="ov-head-right">
          <div className="ov-pop">
            <span className="pop-patch">{patchLabel}</span>
            <span className="pop-sep">·</span>
            <TierDisplay tier={tier} />
          </div>
        </div>
      </div>

      <div className="ov-compute-bar">
        <label className="ov-compute-label">
          <input
            type="checkbox"
            checked={!!computeDraftRecs}
            onChange={e => onComputeDraftRecsChange?.(e.target.checked)}
          />
          Open slot picks
        </label>
        <span className="ov-compute-hint">⏱ may take up to 20s</span>
      </div>

      {isEmpty && (
        <div className="ov-emptystate">
          <h3>Waiting for champion select</h3>
          <p>Enter champions in the Recommend tab or start champion select. As picks fill in, each champion's contribution appears here and the team deltas update automatically. Recommended picks fill every open slot.</p>
        </div>
      )}

      {loading && !overviewData && (
        <div className="ov-board" data-density="comfortable">
          <div className={`ov-col ov-col--ally`}>
            <div className="ov-col-head ov-col-head--ally">
              <span className="ov-col-title"><span className="dot" /> Allied Team</span>
              <span className="ov-col-count">— loading</span>
            </div>
            <div className="ov-slots">
              {ROLES.map(r => <OvLoadingSlot key={r} role={r} side="ally" />)}
            </div>
          </div>
          <div className="ov-board-divider" />
          <div className={`ov-col ov-col--enemy`}>
            <div className="ov-col-head ov-col-head--enemy">
              <span className="ov-col-title"><span className="dot" /> Enemy Team</span>
              <span className="ov-col-count">— loading</span>
            </div>
            <div className="ov-slots">
              {ROLES.map(r => <OvLoadingSlot key={r} role={r} side="enemy" />)}
            </div>
          </div>
        </div>
      )}

      {overviewData && (
        <>
          {totalLocked > 0 && (
            <OvScoreline
              allyDelta={allyDelta}
              enemyDelta={enemyDelta}
              allyLocked={allyLocked}
              enemyLocked={enemyLocked}
            />
          )}
          <div className="ov-board" data-density="comfortable">
            <OvColumn
              side="ally"
              slots={overviewData.ally}
              youRole={youRole}
              config={config}
              sortMode={sortMode}
              computeDraftRecs={computeDraftRecs}
              onOpen={handleOpenBreakdown}
            />
            <div className="ov-board-divider" />
            <OvColumn
              side="enemy"
              slots={overviewData.enemy}
              youRole={youRole}
              config={config}
              sortMode={sortMode}
              computeDraftRecs={computeDraftRecs}
              onOpen={handleOpenBreakdown}
            />
          </div>
        </>
      )}

      {breakdown && (
        <OvBreakdownModal payload={breakdown} config={config} onClose={handleCloseBreakdown} />
      )}
    </div>
  )
}
