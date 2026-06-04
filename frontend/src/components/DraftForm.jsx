import { champIconUrl } from '../utils/champion'

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']

const ROLE_LABEL = {
  top: 'TOP',
  jungle: 'JG',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
}

function ChampionRow({ role, value, onChange, disabled, side }) {
  const hasChamp = value.trim().length > 3
  return (
    <div className={`champ-row champ-row--${side}`}>
      <span className="role-pill">{ROLE_LABEL[role] || role.toUpperCase()}</span>
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
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

export default function DraftForm({
  role, allies, enemies,
  onRoleChange, onAllyChange, onEnemyChange,
  onSubmit, loading, error, hasInput,
}) {
  return (
    <div className="draft-section">
      {/* Header row: role selector + button */}
      <div className="draft-header">
        <div className="draft-role-selector">
          <span className="draft-role-label">Your Role</span>
          <select value={role} onChange={e => onRoleChange(e.target.value)} disabled={loading}>
            {ROLES.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="draft-submit-area">
          {error && <span className="draft-error">{error}</span>}
          <button
            className="submit-button"
            onClick={onSubmit}
            disabled={loading || !hasInput}
          >
            {loading ? 'Analyzing...' : 'Recommend Pick'}
          </button>
        </div>
      </div>

      {/* Two-column team inputs */}
      <div className="draft-teams">
        <div className="draft-team">
          <div className="draft-team-title ally-title">Allied Team</div>
          {allies.map((ally, i) => (
            <ChampionRow
              key={`ally-${ally.role}`}
              role={ally.role}
              value={ally.champion}
              onChange={val => onAllyChange(i, val)}
              disabled={loading}
              side="ally"
            />
          ))}
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
            />
          ))}
        </div>
      </div>
    </div>
  )
}
