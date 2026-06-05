import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import { champIconUrl, champDDragonKey } from '../utils/champion'
import { computeComponents } from '../utils/scoring'
import { RankBadge, ExternalLink } from './ChampionShared'
import BreakdownPanel from './BreakdownPanel'

const ROLE_LABEL = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Support' }

function hasLowN(rec, config) {
  if (!config?.penalize) return false
  const all = [...(rec.synergy_breakdown || []), ...(rec.counter_breakdown || [])]
  return all.some(b => b.n > 0 && b.n < config.penalizeThreshold)
}

function computeAdjustedScore(rec, sortMode, config, playerRole) {
  const { totalDelta } = computeComponents(rec, config, playerRole)
  return sortMode === 'delta' ? totalDelta : rec.win_rate + totalDelta
}

export default function RecommendationList({ recommendations, loading, selectedIndex, onSelect, config, playerRole, onTogglePenalty }) {
  const [sortMode, setSortMode] = useState('rating')
  const breakdownRef = useRef(null)

  useEffect(() => {
    if (selectedIndex !== null && breakdownRef.current) {
      requestAnimationFrame(() => {
        breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }, [selectedIndex])

  const { sorted, penalizedCount } = useMemo(() => {
    if (!recommendations.length) return { sorted: [], penalizedCount: 0 }

    let penalizedCount = 0
    if (config?.penalize) {
      for (const rec of recommendations) {
        const all = [...(rec.synergy_breakdown || []), ...(rec.counter_breakdown || [])]
        penalizedCount += all.filter(b => b.n > 0 && b.n < config.penalizeThreshold).length
      }
    }

    const sorted = [...recommendations]
      .map((rec, origIdx) => ({ rec, origIdx }))
      .sort((a, b) =>
        computeAdjustedScore(b.rec, sortMode, config, playerRole) -
        computeAdjustedScore(a.rec, sortMode, config, playerRole)
      )

    return { sorted, penalizedCount }
  }, [recommendations, sortMode, config, playerRole])

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
      <div className="rec-panel-heading">
        <span className="rec-panel-title">Recommended Picks</span>
        {playerRole && (
          <span className="rec-panel-role">{ROLE_LABEL[playerRole] || playerRole}</span>
        )}
      </div>
      <div className="rec-toolbar">
        <span className="rec-toolbar-label">Sort by</span>
        <button
          className={`sort-btn ${sortMode === 'rating' ? 'sort-btn--active' : ''}`}
          onClick={() => setSortMode('rating')}
        >WR + Δ</button>
        <button
          className={`sort-btn ${sortMode === 'delta' ? 'sort-btn--active' : ''}`}
          onClick={() => setSortMode('delta')}
        >Δ only</button>

        <div className="rec-toolbar-sep" />

        <label className="penalty-toggle" title="Weight matchups with fewer games than the threshold (configure in Settings)">
          <input
            type="checkbox"
            checked={!!config?.penalize}
            onChange={onTogglePenalty}
          />
          Penalize low sample
        </label>
        {config?.penalize && (
          <span
            className={`penalty-count ${penalizedCount > 0 ? 'penalty-count--active' : 'penalty-count--none'}`}
            title={penalizedCount > 0
              ? `${penalizedCount} matchup${penalizedCount !== 1 ? 's' : ''} weighted down (n < ${config.penalizeThreshold.toLocaleString()} games)`
              : `All matchups have ≥ ${config.penalizeThreshold.toLocaleString()} games — penalty has no effect`}
          >
            {penalizedCount > 0 ? `${penalizedCount} weighted` : 'no effect'}
          </span>
        )}

      </div>

      <div className="rec-grid rec-grid--row">
        {sorted.map(({ rec, origIdx }, rank) => {
          const isSelected = selectedIndex === origIdx
          const lowN = hasLowN(rec, config)
          const { adjSyn, adjCtr, totalDelta } = computeComponents(rec, config, playerRole)
          const fmt = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
          return (
            <Fragment key={origIdx}>
              <div
                className={`recommendation-card ${isSelected ? 'card-selected' : ''}`}
                onClick={() => onSelect(isSelected ? null : origIdx)}
                onMouseEnter={() => {
                  const img = new Image()
                  img.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champDDragonKey(rec.champion)}_0.jpg`
                }}
              >
                <div className="card-header">
                  <RankBadge rank={rank + 1} />
                  <img
                    src={champIconUrl(rec.champion)}
                    alt={rec.champion}
                    className="card-champ-icon"
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <span className="card-champion-name">
                    {rec.champion}
                    <ExternalLink champion={rec.champion} />
                  </span>
                  <div className="card-stats">
                    <div className="card-wr-line">
                      <span className="card-win-rate">{rec.win_rate.toFixed(1)}%</span>
                      <span className={`card-wr-delta ${totalDelta >= 0 ? 'positive' : 'negative'}`}>
                        {fmt(totalDelta)}
                      </span>
                      {lowN && (
                        <span className="low-n-warning" title={`Some matchups have fewer than ${config.penalizeThreshold} games — score is weighted down`}>⚠</span>
                      )}
                    </div>
                    {rec.total_games > 0 && (
                      <span className="card-total-games">{(rec.total_games / 1000).toFixed(0)}K games</span>
                    )}
                  </div>
                </div>

                <div className="card-deltas">
                  <div className="delta-cell">
                    <div className="delta-label">Synergy</div>
                    <div className={`delta-value ${adjSyn >= 0 ? 'positive' : 'negative'}`}>
                      {fmt(adjSyn)}
                    </div>
                  </div>
                  <div className="delta-cell">
                    <div className="delta-label">Counter</div>
                    <div className={`delta-value ${adjCtr >= 0 ? 'positive' : 'negative'}`}>
                      {fmt(adjCtr)}
                    </div>
                  </div>
                </div>

                <button className="card-details-toggle">
                  {isSelected ? '▲ collapse' : '▼ details'}
                </button>
              </div>
              {isSelected && (
                <div ref={breakdownRef} className="breakdown-inline">
                  <BreakdownPanel
                    rec={rec}
                    rank={rank + 1}
                    onClose={() => onSelect(null)}
                    settings={config}
                    playerRole={playerRole}
                  />
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
