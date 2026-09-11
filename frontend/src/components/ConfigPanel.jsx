import { useState } from 'react'
import TierSelector from './TierSelector'
import ChampionPoolPanel, { ChampionPicker } from './ChampionPoolPanel'
import CustomModifiersPanel from './CustomModifiersPanel'
import { champIconUrl } from '../utils/champion'

const IS_TAURI = typeof window !== 'undefined' && window.__TAURI__ != null

function formatHotkey(e) {
  const parts = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')
  const skip = new Set(['Control', 'Alt', 'Shift', 'Meta'])
  if (!skip.has(e.key)) {
    // Normalize single letters to uppercase; leave named keys (ArrowDown, F1…) as-is
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
  }
  return parts.length > 1 ? parts.join('+') : ''
}

function HotkeyCapture({ value, onChange }) {
  const [recording, setRecording] = useState(false)

  const handleKeyDown = e => {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') { setRecording(false); return }
    const combo = formatHotkey(e)
    if (combo) { onChange(combo); setRecording(false) }
  }

  return (
    <div
      className={`hotkey-capture ${recording ? 'hotkey-capture--recording' : ''}`}
      tabIndex={0}
      role="button"
      aria-label="Click to record hotkey"
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={recording ? handleKeyDown : undefined}
    >
      {recording ? 'Press a key combination…' : (value || 'None')}
    </div>
  )
}

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']
const ROLE_LABEL = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'Bot', support: 'Support' }
const ROLE_LABEL_SHORT = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'BOT', support: 'SUP' }

const SECTIONS = [
  ['population', 'Data set'],
  ['pool', 'My Champions'],
  ['modifiers', 'Modifiers'],
  ['scoring', 'Scoring'],
  ['display', 'Display'],
]

const allySlots = me => ROLES.filter(r => r !== me)

function WeightSlider({ role, value, onChange }) {
  return (
    <div className="weight-row">
      <span className="weight-role">{ROLE_LABEL_SHORT[role]}</span>
      <input
        type="range"
        className="weight-slider"
        min={0} max={1} step={0.05}
        value={value}
        onChange={e => onChange(+e.target.value)}
      />
      <span className="weight-val">{value.toFixed(2)}</span>
    </div>
  )
}

// ── section furniture ───────────────────────────────────────────────────────
function C2Head({ title, desc, onReset }) {
  return (
    <div className="cfg2-head">
      <div>
        <div className="config-section-title">{title}</div>
        {desc && <p className="config-desc">{desc}</p>}
      </div>
      {onReset && <button className="cfg2-reset" onClick={onReset} type="button">↺ Reset section</button>}
    </div>
  )
}

function C2Row({ label, help, disabled, children }) {
  return (
    <div className={`cfg2-row${disabled ? ' cfg2-row--disabled' : ''}`}>
      <div className="cfg2-row-lbl">{label}</div>
      {help && <div className="cfg2-row-help">{help}</div>}
      <div className="cfg2-row-ctl">{children}</div>
    </div>
  )
}

