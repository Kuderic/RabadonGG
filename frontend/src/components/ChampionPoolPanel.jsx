import { useState, useRef, useEffect } from 'react'
import { filterChampions, champIconUrl } from '../utils/champion'

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']

const ROLE_LABEL_SHORT = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'BOT', support: 'SUP' }
const ROLE_LABEL = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'Bot', support: 'Support' }

const ROLE_ICON = {
  top:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png',
  jungle:  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png',
  mid:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png',
  adc:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png',
  support: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png',
}

const _imgErr = e => { e.target.style.visibility = 'hidden' }

export function ChampionPicker({ champions, exclude = new Set(), placeholder, onPick, autoFocus }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  const suggestions = query.length >= 1
    ? filterChampions(champions, query).filter(c => !exclude.has(c.toLowerCase()))
    : []

  const pick = (name) => {
    const exact = champions.find(c => c.toLowerCase() === name.toLowerCase())
    if (!exact) return
    onPick(exact)
    setQuery('')
    setOpen(false)
    setActive(0)
    inputRef.current?.focus()
  }

  const onKey = (e) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); pick(suggestions[0]) }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[active] ?? suggestions[0]) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div className="poolx-search" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        spellCheck="false"
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => { if (query) setOpen(true) }}
        onKeyDown={onKey}
      />
      {open && suggestions.length > 0 && (
        <div className="poolx-dropdown">
          {suggestions.map((c, i) => (
            <div
              key={c}
              className={`poolx-dd-item ${i === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={e => { e.preventDefault(); pick(c) }}
            >
              <img src={champIconUrl(c)} alt="" onError={_imgErr} />
              <span>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PoolLanes({ pool, champions, onAddRole, onRemoveRole }) {
  return (
    <div className="pool-lanes">
      {ROLES.map(role => {
        const champs = pool.filter(p => p.roles.includes(role))
        const exclude = new Set(champs.map(c => c.champion.toLowerCase()))
        return (
          <div className="pool-lane" key={role}>
            <div className="pool-lane-head">
              <img src={ROLE_ICON[role]} alt="" onError={_imgErr} />
              <span className="pool-lane-title">{ROLE_LABEL_SHORT[role]}</span>
              <span className="pool-lane-n">{champs.length}</span>
            </div>
            <div className="pool-lane-body">
              {champs.length === 0
                ? <div className="pool-lane-empty">Add the champs you play here</div>
                : champs.map(c => (
                  <div className="pool-lane-card" key={c.champion}>
                    <img src={champIconUrl(c.champion)} alt="" onError={_imgErr} />
                    <span className="pool-lane-card-name">{c.champion}</span>
                    <button
                      className="pool-lane-card-x"
                      onClick={() => onRemoveRole(c.champion, role)}
                      aria-label={`Remove ${c.champion} from ${role}`}
                    >✕</button>
                  </div>
                ))}
            </div>
            <div className="pool-lane-addrow">
              <ChampionPicker
                champions={champions}
                exclude={exclude}
                placeholder={`+ Add to ${ROLE_LABEL_SHORT[role]}`}
                onPick={name => onAddRole(name, role)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PoolByRole({ pool, champions, onAddRole, onRemoveRole, onToggleRole }) {
  const [role, setRole] = useState('adc')
  const champs = pool.filter(p => p.roles.includes(role))
  const exclude = new Set(champs.map(c => c.champion.toLowerCase()))
  return (
    <div>
      <div className="pool-byrole-bar">
        <div className="pool-rolepick">
          {ROLES.map(r => {
            const n = pool.filter(p => p.roles.includes(r)).length
            return (
              <button key={r} className={role === r ? 'is-active' : ''} onClick={() => setRole(r)}>
                <img src={ROLE_ICON[r]} alt="" onError={_imgErr} />
                {ROLE_LABEL_SHORT[r]}
                {n > 0 && <span className="pool-rolepick-n">{n}</span>}
              </button>
            )
          })}
        </div>
        <ChampionPicker
          champions={champions}
          exclude={exclude}
          placeholder={`Add a champion to ${ROLE_LABEL[role]}…`}
          onPick={name => onAddRole(name, role)}
          autoFocus
        />
      </div>
      <div className="pool-byrole-context">
        Showing your <strong>{ROLE_LABEL[role]}</strong> pool — {champs.length} champion{champs.length === 1 ? '' : 's'}. New adds go straight to this role.
      </div>
      {champs.length === 0 ? (
        <div className="pool-byrole-empty">No {ROLE_LABEL[role]} champions yet. Type above to add the ones you play.</div>
      ) : (
        <div className="pool-byrole-list">
          {champs.map(c => (
            <div className="pool-byrole-row" key={c.champion}>
              <img src={champIconUrl(c.champion)} alt="" onError={_imgErr} />
              <span className="pool-byrole-row-name">{c.champion}</span>
              <div className="pool-byrole-flex" title="Also plays this champion in…">
                {ROLES.filter(r => r !== role).map(r => (
                  <button
                    key={r}
                    className={`pool-byrole-flexrole ${c.roles.includes(r) ? 'is-on' : ''}`}
                    onClick={() => onToggleRole(c.champion, r)}
                    title={`Toggle ${c.champion} in ${ROLE_LABEL[r]}`}
                  >
                    {ROLE_LABEL_SHORT[r]}
                  </button>
                ))}
              </div>
              <button
                className="pool-byrole-row-x"
                onClick={() => onRemoveRole(c.champion, role)}
                aria-label={`Remove ${c.champion} from ${role}`}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChampionPoolPanel({ variant = 'lanes', onVariantChange, pool = [], champions = [], onAddRole, onRemoveRole, onToggleRole }) {
  const total = pool.length
  return (
    <div className="config-section pool-panel">
      <div className="pool-panel-head">
        <div>
          <div className="config-section-title">My Champions</div>
          <p className="pool-description" style={{ margin: '6px 0 0' }}>
            Build your pool once, by role. These power the <strong>My Champions</strong> tab in your results — scored against every draft.
          </p>
        </div>
        <div className="pool-variant-toggle" role="tablist" aria-label="My Champions layout">
          <button className={variant === 'lanes' ? 'is-active' : ''} onClick={() => onVariantChange('lanes')}>Lanes</button>
          <button className={variant === 'byrole' ? 'is-active' : ''} onClick={() => onVariantChange('byrole')}>By role</button>
        </div>
      </div>

      {variant === 'lanes'
        ? <PoolLanes pool={pool} champions={champions} onAddRole={onAddRole} onRemoveRole={onRemoveRole} />
        : <PoolByRole pool={pool} champions={champions} onAddRole={onAddRole} onRemoveRole={onRemoveRole} onToggleRole={onToggleRole} />}

      <div className="pool-variant-note">
        {variant === 'lanes'
          ? 'Lanes — see your whole pool at a glance. Add a champion straight into any role; the same champion can live in several lanes.'
          : 'By role — pick the role you\'re building, and only that role\'s champions show. Fastest when you main one or two positions.'}
        <span className="pool-total-count" style={{ marginLeft: 8 }}>· {total} champion{total === 1 ? '' : 's'} total</span>
      </div>
    </div>
  )
}
