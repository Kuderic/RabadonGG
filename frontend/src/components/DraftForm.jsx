import { useState, useRef, useEffect } from 'react'
import { champIconUrl, filterChampions } from '../utils/champion'
import { TierDisplay } from './TierSelector'

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']

const ROLE_LABEL = {
  top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'ADC', support: 'SUP',
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

function YouRow({ role }) {
  return (
    <div className="champ-row champ-row--you">
      <RolePill role={role} side="ally" />
      <div className="champ-input-wrap">
        <input type="text" value="" placeholder="— your pick —" disabled readOnly className="you-input" />
      </div>
    </div>
  )
}

function ChampionRow({ role, value, onChange, disabled, side, champions, onEnterSubmit, dragging = false, dragHandle = null }) {
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

  const handleInput = (v) => {
    if (dragging) return
    onChange(v)
    if (v.trim().length > 0 && champions.length > 0) {
      const exact = champions.some(c => c.toLowerCase() === v.trim().toLowerCase())
      if (exact) {
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

  const hasChamp = value.trim().length > 0 &&
    champions.some(c => c.toLowerCase() === value.trim().toLowerCase())

  return (
    <div className={`champ-row champ-row--${side}`} ref={wrapRef}>
      {dragHandle}
      <RolePill role={role} side={side} />
      <div className="champ-input-wrap">
        {hasChamp && (
          <img
            className="champ-row-icon"
            src={champIconUrl(value)}
            alt=""
            onError={e => { e.target.style.display = 'none' }}
          />
        )}
        <input
          type="text"
          placeholder={`${role.charAt(0).toUpperCase() + role.slice(1)} champion`}
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

function EnemySection({ enemies, loading, champions, onEnemyChange, onEnemySwap, onEnterSubmit }) {
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

  const startDrag = (e, idx) => {
    if (loading || e.button !== 0 || !enemies[idx].champion) return
    e.preventDefault()
    const handleEl = e.currentTarget
    try { handleEl.setPointerCapture(e.pointerId) } catch (_) {}
    broadcastClose(null)

    const ghost = buildGhost(enemies[idx].champion, ROLE_LABEL[enemies[idx].role] || '')
    document.body.appendChild(ghost)
    ghost.style.left = `${e.clientX + 14}px`
    ghost.style.top = `${e.clientY - 18}px`
    document.body.classList.add('is-dragging')
    setDragSrc(idx)
    drag.current = { srcIdx: idx, ghost }

    const onMove = (me) => {
      if (!drag.current) return
      drag.current.ghost.style.left = `${me.clientX + 14}px`
      drag.current.ghost.style.top = `${me.clientY - 18}px`
      const over = rowFromPoint(me.clientX, me.clientY)
      setDragOver(over >= 0 ? over : null)
    }

    const onUp = (ue) => {
      handleEl.removeEventListener('pointermove', onMove)
      handleEl.removeEventListener('pointerup', onUp)
      handleEl.removeEventListener('pointercancel', onUp)
      const cur = drag.current
      if (cur?.ghost) cur.ghost.remove()
      const dropIdx = rowFromPoint(ue.clientX, ue.clientY)
      if (cur && dropIdx >= 0 && dropIdx !== cur.srcIdx) onEnemySwap(cur.srcIdx, dropIdx)
      document.body.classList.remove('is-dragging')
      setDragSrc(null)
      setDragOver(null)
      drag.current = null
    }

    handleEl.addEventListener('pointermove', onMove)
    handleEl.addEventListener('pointerup', onUp)
    handleEl.addEventListener('pointercancel', onUp)
  }

  const handleKey = (e, idx) => {
    if (!enemies[idx].champion) return
    if (e.key === 'ArrowUp' && idx > 0) { e.preventDefault(); onEnemySwap(idx, idx - 1) }
    else if (e.key === 'ArrowDown' && idx < enemies.length - 1) { e.preventDefault(); onEnemySwap(idx, idx + 1) }
  }

  const isDragging = dragSrc !== null

  return (
    <div className="draft-team">
      <div className="draft-team-title enemy-title">Enemy Team</div>
      {enemies.map((enemy, i) => (
        <div
          key={`enemy-${enemy.role}`}
          ref={el => { rowRefs.current[i] = el }}
          className={`enemy-drag-wrap${enemy.champion ? ' has-champ' : ''}${dragSrc === i ? ' drag-source' : ''}${dragOver === i && dragSrc !== i ? ' drag-over' : ''}`}
        >
          <ChampionRow
            role={enemy.role}
            value={enemy.champion}
            onChange={val => onEnemyChange(i, val)}
            disabled={loading}
            side="enemy"
            champions={champions}
            onEnterSubmit={onEnterSubmit}
            dragging={isDragging}
            dragHandle={
              <button
                type="button"
                className="enemy-drag-handle"
                onPointerDown={e => startDrag(e, i)}
                onKeyDown={e => handleKey(e, i)}
                tabIndex={enemy.champion ? 0 : -1}
                aria-label={enemy.champion ? `Drag ${enemy.champion} to another enemy slot to swap, or use arrow keys` : undefined}
                title="Drag to swap roles"
              >
                {dragOver === i && dragSrc !== null && dragSrc !== i ? <SwapIcon /> : <GripIcon />}
              </button>
            }
          />
        </div>
      ))}
      <div className="enemy-drag-hint"><GripIcon /> Drag a grip to swap two enemies' roles</div>
    </div>
  )
}

const ROLE_DISPLAY = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Support' }

export default function DraftForm({
  role, allies, enemies, champions,
  onRoleChange, onAllyChange, onEnemyChange, onEnemySwap,
  onSubmit, loading, error,
  patch, tier,
  onShare, shareCopied,
  lcuConnected = false,
  lcuSession = null,
}) {
  const patchLabel = patch === '30' ? '30 Days' : `Patch ${patch}`

  return (
    <div className="draft-section">
      <div className="draft-header">
        <div className="draft-role-selector">
          <label htmlFor="role-select" className="draft-role-label">Your Role</label>
          <select id="role-select" value={role} onChange={e => onRoleChange(e.target.value)} disabled={loading}>
            {ROLES.map(r => (
              <option key={r} value={r}>{ROLE_DISPLAY[r]}</option>
            ))}
          </select>
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
        </div>
      </div>

      <div className="draft-teams">
        <div className="draft-team">
          <div className="draft-team-title ally-title">Allied Team</div>
          {ROLES.map(r => {
            if (r === role) return <YouRow key={r} role={r} />
            const ally = allies.find(a => a.role === r)
            const idx = allies.findIndex(a => a.role === r)
            if (!ally) return null
            return (
              <ChampionRow
                key={r}
                role={r}
                value={ally.champion}
                onChange={val => onAllyChange(idx, val)}
                disabled={loading}
                side="ally"
                champions={champions}
                onEnterSubmit={!loading ? onSubmit : undefined}
              />
            )
          })}
        </div>

        <div className="draft-team-divider" />

        <EnemySection
          enemies={enemies}
          loading={loading}
          champions={champions}
          onEnemyChange={onEnemyChange}
          onEnemySwap={onEnemySwap}
          onEnterSubmit={!loading ? onSubmit : undefined}
        />
      </div>

      {loading && (
        <div className="draft-analyzing">
          <span className="spinner" />
          Analyzing draft...
        </div>
      )}
    </div>
  )
}
