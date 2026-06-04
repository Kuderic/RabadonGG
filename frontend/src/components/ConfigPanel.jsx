import { useState } from 'react'

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']
const ROLE_LABEL = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Support' }
const ROLE_LABEL_SHORT = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'ADC', support: 'SUP' }
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

export default function ConfigPanel({ config, onChange, defaultConfig }) {
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

      {/* ── Sample size penalty ─────────────────────────────── */}
      <div className="config-section">
        <div className="config-section-title">Sample Size Penalty</div>
        <p className="config-desc">
          Matchups with fewer games than the threshold are less statistically reliable.
          The penalty linearly scales each matchup's contribution from 0 (no data) up to
          full weight at the threshold.
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
            e.g. at threshold {config.penalizeThreshold.toLocaleString()}: n=500 games → ×{(500 / config.penalizeThreshold).toFixed(2)} weight
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

      <div className="config-footer">
        <button className="config-reset-btn" onClick={() => onChange(defaultConfig)}>
          ↺ Reset all to defaults
        </button>
      </div>
    </div>
  )
}
