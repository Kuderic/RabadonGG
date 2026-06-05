import { useState, useRef, useEffect } from 'react'
import { champIconUrl } from '../utils/champion'
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

// Match champions by normalized name (handles "miss" → "Miss Fortune", "kogm" → "Kog'Maw")
function filterChampions(champions, query) {
  if (!query || query.length < 1) return []
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const q = norm(query)
  const ql = query.toLowerCase()

  const results = champions.filter(c => {
    const cn = norm(c)
    const cl = c.toLowerCase()
    return cn.startsWith(q) || cl.startsWith(ql) || cn.includes(q)
  })

  results.sort((a, b) => {
    const an = norm(a), bn = norm(b)
    const ap = an.startsWith(q) ? 0 : 1
    const bp = bn.startsWith(q) ? 0 : 1
    if (ap !== bp) return ap - bp
    return a.localeCompare(b)
  })

  return results.slice(0, 8)
}

function ChampionRow({ role, value, onChange, disabled, side, champions, onEnterSubmit }) {
  const [open, setOpen] = useState(false)
  const [filtered, setFiltered] = useState([])
  const [cursor, setCursor] = useState(0)  // default to first item highlighted
  const wrapRef = useRef(null)
  const id = useRef(Math.random())

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
    onChange(v)
    if (v.trim().length > 0 && champions.length > 0) {
      const matches = filterChampions(champions, v)
      if (matches.length > 0) {
        broadcastClose(id.current)
        setOpen(true)
        setFiltered(matches)
        setCursor(0)  // always pre-highlight first match
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

  // Show icon only when the entered value is an exact champion name match
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

const ROLE_DISPLAY = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Support' }

export default function DraftForm({
  role, allies, enemies, champions,
  onRoleChange, onAllyChange, onEnemyChange,
  onSubmit, loading, error, hasInput,
  patch, tier,
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
        </div>

        {error && <span className="draft-error">{error}</span>}

        <div className="draft-header-right">
          <div className="draft-population-display">
            <span className="pop-patch">{patchLabel}</span>
            <span className="pop-sep"> · </span>
            <TierDisplay tier={tier} />
          </div>
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
                onEnterSubmit={hasInput && !loading ? onSubmit : undefined}
              />
            )
          })}
        </div>

        <div className="draft-team-divider" />

        <div className="draft-team">
          <div className="draft-team-title enemy-title">Enemy Team</div>
          {enemies.map((enemy, i) => (
            <ChampionRow
              key={`enemy-${enemy.role}`}
              role={enemy.role}
              value={enemy.champion}
              onChange={val => onEnemyChange(i, val)}
              disabled={loading}
              side="enemy"
              champions={champions}
              onEnterSubmit={hasInput && !loading ? onSubmit : undefined}
            />
          ))}
        </div>
      </div>

      <div className="draft-footer">
        <button className="submit-button" onClick={onSubmit} disabled={loading || !hasInput}>
          {loading ? 'Analyzing...' : 'Recommend Picks'}
        </button>
      </div>
    </div>
  )
}
