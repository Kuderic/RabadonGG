import { useState } from 'react'
import { champIconUrl, champSlug } from '../utils/champion'

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

function DeltaCell({ label, value, breakdown, missing }) {
  const [open, setOpen] = useState(false)
  const isPositive = value.startsWith('+')
  const hasBreakdown = (breakdown && breakdown.length > 0) || (missing && missing.length > 0)

  return (
    <div
      className={`delta-cell ${hasBreakdown ? 'has-breakdown' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="delta-label">
        {label}
        {hasBreakdown && <span className="breakdown-hint">▾</span>}
      </div>
      <div className={`delta-value ${isPositive ? 'positive' : 'negative'}`}>{value}</div>

      {open && hasBreakdown && (
        <div className="breakdown-tooltip">
          {breakdown && breakdown.map((b, i) => {
            const isPos = b.delta.startsWith('+')
            return (
              <div key={i} className="breakdown-row">
                <img
                  src={champIconUrl(b.champion)}
                  alt={b.champion}
                  className="breakdown-icon"
                  onError={e => { e.target.style.display = 'none' }}
                />
                <span className="breakdown-champ">{b.champion}</span>
                <span className="breakdown-role">{b.role}</span>
                <span className={`breakdown-delta ${isPos ? 'positive' : 'negative'}`}>{b.delta}</span>
                <span className="breakdown-n">n={b.n.toLocaleString()}</span>
              </div>
            )
          })}
          {missing && missing.map((name, i) => (
            <div key={`m${i}`} className="breakdown-row breakdown-missing">
              <img
                src={champIconUrl(name)}
                alt={name}
                className="breakdown-icon"
                onError={e => { e.target.style.display = 'none' }}
              />
              <span className="breakdown-champ">{name}</span>
              <span className="breakdown-no-data">no data in top 40</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RecommendationList({ recommendations, meta, loading }) {
  if (loading) {
    return (
      <div className="recommendations-loading">
        <span className="spinner" />
        Analyzing draft...
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="recommendations-empty">
        Enter your draft above to get recommendations
      </div>
    )
  }

  return (
    <div className="recommendations-list">
      {meta && (
        <div className="rec-meta-bar">
          Patch {meta.patch} · {meta.tier}
        </div>
      )}
      {recommendations.map((rec, index) => (
        <div key={index} className="recommendation-card">
          <div className="card-header">
            <img
              src={champIconUrl(rec.champion)}
              alt={rec.champion}
              className="card-champ-icon"
              onError={e => { e.target.style.display = 'none' }}
            />
            <span className="card-champion-name">
              {rec.champion}
              <a
                href={`https://lolalytics.com/lol/${champSlug(rec.champion)}/build/`}
                target="_blank"
                rel="noopener noreferrer"
                className="lola-link"
                title={`Open ${rec.champion} on lolalytics.com`}
              >
                <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 1h4v4M11 1L5.5 6.5M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </span>
            <div className="card-stats">
              <span className="card-win-rate">{rec.win_rate.toFixed(1)}% WR</span>
              {rec.total_games > 0 && (
                <span className="card-total-games">{fmt(rec.total_games)} games</span>
              )}
            </div>
          </div>

          <div className="card-deltas">
            <DeltaCell
              label="Synergy"
              value={rec.synergy_delta}
              breakdown={rec.synergy_breakdown}
              missing={rec.synergy_missing}
            />
            <DeltaCell
              label="Counter"
              value={rec.counter_delta}
              breakdown={rec.counter_breakdown}
              missing={rec.counter_missing}
            />
          </div>

          {rec.data_warnings?.length > 0 && (
            <div className="card-warnings">
              {rec.data_warnings.map((w, i) => (
                <div key={i} className="warning-item">{w}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