function C2Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      className={`cfg2-switch${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
    />
  )
}

// ── scoring presets ─────────────────────────────────────────────────────────
// A preset writes the whole per-role weight matrix at once, so the 9 sliders
// stay out of the way until someone actually wants them.
const PRESETS = [
  {
    id: 'balanced',
    t: 'Balanced',
    d: 'Every matchup counts equally. The default.',
    enemy: () => 1, ally: () => 1, ctr: 1, syn: 1,
  },
  {
    id: 'lane',
    t: 'Lane first',
    d: 'Your direct opponent and lane partner weigh most; the rest of the map less.',
    enemy: (me, r) => (r === me ? 1 : (me === 'adc' && r === 'support') || (me === 'support' && r === 'adc') ? 0.8 : 0.4),
    ally: (me, r) => ((me === 'adc' && r === 'support') || (me === 'support' && r === 'adc') ? 1 : 0.5),
    ctr: 1, syn: 1,
  },
  {
    id: 'counter',
    t: 'Counter-pick',
    d: 'Weights counters 1.5× over synergy. For picking last against a locked enemy.',
    enemy: () => 1, ally: () => 1, ctr: 1.5, syn: 0.8,
  },
]

function applyPreset(config, p) {
  const roleWeights = {}
  ROLES.forEach(me => {
    roleWeights[me] = {
      enemy: Object.fromEntries(ROLES.map(r => [r, p.enemy(me, r)])),
      ally: Object.fromEntries(allySlots(me).map(r => [r, p.ally(me, r)])),
      blend: { counter: p.ctr, synergy: p.syn },
    }
  })
  return { ...config, roleWeights, preset: p.id }
}

// A config with no explicit preset is Balanced if every weight and blend is 1 —
// which is what the shipped defaults are.
function detectPreset(config) {
  if (config.preset) return config.preset
  const rw = config.roleWeights || {}
  const one = v => v === undefined || Math.abs(v - 1) < 1e-6
  const balanced = ROLES.every(me => {
    const w = rw[me] || {}
    return ROLES.every(r => one(w.enemy?.[r]))
      && allySlots(me).every(r => one(w.ally?.[r]))
      && one(w.blend?.counter) && one(w.blend?.synergy)
  })
  return balanced ? 'balanced' : null
}

function ScoringSection({ config, onChange, defaultConfig }) {
  const [role, setRole] = useState('adc')
  const w = config.roleWeights?.[role] || {}
  // Any hand-tuned weight drops the preset badge — the matrix no longer matches it.
  const setW = patch => onChange({
    ...config,
    preset: null,
    roleWeights: { ...config.roleWeights, [role]: { ...w, ...patch } },
  })
  const preset = detectPreset(config)
  const ctr = w.blend?.counter ?? 1
  const syn = w.blend?.synergy ?? 1

  return (
    <div className="config-section">
      <C2Head
        title="Scoring"
        desc="How a champion's draft Δ is built from its matchups. Pick a preset; open Advanced only if you want to hand-tune."
        onReset={() => onChange({ ...defaultConfig, preset: 'balanced' })}
      />

      <div className="cfg2-presets" role="radiogroup" aria-label="Scoring preset">
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={preset === p.id}
            className={`cfg2-preset${preset === p.id ? ' is-active' : ''}`}
            onClick={() => onChange(applyPreset(config, p))}
          >
            <span className="t">{p.t}</span>
            <span className="d">{p.d}</span>
          </button>
        ))}
      </div>
      {!preset && (
        <div className="cfg2-formula" style={{ marginTop: 10 }}>
          Custom weights in use — choose a preset to replace them.
        </div>
      )}

      <C2Row
        label="Discount thin data"
        help={`Matchups with fewer than ${config.penalizeThreshold.toLocaleString()} games count for less, scaling up to full weight at the threshold. Rows flagged ⚠ are affected.`}
      >
        <C2Switch on={config.penalize} onChange={v => onChange({ ...config, penalize: v })} label="Discount low-sample matchups" />
      </C2Row>
      <C2Row label="Full weight from" help="Games needed before a matchup counts fully." disabled={!config.penalize}>
        <input
          type="number"
          className="cfg2-number"
          value={config.penalizeThreshold}
          min={100} max={10000} step={100}
          disabled={!config.penalize}
          onChange={e => onChange({ ...config, penalizeThreshold: Math.max(100, +e.target.value || 100) })}
        />
        <span className="cfg2-ctl-unit">games</span>
      </C2Row>

      <details className="cfg2-disclosure">
        <summary>
          Advanced — per-role weights
          <span className="hint">Fine-tune how much each lane's matchup data counts</span>
        </summary>
        <div className="cfg2-disclosure-body">
          <div className="cfg2-role-row">
            <span className="k">When you play</span>
            <div className="cfg2-seg">
              {ROLES.map(r => (
                <button key={r} type="button" className={role === r ? 'is-active' : ''} onClick={() => setRole(r)}>
                  {ROLE_LABEL_SHORT[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="config-weights-grid">
            <div className="config-weights-col">
              <div className="config-weights-title enemy-title">Enemy counters</div>
              {ROLES.map(r => (
                <WeightSlider key={r} role={r} value={w.enemy?.[r] ?? 1}
                  onChange={v => setW({ enemy: { ...(w.enemy || {}), [r]: v } })} />
              ))}
            </div>
            <div className="config-weights-col">
              <div className="config-weights-title ally-title">Ally synergies</div>
              {allySlots(role).map(r => (
                <WeightSlider key={r} role={r} value={w.ally?.[r] ?? 1}
                  onChange={v => setW({ ally: { ...(w.ally || {}), [r]: v } })} />
              ))}
              <div className="weight-row weight-row--spacer" />
            </div>
          </div>
          <div className="cfg2-mult">
            <span className="k enemy-title">Counter ×</span>
            <input type="range" className="weight-slider weight-slider--counter"
              min={0} max={3} step={0.1} value={ctr}
              onChange={e => setW({ blend: { ...(w.blend || {}), counter: +e.target.value } })} />
            <span className="v">{ctr.toFixed(1)}</span>
          </div>
          <div className="cfg2-mult">
            <span className="k ally-title">Synergy ×</span>
            <input type="range" className="weight-slider weight-slider--synergy"
              min={0} max={3} step={0.1} value={syn}
              onChange={e => setW({ blend: { ...(w.blend || {}), synergy: +e.target.value } })} />
            <span className="v">{syn.toFixed(1)}</span>
          </div>
          <div className="cfg2-formula">
            Δ = <b>{ctr.toFixed(1)}</b> × Σ weighted counters + <b>{syn.toFixed(1)}</b> × Σ weighted synergies &nbsp;·&nbsp; Rating = WR + Δ
          </div>
        </div>
      </details>
    </div>
  )
}

export default function ConfigPanel({
  config, onChange, defaultConfig,
  patch, tier, availablePatches, onPatchChange, onTierChange,
  lowDetail, onLowDetailChange,
  overlayEnabled, onOverlayEnabledChange,
  overlayHotkey, onOverlayHotkeyChange,
  overlayScale = 100, onOverlayScaleChange,
  overlayTransparent = true, onOverlayTransparentChange,
  pool = [], onPoolAdd, onPoolRemove, onPoolRoleChange,
  poolVariant, onPoolVariantChange, onAddRole, onRemoveRole, onToggleRole,
  champions = [], playerRole,
  wrModifiers = {}, onModifierChange,
  computeDraftRecs = false, onComputeDraftRecsChange,
  champBlacklist = {}, onChampBlacklistChange,
}) {
  const [section, setSection] = useState('population')
  const [blacklistRole, setBlacklistRole] = useState('top')

  const counts = { pool: pool.length, modifiers: Object.keys(wrModifiers).length }
  const blacklisted = champBlacklist[blacklistRole] || []

  return (
    <div className="config-panel cfg2">
      <nav className="cfg2-nav" aria-label="Settings sections">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`cfg2-nav-btn${section === id ? ' is-active' : ''}`}
            onClick={() => setSection(id)}
          >
            <span className="dot" />{label}
            {counts[id] > 0 && <span className="n">{counts[id]}</span>}
          </button>
        ))}
      </nav>

      <div className="cfg2-body">
        {/* ── Data set ───────────────────────────────────────── */}
        {section === 'population' && (
          <div className="config-section">
            <C2Head
              title="Data set"
              desc="Which games feed every win rate, synergy and counter. Also shown in the Draft header."
              onReset={() => { onPatchChange('30'); onTierChange('emerald_plus') }}
            />
            <C2Row label="Patch" help="30 days pools all recent patches for bigger samples; a single patch reacts faster to balance changes.">
              <select
                id="config-patch-select"
                className="config-select"
                value={patch}
                onChange={e => onPatchChange(e.target.value)}
              >
                <option value="30">Last 30 days</option>
                {availablePatches?.map(p => (
                  <option key={p} value={p}>Patch {p}</option>
                ))}
              </select>
            </C2Row>
            <C2Row label="Rank tier" help="Matchup data from this tier and above.">
              <TierSelector value={tier} onChange={onTierChange} />
            </C2Row>
          </div>
        )}

        {/* ── My Champions (pool + blacklist) ─────────────────── */}
        {section === 'pool' && (
          <>
            <ChampionPoolPanel
              variant="lanes"
              onVariantChange={onPoolVariantChange}
              pool={pool}
              champions={champions}
              onAddRole={onAddRole}
              onRemoveRole={onRemoveRole}
              onToggleRole={onToggleRole}
            />

            <div className="config-section">
              <C2Head
                title="Blacklist"
                desc="Champions you never want recommended. Per-role — pick a role, then type a name to add it."
              />
              <div className="config-role-tabs">
                {ROLES.map(r => (
                  <button
                    key={r}
                    className={`config-role-tab ${blacklistRole === r ? 'config-role-tab--active' : ''}`}
                    onClick={() => setBlacklistRole(r)}
                  >{ROLE_LABEL[r]}</button>
                ))}
              </div>
              <div className="pool-lane-addrow" style={{ marginBottom: 8 }}>
                <ChampionPicker
                  key={blacklistRole}
                  champions={champions}
                  exclude={new Set(blacklisted.map(c => c.toLowerCase()))}
                  placeholder={`Add champion to ${ROLE_LABEL[blacklistRole]} blacklist…`}
                  onPick={name => onChampBlacklistChange({
                    ...champBlacklist,
                    [blacklistRole]: [...blacklisted, name]
                  })}
                />
              </div>
              {blacklisted.length === 0
                ? <span className="config-hint">No champions blacklisted for {ROLE_LABEL[blacklistRole]}.</span>
                : blacklisted.map(c => (
                    <div className="pool-byrole-row" key={c}>
                      <img src={champIconUrl(c)} alt="" onError={e => { e.target.style.visibility = 'hidden' }} />
                      <span className="pool-byrole-row-name">{c}</span>
                      <button
                        className="pool-byrole-row-x"
                        onClick={() => onChampBlacklistChange({
                          ...champBlacklist,
                          [blacklistRole]: blacklisted.filter(x => x !== c)
                        })}
                        aria-label={`Remove ${c} from blacklist`}
                      >✕</button>
                    </div>
                  ))
              }
            </div>
          </>
        )}

        {/* ── Modifiers ───────────────────────────────────────── */}
        {section === 'modifiers' && (
          <CustomModifiersPanel
            wrModifiers={wrModifiers}
            onModifierChange={onModifierChange}
            champions={champions}
          />
        )}

        {/* ── Scoring ─────────────────────────────────────────── */}
        {section === 'scoring' && (
          <ScoringSection config={config} onChange={onChange} defaultConfig={defaultConfig} />
        )}

        {/* ── Display ─────────────────────────────────────────── */}
        {section === 'display' && (
          <div className="config-section">
            <C2Head
              title="Display"
              desc="How the app looks and how much it computes up front."
              onReset={() => { onLowDetailChange(false); onComputeDraftRecsChange?.(false) }}
            />
            <C2Row
              label="Low detail mode"
              help="Turns off splash art, animation and heavy effects. Use on lower-end hardware or if the breakdown panel feels slow."
            >
              <C2Switch on={!!lowDetail} onChange={onLowDetailChange} label="Low detail mode" />
            </C2Row>
            <C2Row
              label="Recommend for open slots"
              help="Fills every open slot on the Draft Overview board with its top 3 picks. Can take 5–20 seconds on a cold cache."
            >
              <C2Switch on={!!computeDraftRecs} onChange={v => onComputeDraftRecsChange?.(v)} label="Recommend for open slots" />
            </C2Row>

            {IS_TAURI && (
              <>
                <C2Row label="Overlay" help="Show the compact pick overlay over the League client during champion select.">
                  <C2Switch on={!!overlayEnabled} onChange={onOverlayEnabledChange} label="Show overlay during champion select" />
                </C2Row>
                <C2Row
                  label="Overlay hotkey"
                  help={overlayHotkey ? 'Click the box to change, ✕ to remove.' : 'No hotkey set — click the box to record one.'}
                  disabled={!overlayEnabled}
                >
                  <HotkeyCapture value={overlayHotkey} onChange={onOverlayHotkeyChange} />
                  {overlayHotkey && (
                    <button
                      className="hotkey-clear-btn"
                      onClick={() => onOverlayHotkeyChange('')}
                      title="Remove hotkey"
                    >✕</button>
                  )}
                </C2Row>
                <C2Row label="Transparent background" help="Blends the overlay into the client instead of drawing its own panel." disabled={!overlayEnabled}>
                  <C2Switch on={!!overlayTransparent} onChange={onOverlayTransparentChange} label="Transparent overlay background" />
                </C2Row>
                <C2Row label="Overlay size" help="Scales the whole overlay." disabled={!overlayEnabled}>
                  <div className="config-overlay-size">
                    <input
                      type="range"
                      className="weight-slider"
                      min={70} max={150} step={5}
                      value={overlayScale}
                      onChange={e => onOverlayScaleChange(+e.target.value)}
                    />
                    <span className="weight-val">{overlayScale}%</span>
                  </div>
                </C2Row>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
