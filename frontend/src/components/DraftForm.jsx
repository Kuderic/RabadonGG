import { useState, useRef, useEffect } from 'react'
import { champIconUrl, filterChampions } from '../utils/champion'
import { TierDisplay } from './TierSelector'
import { computeComponents } from '../utils/scoring'

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']

const ROLE_LABEL = {
  top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'BOT', support: 'SUP',
}

const ROLE_ICON = {
  top:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png',
  jungle:  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png',
  mid:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png',
  adc:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png',
  support: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png',
}

const broadcastClose = (exceptId) =>
  document.dispatchEvent(new CustomEvent('closeDropdowns', { detail: exceptId }))

function RolePill({ role, side }) {
  return (
    <span className={`role-pill role-pill--${side}`}>
      <img
        src={ROLE_ICON[role]}
        alt=""
        className="role-pill-icon"
        onError={e => { e.target.style.display = 'none' }}
      />
      {ROLE_LABEL[role] || role.toUpperCase()}
    </span>
  )
}

// Rating chip: this champion's WR + draft Δ in *this* draft, from the same
// board payload the Draft Overview uses, so the two views can't disagree.
// The bar is scaled 40–60% — the band real win rates actually live in.
function RatingChip({ slot, config }) {
  if (!slot?.rec) return null
  const { totalDelta } = computeComponents(slot.rec, config, slot.role)
  const rating = slot.rec.win_rate + totalDelta
  const pct = Math.max(0, Math.min(1, (rating - 40) / 20)) * 100
  const tone = rating >= 52 ? 'hi' : rating <= 48 ? 'lo' : 'mid'
  return (
    <span
      className={`rating-chip rating-chip--${tone}`}
      title={`Win rate ${slot.rec.win_rate.toFixed(1)}% ${totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(1)} draft Δ`}
    >
      <span className="rating-chip-num">{rating.toFixed(1)}</span>
      <span className="rating-chip-bar">
        <span className="rating-chip-fill" style={{ width: `${pct}%` }} />
        <span className="rating-chip-mid" />
      </span>
    </span>
  )
}

// The live #1 recommendation, shown in the YOU row while you haven't entered a
// pick of your own. Clicking it opens that champion's breakdown in the list.
function TopPickTag({ topPick, onOpen }) {
  return (
    <button
      type="button"
      className="you-pick-tag"
      onClick={e => { e.stopPropagation(); onOpen?.() }}
      title={`${topPick.champion} is the current #1 recommendation for your role — open its breakdown`}
    >
      <img src={champIconUrl(topPick.champion)} alt="" onError={e => { e.target.style.visibility = 'hidden' }} />
      <span className="you-pick-name">{topPick.champion}</span>
      <span className="you-pick-cap">Top pick</span>
      <b>{topPick.rating.toFixed(1)}%</b>
    </button>
  )
}

