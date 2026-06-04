import { useState, useRef, useEffect } from 'react'

const OPGG = 'https://opgg-static.akamaized.net/images/medals_new'

export const TIER_OPTIONS = [
  { value: 'diamond_plus',  label: 'Diamond+',  icon: `${OPGG}/diamond.png` },
  { value: 'emerald_plus',  label: 'Emerald+',  icon: `${OPGG}/emerald.png` },
  { value: 'platinum_plus', label: 'Platinum+', icon: `${OPGG}/platinum.png` },
  { value: 'gold',          label: 'Gold+',     icon: `${OPGG}/gold.png` },
  { value: 'all',           label: 'All Ranks', icon: null },
]

const broadcastClose = (exceptId) =>
  document.dispatchEvent(new CustomEvent('closeDropdowns', { detail: exceptId }))

export function TierDisplay({ tier }) {
  const opt = TIER_OPTIONS.find(t => t.value === tier)
  return (
    <span className="tier-display">
      {opt?.icon && (
        <img src={opt.icon} alt="" className="tier-icon"
          onError={e => { e.target.style.display = 'none' }} />
      )}
      <span>{opt?.label ?? tier}</span>
    </span>
  )
}

export default function TierSelector({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const id = useRef(Math.random())

  useEffect(() => {
    const closeHandler = e => { if (e.detail !== id.current) setOpen(false) }
    const outsideHandler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('closeDropdowns', closeHandler)
    document.addEventListener('mousedown', outsideHandler)
    return () => {
      document.removeEventListener('closeDropdowns', closeHandler)
      document.removeEventListener('mousedown', outsideHandler)
    }
  }, [])

  const handleOpen = () => {
    if (disabled) return
    if (!open) broadcastClose(id.current)
    setOpen(o => !o)
  }

  const selected = TIER_OPTIONS.find(t => t.value === value) || TIER_OPTIONS[1]

  return (
    <div className={`tier-select ${disabled ? 'tier-select--disabled' : ''}`} ref={ref}>
      <button className="tier-select-trigger" onClick={handleOpen} type="button">
        {selected.icon && (
          <img src={selected.icon} alt="" className="tier-icon"
            onError={e => { e.target.style.display = 'none' }} />
        )}
        <span>{selected.label}</span>
        <span className="tier-select-arrow">▾</span>
      </button>
      {open && (
        <div className="tier-select-menu">
          {TIER_OPTIONS.map(opt => (
            <div
              key={opt.value}
              className={`tier-select-item ${opt.value === value ? 'tier-select-item--active' : ''}`}
              onMouseDown={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.icon
                ? <img src={opt.icon} alt="" className="tier-icon"
                    onError={e => { e.target.style.display = 'none' }} />
                : <span className="tier-icon-placeholder" />
              }
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
