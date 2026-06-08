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

function ChampionRow({ role, value, onChange, disabled, side, champions, onEnterSubmit, dragging = false }) {
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

function EnemySection({ enemies, loading, champions, onEnemyChange, onEnemySwap, onEnterSubmit }) {
  const [dragSrc, setDragSrc] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const handleDragStart = (e, idx) => {
    setDragSrc(idx)
    document.body.classList.add('is-dragging')
    broadcastClose(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))

    // Ghost image: champion icon + name only, no role pill
    const champion = enemies[idx].champion
    const ghost = document.createElement('div')
    ghost.style.cssText = [
      'position:fixed', 'top:-400px', 'left:-400px',
      'display:flex', 'align-items:center', 'gap:10px',
      'background:#161b29', 'border:1px solid #c89b3c', 'border-radius:3px',
      'padding:8px 14px', 'white-space:nowrap', 'z-index:9999',
      'pointer-events:none', 'font-family:Barlow Semi Condensed,sans-serif',
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
    } else {
      const span = document.createElement('span')
      span.textContent = `Move ${ROLE_LABEL[enemies[idx].role] || ''} slot`
      span.style.cssText = 'font-size:12px;color:#5d6880'
      ghost.appendChild(span)
    }
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2)
    setTimeout(() => ghost.remove(), 0)
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOver !== idx) setDragOver(idx)
  }

  const handleDrop = (e, idx) => {
    e.preventDefault()
    if (dragSrc !== null && dragSrc !== idx) {
      onEnemySwap(dragSrc, idx)
    }
    setDragSrc(null)
    setDragOver(null)
    document.body.classList.remove('is-dragging')
  }

  const handleDragEnd = () => {
    setDragSrc(null)
    setDragOver(null)
    document.body.classList.remove('is-dragging')
  }

  const isDragging = dragSrc !== null

  return (
    <div className="draft-team">
      <div className="draft-team-title enemy-title">Enemy Team</div>
      {enemies.map((enemy, i) => (
        <div
          key={`enemy-${enemy.role}`}
          draggable={!loading}
          onDragStart={e => handleDragStart(e, i)}
          onDragOver={e => handleDragOver(e, i)}
          onDrop={e => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
          onDragLeave={e => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null)
          }}
          className={`enemy-drag-wrap${dragSrc === i ? ' drag-source' : ''}${dragOver === i && dragSrc !== i ? ' drag-over' : ''}`}
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
          />
        </div>
      ))}
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
