import { useState } from 'react'
import TierSelector from './TierSelector'
import ChampionPoolPanel from './ChampionPoolPanel'
import CustomModifiersPanel from './CustomModifiersPanel'

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
const ALLY_SLOTS = {
  top:     ['jungle', 'mid', 'adc', 'support'],
  jungle:  ['top', 'mid', 'adc', 'support'],
  mid:     ['top', 'jungle', 'adc', 'support'],
  adc:     ['top', 'jungle', 'mid', 'support'],
  support: ['top', 'jungle', 'mid', 'adc'],
}

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
}) {
  const [viewRole, setViewRole] = useState('adc')
  const weights = config.roleWeights?.[viewRole] || {}
  const allySlots = ALLY_SLOTS[viewRole] || []

  const setEnemy = (role, v) => onChange({
    ...config,
    roleWeights: {
      ...config.roleWeights,
      [viewRole]: { ...weights, enemy: { ...(weights.enemy || {}), [role]: v } }
    }
  })

  const setAlly = (role, v) => onChange({
    ...config,
    roleWeights: {
      ...config.roleWeights,
      [viewRole]: { ...weights, ally: { ...(weights.ally || {}), [role]: v } }
    }
  })

  const setBlend = (key, v) => onChange({
    ...config,
    roleWeights: {
      ...config.roleWeights,
      [viewRole]: { ...weights, blend: { ...(weights.blend || {}), [key]: v } }
    }
  })

  const ctrBlend = weights.blend?.counter ?? 0.5
  const synBlend = weights.blend?.synergy ?? 0.5

  return (
    <div className="config-panel">

      {/* ── Population ──────────────────────────────────────── */}
      <div className="config-section">
        <div className="config-section-title">Population</div>
        <p className="config-desc">
          The data set used for all synergy and counter calculations. Larger sample sizes are more reliable; 30 Days aggregates across all recent patches.
        </p>
        <div className="config-row">
          <div className="config-inline-label">
            <label htmlFor="config-patch-select" className="config-field-label">Patch</label>
            <select
              id="config-patch-select"
              className="config-select"
              value={patch}
              onChange={e => onPatchChange(e.target.value)}
            >
              <option value="30">30 Days</option>
              {availablePatches?.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="config-inline-label">
            <span className="config-field-label">Tier</span>
            <TierSelector value={tier} onChange={onTierChange} />
          </div>
        </div>
      </div>

      {/* ── My Champions ────────────────────────────────────── */}
      <ChampionPoolPanel
        variant={poolVariant}
        onVariantChange={onPoolVariantChange}
        pool={pool}
        champions={champions}
        onAddRole={onAddRole}
        onRemoveRole={onRemoveRole}
        onToggleRole={onToggleRole}
      />

      {/* ── Custom Modifiers ────────────────────────────────── */}
      <CustomModifiersPanel
        wrModifiers={wrModifiers}
        onModifierChange={onModifierChange}
        champions={champions}
      />

      {/* ── Sample size penalty ─────────────────────────────── */}
      <div className="config-section">
        <div className="config-section-title">Sample Size Penalty</div>
        <p className="config-desc">
          Matchups with fewer games than the threshold are less statistically reliable.
          Each matchup's contribution is scaled by √(n / threshold) — square root rather
          than linear, because statistical confidence scales with √n. A matchup at half
          the threshold retains ~71% weight instead of 50%.
        </p>
        <div className="config-row">
          <label className="config-check-label">
            <input
              type="checkbox"
              checked={config.penalize}
              onChange={e => onChange({ ...config, penalize: e.target.checked })}
            />
            Enable sample size weighting
          </label>
        </div>
        <div className={`config-row ${!config.penalize ? 'config-row--disabled' : ''}`}>
          <label className="config-inline-label">
            Full weight at n ≥
            <input
              type="number"
              className="config-number"
              value={config.penalizeThreshold}
              min={100} max={10000} step={100}
              disabled={!config.penalize}
              onChange={e => onChange({ ...config, penalizeThreshold: Math.max(100, +e.target.value) })}
            />
            games
          </label>
          <span className="config-hint">
            e.g. at threshold {config.penalizeThreshold.toLocaleString()}: n=500 games → ×{Math.sqrt(500 / config.penalizeThreshold).toFixed(2)} weight
          </span>
        </div>
      </div>

      {/* ── Role weighting ──────────────────────────────────── */}
      <div className="config-section">
        <div className="config-section-title">
          Role Weighting
          <span className="config-section-subtitle">
            How much each opposing/allied role's matchup data contributes to the final score
          </span>
        </div>

        <p className="config-desc">
          Leave all weights at 1.0 for a balanced score. If you care more about winning
          your own lane than teamfighting or synergizing with allies, reduce the weights
          for roles you interact with less — this shifts the score toward matchups that
          directly affect you.
        </p>

        <div className="config-role-tabs">
          {ROLES.map(r => (
            <button
              key={r}
              className={`config-role-tab ${viewRole === r ? 'config-role-tab--active' : ''}`}
              onClick={() => setViewRole(r)}
            >{ROLE_LABEL[r]}</button>
          ))}
        </div>

        <div className="config-weights-grid">
          <div className="config-weights-col">
            <div className="config-weights-title enemy-title">Enemy Counter Weights</div>
            <p className="config-weights-desc">
              Relative importance of each enemy role when you play {ROLE_LABEL[viewRole]}
            </p>
            {ROLES.map(r => (
              <WeightSlider key={r} role={r}
                value={weights.enemy?.[r] ?? 0}
                onChange={v => setEnemy(r, v)} />
            ))}
          </div>

          <div className="config-weights-col">
            <div className="config-weights-title ally-title">Ally Synergy Weights</div>
            <p className="config-weights-desc">
              Relative importance of each ally role when you play {ROLE_LABEL[viewRole]}
            </p>
            {allySlots.map(r => (
              <WeightSlider key={r} role={r}
                value={weights.ally?.[r] ?? 0}
                onChange={v => setAlly(r, v)} />
            ))}
            {Array(ROLES.length - allySlots.length).fill(null).map((_, i) => (
              <div key={i} className="weight-row weight-row--spacer" />
            ))}
          </div>
        </div>

        <div className="config-blend">
          <div className="config-blend-title">Score Multipliers — {ROLE_LABEL[viewRole]}</div>
          <p className="config-blend-desc">
            Final score = WR + (<span className="enemy-color">counter multiplier</span> × Σcounter Δ) + (<span className="ally-color">synergy multiplier</span> × Σsynergy Δ). Both default to 1 and are independent.
          </p>
          <div className="config-blend-sliders">
            <div className="config-blend-row">
              <span className="blend-label enemy-title">Counter ×</span>
              <input type="range" className="weight-slider weight-slider--counter"
                min={0} max={3} step={0.1}
                value={ctrBlend}
                onChange={e => setBlend('counter', +e.target.value)} />
              <span className="weight-val">{ctrBlend.toFixed(1)}</span>
            </div>
            <div className="config-blend-row">
              <span className="blend-label ally-title">Synergy ×</span>
              <input type="range" className="weight-slider weight-slider--synergy"
                min={0} max={3} step={0.1}
                value={synBlend}
                onChange={e => setBlend('synergy', +e.target.value)} />
              <span className="weight-val">{synBlend.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Display ─────────────────────────────────────────── */}
      <div className="config-section">
        <div className="config-section-title">Display</div>
        <p className="config-desc">
          Low detail mode removes splash art, animations, and GPU-heavy visual effects. Useful on lower-end hardware or if the breakdown panel feels sluggish.
        </p>
        <div className="config-row">
          <label className="config-check-label">
            <input
              type="checkbox"
              checked={!!lowDetail}
              onChange={e => onLowDetailChange(e.target.checked)}
            />
            Low detail mode
          </label>
        </div>
        {IS_TAURI && (
          <>
            <div className="config-row">
              <label className="config-check-label">
                <input
                  type="checkbox"
                  checked={!!overlayEnabled}
                  onChange={e => onOverlayEnabledChange(e.target.checked)}
                />
                Show overlay during champion select
              </label>
            </div>
            <div className="config-row config-row--spaced">
              <span className="config-field-label">Overlay hotkey</span>
              <HotkeyCapture value={overlayHotkey} onChange={onOverlayHotkeyChange} />
            </div>
            <span className="config-hint">Default: Ctrl+ArrowDown — press this combo to show/hide the overlay at any time</span>
            <div className="config-row">
              <label className="config-check-label">
                <input
                  type="checkbox"
                  checked={!!overlayTransparent}
                  onChange={e => onOverlayTransparentChange(e.target.checked)}
                />
                Transparent overlay background
              </label>
            </div>
            <div className="config-row config-row--spaced">
              <label className="config-inline-label">
                Overlay size
                <input
                  type="range"
                  className="weight-slider"
                  min={70} max={150} step={5}
                  value={overlayScale}
                  onChange={e => onOverlayScaleChange(+e.target.value)}
                />
                <span className="weight-val">{overlayScale}%</span>
              </label>
            </div>
          </>
        )}
      </div>

      <div className="config-footer">
        <button className="config-reset-btn" onClick={() => onChange(defaultConfig)}>
          ↺ Reset all to defaults
        </button>
      </div>
    </div>
  )
}