function ChampionRow({ role, value, onChange, disabled, side, champions, onEnterSubmit, dragging = false, dragHandle = null, isYou = false, slot = null, config, topPick = null, onOpenTopPick }) {
  const [open, setOpen] = useState(false)
  const [filtered, setFiltered] = useState([])
  const [cursor, setCursor] = useState(0)
  const wrapRef = useRef(null)
  const id = useRef(Math.random())

  useEffect(() => {
    if (dragging) setOpen(false)
  }, [dragging])

  useEffect(() => {
    const closeHandler = e => { if (e.detail !== id.current) setOpen(false) }
    const outsideHandler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('closeDropdowns', closeHandler)
    document.addEventListener('mousedown', outsideHandler)
    return () => {
      document.removeEventListener('closeDropdowns', closeHandler)
      document.removeEventListener('mousedown', outsideHandler)
    }
  }, [])

  const matchedChamp = value.trim().length > 0
    ? champions.find(c => c.toLowerCase() === value.trim().toLowerCase()) ?? null
    : null
  const hasChamp = matchedChamp !== null

  const handleInput = (v) => {
    if (dragging) return
    onChange(v)
    if (v.trim().length > 0 && champions.length > 0) {
      const exactMatch = champions.find(c => c.toLowerCase() === v.trim().toLowerCase())
      if (exactMatch) {
        if (exactMatch !== v) onChange(exactMatch)
        setOpen(false)
        setFiltered([])
        return
      }
      const matches = filterChampions(champions, v)
      if (matches.length > 0) {
        broadcastClose(id.current)
        setOpen(true)
        setFiltered(matches)
        setCursor(0)
      } else {
        setOpen(false)
        setFiltered([])
      }
    } else {
      setOpen(false)
    }
  }

  const select = (name) => {
    onChange(name)
    setOpen(false)
    setCursor(0)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && hasChamp) {
      e.preventDefault()
      onChange('')
      return
    }
    if (e.key === 'Enter') {
      if (open && filtered.length > 0) {
        e.preventDefault()
        select(filtered[Math.max(0, cursor)])
      } else if (!open && onEnterSubmit) {
        e.preventDefault()
        onEnterSubmit()
      }
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={`champ-row champ-row--${side}${isYou ? ' champ-row--you' : ''}`} ref={wrapRef}>
      {dragHandle}
      <RolePill role={role} side={side} />
      <div className="champ-input-wrap">
        {hasChamp && (
          <img
            className="champ-row-icon"
            src={champIconUrl(matchedChamp)}
            alt=""
            onError={e => { e.target.style.display = 'none' }}
          />
        )}
        <input
          type="text"
          placeholder={isYou ? '— your pick —' : `${role.charAt(0).toUpperCase() + role.slice(1)} champion`}
          title={isYou ? 'The champion you\'re considering — scored against this draft' : undefined}
          value={value}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (dragging) return
            if (value.trim().length > 0 && filtered.length > 0) {
              broadcastClose(id.current)
              setOpen(true)
            }
          }}
          disabled={disabled}
          autoComplete="off"
        />
        {!open && (hasChamp
          ? <RatingChip slot={slot} config={config} />
          : isYou && topPick && <TopPickTag topPick={topPick} onOpen={onOpenTopPick} />)}
        {open && (
          <div className="champ-autocomplete">
            {filtered.map((name, i) => (
              <div
                key={name}
                className={`champ-ac-item ${i === cursor ? 'champ-ac-item--active' : ''}`}
                onMouseDown={() => select(name)}
                onMouseEnter={() => setCursor(i)}
              >
                <img
                  src={champIconUrl(name)}
                  alt=""
                  className="champ-ac-icon"
                  onError={e => { e.target.style.display = 'none' }}
                />
                <span>{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GripIcon() {
  return (
    <svg viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="3" r="1.3" /><circle cx="9" cy="3" r="1.3" />
      <circle cx="3" cy="8" r="1.3" /><circle cx="9" cy="8" r="1.3" />
      <circle cx="3" cy="13" r="1.3" /><circle cx="9" cy="13" r="1.3" />
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h7M8 2.5 10.5 5 8 7.5M11 9H4M6 6.5 3.5 9 6 11.5" />
    </svg>
  )
}

function buildGhost(champion, _roleLabel) {
  const ghost = document.createElement('div')
  ghost.style.cssText = [
    'position:fixed', 'pointer-events:none', 'z-index:9999',
    'display:flex', 'align-items:center', 'gap:10px',
    'background:#161b29', 'border:1px solid #c89b3c', 'border-radius:3px',
    'padding:8px 14px', 'white-space:nowrap', 'box-shadow:0 10px 30px rgba(0,0,0,0.55)',
    'font-family:Barlow Semi Condensed,sans-serif',
  ].join(';')
  if (champion) {
    const img = document.createElement('img')
    img.src = champIconUrl(champion)
    img.style.cssText = 'width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0'
    ghost.appendChild(img)
    const span = document.createElement('span')
    span.textContent = champion
    span.style.cssText = 'font-size:14px;font-weight:500;color:#f4f1e8'
    ghost.appendChild(span)
  }
  return ghost
}

// One team column — allied or enemy. Both sides get drag grips (handoff v2
// §1.3); rows carry `idx`, the index into the owning array, because the ally
// column interleaves the undraggable YOU row that isn't in `allies` at all.
function TeamSection({ side, title, rows, loading, champions, onChange, onSwap, onEnterSubmit, board, config, topPick, onOpenTopPick }) {
  const [dragSrc, setDragSrc] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const rowRefs = useRef([])
  const drag = useRef(null)

  useEffect(() => () => {
    if (drag.current?.ghost) drag.current.ghost.remove()
    document.body.classList.remove('is-dragging')
  }, [])

  const rowFromPoint = (x, y) => {
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) return i
    }
    return -1
  }

  const startDrag = (e, i) => {
    if (loading || e.button !== 0 || !rows[i].champion || rows[i].isYou) return
    e.preventDefault()
    const handleEl = e.currentTarget
    try { handleEl.setPointerCapture(e.pointerId) } catch (_) {}
    broadcastClose(null)

    const ghost = buildGhost(rows[i].champion, ROLE_LABEL[rows[i].role] || '')
    document.body.appendChild(ghost)
    ghost.style.left = `${e.clientX + 14}px`
    ghost.style.top = `${e.clientY - 18}px`
    document.body.classList.add('is-dragging')
    setDragSrc(i)
    drag.current = { srcIdx: i, ghost }

    const onMove = (me) => {
      if (!drag.current) return
      drag.current.ghost.style.left = `${me.clientX + 14}px`
      drag.current.ghost.style.top = `${me.clientY - 18}px`
      const over = rowFromPoint(me.clientX, me.clientY)
      setDragOver(over >= 0 && !rows[over].isYou ? over : null)
    }

    const onUp = (ue) => {
      handleEl.removeEventListener('pointermove', onMove)
      handleEl.removeEventListener('pointerup', onUp)
      handleEl.removeEventListener('pointercancel', onUp)
      const cur = drag.current
      if (cur?.ghost) cur.ghost.remove()
      const dropIdx = rowFromPoint(ue.clientX, ue.clientY)
      if (cur && dropIdx >= 0 && dropIdx !== cur.srcIdx && !rows[dropIdx].isYou) {
        onSwap(rows[cur.srcIdx].idx, rows[dropIdx].idx)
      }
      document.body.classList.remove('is-dragging')
      setDragSrc(null)
      setDragOver(null)
      drag.current = null
    }

    handleEl.addEventListener('pointermove', onMove)
    handleEl.addEventListener('pointerup', onUp)
    handleEl.addEventListener('pointercancel', onUp)
  }

  const handleKey = (e, i) => {
    if (!rows[i].champion || rows[i].isYou) return
    const j = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1
    if (j >= 0 && j < rows.length && !rows[j].isYou) {
      e.preventDefault()
      onSwap(rows[i].idx, rows[j].idx)
    }
  }

  const isDragging = dragSrc !== null

  return (
    <div className="draft-team">
      <div className={`draft-team-title ${side}-title`}>{title}</div>
      {rows.map((row, i) => {
        const slot = board?.[side]?.find(s => s.role === row.role && s.locked) ?? null
        return (
          <div
            key={`${side}-${row.role}`}
            ref={el => { rowRefs.current[i] = el }}
            className={`team-drag-wrap${row.champion ? ' has-champ' : ''}${row.isYou ? ' is-you' : ''}${dragSrc === i ? ' drag-source' : ''}${dragOver === i && dragSrc !== i ? ' drag-over' : ''}`}
          >
            <ChampionRow
              role={row.role}
              value={row.champion}
              onChange={val => onChange(row.idx, val)}
              disabled={loading}
              side={side}
              isYou={row.isYou}
              champions={champions}
              onEnterSubmit={onEnterSubmit}
              dragging={isDragging}
              slot={slot}
              config={config}
              topPick={row.isYou ? topPick : null}
              onOpenTopPick={onOpenTopPick}
              dragHandle={row.isYou ? <span className="team-drag-spacer" /> : (
                <button
                  type="button"
                  className="team-drag-handle"
                  onPointerDown={e => startDrag(e, i)}
                  onKeyDown={e => handleKey(e, i)}
                  tabIndex={row.champion ? 0 : -1}
                  aria-label={row.champion ? `Drag ${row.champion} to another slot to swap roles, or use arrow keys` : undefined}
                  title="Drag to swap roles"
                >
                  {dragOver === i && dragSrc !== null && dragSrc !== i ? <SwapIcon /> : <GripIcon />}
                </button>
              )}
            />
          </div>
        )
      })}
    </div>
  )
}

// Draft Advantage (handoff v2 §1.5). Teams are compared on the MEAN (WR + Δ)
// per locked champion — summing would hand the lead to whichever team simply
// has more champions locked. Same math as the Draft Overview scoreline.
const DV_MAX = 6  // meter saturates at ±6 points of mean rating

function DraftVerdict({ adv, onOpenOverview }) {
  if (!adv) return null
  const both = adv.nA > 0 && adv.nE > 0
  const allyMean = adv.nA ? adv.ally / adv.nA : 0
  const enemyMean = adv.nE ? adv.enemy / adv.nE : 0
  const net = both ? allyMean - enemyMean : 0
  const lead = Math.abs(net) < 0.3 ? 'even' : net > 0 ? 'ally' : 'enemy'
  const mag = Math.min(Math.abs(net) / DV_MAX, 1) * 50
  const who = lead === 'even' ? 'Even draft' : lead === 'ally' ? 'Allied edge' : 'Enemy edge'

  return (
    <div className="draft-verdict" aria-label={`Draft advantage: ${who}${lead === 'even' ? '' : ` +${Math.abs(net).toFixed(1)}`}`}>
      <div className="dv-side dv-side--ally">
        <span className="dv-side-lbl">Ally · {adv.nA} locked</span>
        <span className="dv-side-val">{adv.nA ? allyMean.toFixed(1) : '—'}</span>
        <span className="dv-side-sub">Σ {adv.ally.toFixed(1)}</span>
      </div>
      <div className="dv-mid">
        <div className="dv-readout">
          <span className="dv-cap">Draft Advantage</span>
          <span className={`dv-lead dv-lead--${lead}`}>{lead === 'even' ? '—' : `+${Math.abs(net).toFixed(1)}`}</span>
          <span className="dv-who">{who}</span>
        </div>
        <div className="dv-track">
          <div className="dv-track-center" />
          {lead !== 'even' && (
            <div
              className={`dv-fill dv-fill--${lead}`}
              style={{ left: `${lead === 'ally' ? 50 - mag : 50}%`, width: `${mag}%` }}
            />
          )}
        </div>
        <div className="dv-note">
          {both ? 'Average WR + Δ per locked champion, each scored against the current draft' : 'Needs a locked champion on both teams'}
          {onOpenOverview && <> · <button type="button" className="dv-link" onClick={onOpenOverview}>Draft Overview ›</button></>}
        </div>
      </div>
      <div className="dv-side dv-side--enemy">
        <span className="dv-side-lbl">Enemy · {adv.nE} locked</span>
        <span className="dv-side-val">{adv.nE ? enemyMean.toFixed(1) : '—'}</span>
        <span className="dv-side-sub">Σ {adv.enemy.toFixed(1)}</span>
      </div>
    </div>
  )
}

const ROLE_DISPLAY = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'Bot', support: 'Support' }

export default function DraftForm({
  role, allies, enemies, champions,
  onRoleChange, onAllyChange, onAllySwap, onEnemyChange, onEnemySwap,
  onSubmit, loading, error,
  patch, tier,
  onShare, shareCopied,
  onClear,
  lcuConnected = false,
  lcuSession = null,
  myPick = '',
  onMyPickChange,
  board = null,
  config,
  advantage = null,
  topPick = null,
  onOpenTopPick,
  onOpenOverview,
}) {
  const patchLabel = patch === '30' ? '30 Days' : `Patch ${patch}`

  // The player's own slot isn't in `allies`; it sits in the column at its role's
  // position and carries `myPick` instead.
  const allyRows = ROLES.map(r => {
    if (r === role) return { role: r, champion: myPick, idx: -1, isYou: true }
    return { role: r, champion: allies.find(a => a.role === r)?.champion || '', idx: allies.findIndex(a => a.role === r) }
  }).filter(row => row.isYou || row.idx !== -1)
  const enemyRows = enemies.map((e, idx) => ({ ...e, idx }))

  return (
    <div className="draft-section">
      <div className="draft-header">
        <div className="draft-role-selector">
          <span className="draft-role-label" id="draft-role-label">Your Role</span>
          <div className="rec-role-switch draft-role-switch" role="radiogroup" aria-labelledby="draft-role-label">
            {ROLES.map(r => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                disabled={loading}
                className={`rec-role-btn ${role === r ? 'rec-role-btn--active' : ''}`}
                onClick={() => onRoleChange(r)}
                title={ROLE_DISPLAY[r]}
              >
                <img
                  src={ROLE_ICON[r]}
                  alt=""
                  className="rec-role-btn-icon"
                  onError={e => { e.target.style.visibility = 'hidden' }}
                />
                <span className="rec-role-btn-label">{ROLE_LABEL[r]}</span>
              </button>
            ))}
          </div>
          {lcuConnected && lcuSession && <span className="lcu-live-badge">&#x25cf; Live</span>}
          {lcuConnected && !lcuSession && <span className="lcu-waiting-badge">&#x25cb; Waiting for champion select</span>}
        </div>

        {error && <span className="draft-error">{error}</span>}

        <div className="draft-header-right">
          <div className="draft-population-display">
            <span className="pop-patch">{patchLabel}</span>
            <span className="pop-sep"> · </span>
            <TierDisplay tier={tier} />
          </div>
          {onShare && (
            <button
              className={`share-btn${shareCopied ? ' share-btn--copied' : ''}`}
              onClick={onShare}
              title="Copy link to this draft"
            >
              {shareCopied ? '✓ Copied' : '⎘ Share'}
            </button>
          )}
          {onClear && (
            <button className="clear-btn" onClick={onClear} title="Clear all champion inputs" disabled={loading}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      <div className="draft-teams">
        <TeamSection
          side="ally"
          title="Allied Team"
          rows={allyRows}
          loading={loading}
          champions={champions}
          onChange={(idx, val) => idx === -1 ? onMyPickChange?.(val) : onAllyChange(idx, val)}
          onSwap={onAllySwap}
          onEnterSubmit={!loading ? onSubmit : undefined}
          board={board}
          config={config}
          topPick={topPick}
          onOpenTopPick={onOpenTopPick}
        />

        <div className="draft-team-divider" />

        <TeamSection
          side="enemy"
          title="Enemy Team"
          rows={enemyRows}
          loading={loading}
          champions={champions}
          onChange={onEnemyChange}
          onSwap={onEnemySwap}
          onEnterSubmit={!loading ? onSubmit : undefined}
          board={board}
          config={config}
        />
      </div>

      <div className="draft-drag-hint"><GripIcon /> Drag a grip to swap two champions' roles</div>

      <DraftVerdict adv={advantage} onOpenOverview={onOpenOverview} />

      {loading && (
        <div className="draft-analyzing">
          <span className="spinner" />
          Analyzing draft...
        </div>
      )}
    </div>
  )
}
