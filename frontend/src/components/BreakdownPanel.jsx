import { champIconUrl } from '../utils/champion'
import { getMultiplier, computeComponents } from '../utils/scoring'
import { RankBadge, ExternalLink } from './ChampionShared'

const ROLE_LABEL = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'ADC', support: 'SUP' }

function BreakdownRow({ champion, role, delta, n, missing, settings, isEmpty }) {
  if (isEmpty) return <div className="bd-row bd-row--empty" />
  if (!champion) return null

  const isPos = delta?.startsWith('+')
  const mult = missing ? 1 : getMultiplier(n, settings)
  const showMult = settings?.penalize && !missing && mult < 1
  const multPct = Math.round(mult * 100)
  const isLowN = !missing && n > 0 && n < (settings?.penalizeThreshold || 1000)

  return (
    <div className={`bd-row ${missing ? 'bd-row--missing' : ''}`}>
      <img
        src={champIconUrl(champion)}
        alt={champion}
        className="bd-icon"
        loading="lazy"
        onError={e => { e.target.style.display = 'none' }}
      />
      <span className="bd-champ">{champion}</span>
      <span className="bd-role">{ROLE_LABEL[role] || (role || '').toUpperCase()}</span>
      {missing
        ? <span className="bd-no-data">no data</span>
        : <>
            <span className={`bd-delta ${isPos ? 'positive' : 'negative'}`}>{delta}</span>
            <span className={`bd-n ${isLowN ? 'bd-n--low' : ''}`}>
              {isLowN && <span className="bd-warn">⚠</span>}
              n={n?.toLocaleString()}
            </span>
            {showMult && (
              <span
                className="bd-mult"
                title={`Only ${n?.toLocaleString()} games — ${multPct}% weight applied (threshold: ${settings.penalizeThreshold.toLocaleString()})`}
              >×{(mult).toFixed(2)}</span>
            )}
          </>
      }
    </div>
  )
}

export default function BreakdownPanel({ rec, rank, onClose, settings, playerRole }) {
  const { synContrib, ctrContrib, totalDelta, blend } = computeComponents(rec, settings, playerRole)
  const adjRating = rec.win_rate + totalDelta

  const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

  // Build padded row arrays so both columns have the same height
  const synRows = [
    ...(rec.synergy_breakdown || []).map(b => ({ ...b, missing: false })),
    ...(rec.synergy_missing || []).map(name => ({ champion: name, missing: true })),
  ]
  const ctrRows = [
    ...(rec.counter_breakdown || []).map(b => ({ ...b, missing: false })),
    ...(rec.counter_missing || []).map(name => ({ champion: name, missing: true })),
  ]
  const maxRows = Math.max(synRows.length, ctrRows.length, 1)
  while (synRows.length < maxRows) synRows.push(null)
  while (ctrRows.length < maxRows) ctrRows.push(null)

  const hasSynergy = synRows.some(r => r !== null)
  const hasCounter = ctrRows.some(r => r !== null)

  return (
    <div className="breakdown-panel-full">
      <div className="bp-header">
        <div className="bp-title">
          <RankBadge rank={rank} />
          <img
            src={champIconUrl(rec.champion)}
            alt={rec.champion}
            className="bp-champ-icon"
            onError={e => { e.target.style.display = 'none' }}
          />
          <span className="bp-champ-name">{rec.champion}</span>
          <span className="bp-wr">{rec.win_rate.toFixed(1)}% WR</span>
          {rec.total_games > 0 && (
            <span className="bp-games">{(rec.total_games / 1000).toFixed(0)}K games</span>
          )}
          <ExternalLink champion={rec.champion} />
        </div>
        <button className="bp-close" onClick={onClose}>✕</button>
      </div>

      <div className="bp-summary">
        <div className="bp-summary-item">
          <span className="bp-summary-label">Rating</span>
          <span className="bp-summary-value rating-value">{adjRating.toFixed(1)}%</span>
        </div>
        <div className="bp-summary-divider" />
        <div className="bp-summary-item">
          <span className="bp-summary-label">Base WR</span>
          <span className="bp-summary-value neutral-value">{rec.win_rate.toFixed(1)}%</span>
        </div>
        <div className="bp-summary-plus">+</div>
        <div className={`bp-summary-item ${synContrib >= 0 ? 'positive' : 'negative'}`}>
          <span className="bp-summary-label">
            Synergy
            {blend.synergy !== 1 && (
              <span className="bp-blend-factor" title="Blend weight applied to synergy sum">×{blend.synergy.toFixed(2)}</span>
            )}
          </span>
          <span className="bp-summary-value">{fmt(synContrib)}</span>
        </div>
        <div className="bp-summary-plus">+</div>
        <div className={`bp-summary-item ${ctrContrib >= 0 ? 'positive' : 'negative'}`}>
          <span className="bp-summary-label">
            Counter
            {blend.counter !== 1 && (
              <span className="bp-blend-factor" title="Blend weight applied to counter sum">×{blend.counter.toFixed(2)}</span>
            )}
          </span>
          <span className="bp-summary-value">{fmt(ctrContrib)}</span>
        </div>
        <div className="bp-summary-divider" />
        <div className={`bp-summary-item ${totalDelta >= 0 ? 'positive' : 'negative'}`}>
          <span className="bp-summary-label">Total Δ</span>
          <span className="bp-summary-value">{fmt(totalDelta)}</span>
        </div>
        <div className="bp-summary-note">
          Rating = WR + (counter_mult × Σctr Δ × role_wt) + (synergy_mult × Σsyn Δ × role_wt)
          {settings?.penalize ? ` · n<${settings.penalizeThreshold.toLocaleString()} penalized` : ''}
        </div>
      </div>

      <div className="bp-columns">
        {hasSynergy && (
          <div className="bp-col">
            <div className="bp-col-title ally-title">Ally Synergy</div>
            {synRows.map((row, i) =>
              row === null
                ? <BreakdownRow key={`syn-spacer-${i}`} isEmpty settings={settings} />
                : <BreakdownRow key={`syn-${row.champion}`} {...row} settings={settings} />
            )}
          </div>
        )}
        {hasCounter && (
          <div className="bp-col">
            <div className="bp-col-title enemy-title">Enemy Counter</div>
            {ctrRows.map((row, i) =>
              row === null
                ? <BreakdownRow key={`ctr-spacer-${i}`} isEmpty settings={settings} />
                : <BreakdownRow key={`ctr-${row.champion}`} {...row} settings={settings} />
            )}
          </div>
        )}
        {!hasSynergy && !hasCounter && (
          <div className="bp-empty">No matchup data available for this draft.</div>
        )}
      </div>

      {rec.data_warnings?.length > 0 && (
        <div className="bp-warnings">
          {rec.data_warnings.map((w, i) => (
            <div key={i} className="warning-item">{w}</div>
          ))}
        </div>
      )}
    </div>
  )
}
