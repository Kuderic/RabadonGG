import { useState, useRef, useEffect, useCallback } from 'react'
import { filterChampions, champIconUrl } from '../utils/champion'

const MAX_POOL = 20
const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']
const ROLE_SHORT = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'ADC', support: 'SUP' }

export default function ChampionPoolPanel({ pool = [], onAdd, onRemove, onRoleChange, champions = [] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const poolSet = new Set(pool.map(p => p.champion.toLowerCase()))

  const suggestions = query.length >= 1
    ? filterChampions(champions, query).filter(c => !poolSet.has(c.toLowerCase()))
    : []

  useEffect(() => { setActiveIdx(0) }, [suggestions.length])

  useEffect(() => {
    function onMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const handleAdd = useCallback((nameOverride) => {
    const champ = (nameOverride ?? query).trim()
    if (!champ) return
    const exact = champions.find(c => c.toLowerCase() === champ.toLowerCase())
    if (!exact || pool.some(p => p.champion.toLowerCase() === exact.toLowerCase())) return
    onAdd(exact, [])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }, [query, champions, pool, onAdd])

  const handleKeyDown = (e) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); handleAdd(suggestions[activeIdx] ?? suggestions[0]) }
      else if (e.key === 'Escape') { setOpen(false); setQuery('') }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const atLimit = pool.length >= MAX_POOL

  return (
    <div className="config-section pool-panel">
      <div className="config-section-title">My Champions</div>
      <p className="pool-description">
        Champions in your pool appear in the <strong>My Champions</strong> tab. Assign roles to each champion so they only show up when you're playing that role.
      </p>

      <div ref={wrapRef} className="pool-add-wrap">
        <div className="pool-search-wrap">
          <input
            ref={inputRef}
            className="pool-search-input"
            type="text"
            placeholder={atLimit ? `Pool full (${MAX_POOL} max)` : 'Add a champion…'}
            value={query}
            disabled={atLimit}
            onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); if (!e.target.value) setPendingRoles([]) }}
            onFocus={() => { if (query) setOpen(true) }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
          {open && suggestions.length > 0 && (
            <div className="pool-dropdown">
              {suggestions.map((c, i) => (
                <div
                  key={c}
                  className={`pool-dropdown-item${i === activeIdx ? ' pool-dd-active' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={e => { e.preventDefault(); selectChampion(c) }}
                >
                  <img src={champIconUrl(c)} alt="" className="pool-dd-icon" />
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {pool.length === 0 ? (
        <div className="pool-empty">Add champions you play to see how they score against any draft.</div>
      ) : (
        <>
          <div className="pool-entry-list">
            {pool.map(entry => (
              <div key={entry.champion} className="pool-entry">
                <img
                  src={champIconUrl(entry.champion)}
                  alt=""
                  className="pool-entry-icon"
                  onError={e => { e.target.style.display = 'none' }}
                />
                <span className="pool-entry-name">{entry.champion}</span>
                <div className="pool-entry-roles">
                  {ROLES.map(r => (
                    <button
                      key={r}
                      type="button"
                      className={`pool-role-btn pool-role-btn--sm${entry.roles.includes(r) ? ' pool-role-btn--active' : ''}`}
                      onClick={() => {
                        const next = entry.roles.includes(r)
                          ? entry.roles.filter(x => x !== r)
                          : [...entry.roles, r]
                        onRoleChange(entry.champion, next)
                      }}
                      title={r.charAt(0).toUpperCase() + r.slice(1)}
                    >
                      {ROLE_SHORT[r]}
                    </button>
                  ))}
                  {entry.roles.length === 0 && (
                    <span className="pool-entry-all-roles">All roles</span>
                  )}
                </div>
                <button
                  className="pool-pill-remove"
                  onClick={() => onRemove(entry.champion)}
                  aria-label={`Remove ${entry.champion}`}
                >✕</button>
              </div>
            ))}
          </div>
          <div className="pool-count">{pool.length} / {MAX_POOL} champions</div>
        </>
      )}
    </div>
  )
}
