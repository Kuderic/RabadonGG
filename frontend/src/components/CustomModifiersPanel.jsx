import { useState, useRef, useEffect, useCallback } from 'react'
import { filterChampions, champIconUrl } from '../utils/champion'

export default function CustomModifiersPanel({ wrModifiers = {}, onModifierChange, champions = [] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const modifiedChampions = Object.keys(wrModifiers)

  const suggestions = query.length >= 1
    ? filterChampions(champions, query).filter(c =>
        !modifiedChampions.some(m => m.toLowerCase() === c.toLowerCase())
      )
    : []

  useEffect(() => { setActiveIdx(0) }, [suggestions.length])

  useEffect(() => {
    function onMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selectChampion = useCallback((champion) => {
    onModifierChange(champion, 1)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }, [onModifierChange])

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectChampion(suggestions[activeIdx] ?? suggestions[0])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="config-section">
      <div className="config-section-title">Custom Modifiers</div>
      <p className="config-desc">
        Apply a custom WR adjustment to any champion to make them rank higher or lower in recommendations — useful when you think a champion is stronger or weaker than their win rate indicates.
      </p>

      <div ref={wrapRef} className="pool-search-wrap">
        <input
          ref={inputRef}
          className="pool-search-input"
          type="text"
          placeholder="Search for a champion to adjust…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(0) }}
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

      {modifiedChampions.length === 0 ? (
        <div className="pool-empty">
          No modifiers set. Search for a champion above to add one.
        </div>
      ) : (
        <div className="modifier-list">
          {modifiedChampions.map(champion => {
            const value = wrModifiers[champion] ?? 0
            return (
              <div key={champion} className="modifier-row">
                <img src={champIconUrl(champion)} alt="" className="modifier-row-icon" />
                <span className="modifier-row-name">{champion}</span>
                <div className="modifier-row-input-wrap">
                  <input
                    type="number"
                    className={`pool-modifier-input${value !== 0 ? ' pool-modifier-input--active' : ''}`}
                    value={value}
                    step="0.5"
                    min="-10"
                    max="10"
                    aria-label={`WR modifier for ${champion}`}
                    onChange={e => onModifierChange(champion, parseFloat(e.target.value) || 0)}
                    onBlur={e => {
                      let v = parseFloat(e.target.value) || 0
                      v = Math.max(-10, Math.min(10, Math.round(v * 2) / 2))
                      if (v === 0) onModifierChange(champion, 0)
                      else onModifierChange(champion, v)
                    }}
                  />
                  <span className="pool-modifier-pct">%</span>
                </div>
                <button
                  className="pool-pill-remove"
                  onClick={() => onModifierChange(champion, 0)}
                  aria-label={`Remove modifier for ${champion}`}
                >✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
