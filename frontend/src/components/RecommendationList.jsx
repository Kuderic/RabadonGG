import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import { champIconUrl, champDDragonKey } from '../utils/champion'
import { computeComponents } from '../utils/scoring'
import { RankBadge, ExternalLink } from './ChampionShared'
import BreakdownPanel from './BreakdownPanel'
import { trackEvent } from '../utils/analytics'

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']
const ROLE_LABEL = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Support' }
const ROLE_LABEL_SHORT = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'ADC', support: 'SUP' }
const ROLE_ICON = {
  top:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png',
  jungle:  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png',
  mid:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png',
  adc:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png',
  support: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png',
}

function hasLowN(rec, config) {
  if (!config?.penalize) return false
  const all = [...(rec.synergy_breakdown || []), ...(rec.counter_breakdown || [])]
  return all.some(b => b.n > 0 && b.n < config.penalizeThreshold)
}

function computeAdjustedScore(rec, sortMode, config, playerRole, modifiers) {
  const { synContrib, ctrContrib, totalDelta, customOffset } = computeComponents(rec, config, playerRole, modifiers)
  if (sortMode === 'delta') return totalDelta
  if (sortMode === 'synergy') return synContrib
  if (sortMode === 'counter') return ctrContrib
  return rec.win_rate + customOffset + totalDelta
}

function PoolBadge() {
  return (
    <span className="pool-badge" title="In your pool">
      <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <path d="M7 1l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.3l-3.2 1.6.6-3.6L1.8 4.8l3.6-.5z"/>
      </svg>
    </span>
  )
}

function PoolStar() {
  return (
    <span className="card-pool-star" title="In your champion pool">
      <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <path d="M7 1l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.3l-3.2 1.6.6-3.6L1.8 4.8l3.6-.5z"/>
      </svg>
    </span>
  )
}

function RecCard({ rec, rank, isSelected, onSelect, config, playerRole, wrModifiers, sortMode, breakdownRef, inPool }) {
  const lowN = hasLowN(rec, config)
  const { adjSyn, adjCtr, totalDelta, customOffset } = computeComponents(rec, config, playerRole, wrModifiers)
  const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  const isPool = rank === '★'

  return (
    <Fragment>
      <div
        className={`recommendation-card ${isPool ? 'pool-card' : ''} ${!isPool && inPool ? 'in-pool' : ''} ${isSelected ? 'card-selected' : ''}`}
        onClick={onSelect}
        onMouseEnter={!isPool ? () => {
          const img = new Image()
          img.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champDDragonKey(rec.champion)}_0.jpg`
        } : undefined}
      >
        <div className="card-header">
          {isPool ? <PoolBadge /> : <RankBadge rank={rank} />}
          <img
            src={champIconUrl(rec.champion)}
            alt={rec.champion}
            className="card-champ-icon"
            onError={e => {
              e.target.onerror = null
              e.target.classList.add('card-champ-icon--error')
            }}
          />
          <span className="card-champion-name">
            {rec.champion}
            {!isPool && inPool && <PoolStar />}
            <ExternalLink champion={rec.champion} />
          </span>
          <div className="card-stats">
            <div className="card-wr-line">
              <span className="card-win-rate">{rec.win_rate.toFixed(1)}%</span>
              <span className={`card-wr-delta ${totalDelta >= 0 ? 'positive' : 'negative'}`}>
                {fmt(totalDelta)}
              </span>
              {lowN && (
                <span className="low-n-warning" title={`Some matchups have fewer than ${config?.penalizeThreshold} games — score is weighted down`}>⚠</span>
              )}
            </div>
            {customOffset !== 0 && (
              <div className="card-modifier-line">
                <span className="custom-modifier-badge" title={`Personal WR offset: ${customOffset > 0 ? '+' : ''}${customOffset}%`}>
                  ✎ {customOffset > 0 ? '+' : ''}{customOffset}%
                </span>
              </div>
            )}
            {rec.total_games > 0 && (
              <span className="card-total-games">{(rec.total_games / 1000).toFixed(0)}K games</span>
            )}
          </div>
        </div>

        <div className="card-deltas">
          <div className={`delta-cell ${sortMode === 'synergy' ? 'delta-cell--sorted' : ''}`}>
            <div className="delta-label">Synergy{sortMode === 'synergy' ? ' ↓' : ''}</div>
            <div className={`delta-value ${adjSyn >= 0 ? 'positive' : 'negative'}`}>{fmt(adjSyn)}</div>
          </div>
          <div className={`delta-cell ${sortMode === 'counter' ? 'delta-cell--sorted' : ''}`}>
            <div className="delta-label">Counter{sortMode === 'counter' ? ' ↓' : ''}</div>
            <div className={`delta-value ${adjCtr >= 0 ? 'positive' : 'negative'}`}>{fmt(adjCtr)}</div>
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
            rank={rank}
            onClose={onSelect}
            settings={config}
            playerRole={playerRole}
            modifiers={wrModifiers}
          />
        </div>
      )}
    </Fragment>
  )
}

function SortHeaders({ sortMode, onSort }) {
  return (
    <div className="rec-col-headers" role="row">
      <div className="rec-col-head-pick">Pick</div>
      <div className="rec-col-deltas">
        <button type="button"
                className={`rec-col-sort ${sortMode === 'synergy' ? 'rec-col-sort--active' : ''}`}
                onClick={() => onSort('synergy')}
                title="Sort by synergy with your allies">
          Synergy <span className="sort-caret">▼</span>
        </button>
        <button type="button"
                className={`rec-col-sort ${sortMode === 'counter' ? 'rec-col-sort--active' : ''}`}
                onClick={() => onSort('counter')}
                title="Sort by counter vs. enemies">
          Counter <span className="sort-caret">▼</span>
        </button>
      </div>
      <div className="rec-col-head-wr">Win rate</div>
    </div>
  )
}

export default function RecommendationList({ recommendations, loading, refreshing, selectedIndex, onSelect, config, playerRole, youRole, onViewRoleChange, onTogglePenalty, poolResults = [], selectedPoolRec, onSelectPoolRec, wrModifiers = {}, poolChampions = new Set() }) {
  const [sortMode, setSortMode] = useState('rating')
  const [recTab, setRecTab] = useState('overall')
  const breakdownRef = useRef(null)
  const poolBreakdownRef = useRef(null)

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
        computeAdjustedScore(b.rec, sortMode, config, playerRole, wrModifiers) -
        computeAdjustedScore(a.rec, sortMode, config, playerRole, wrModifiers)
      )

    return { sorted, penalizedCount }
  }, [recommendations, sortMode, config, playerRole, wrModifiers])

  const sortedPool = useMemo(() => {
    if (!poolResults.length) return []
    return [...poolResults].sort((a, b) =>
      computeAdjustedScore(b, sortMode, config, playerRole, wrModifiers) -
      computeAdjustedScore(a, sortMode, config, playerRole, wrModifiers)
    )
  }, [poolResults, sortMode, config, playerRole, wrModifiers])

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
        <div className="rec-role-switch" role="tablist" aria-label="View top picks for a role">
          {ROLES.map(r => (
            <button
              key={r}
              role="tab"
              aria-selected={playerRole === r}
              className={`rec-role-btn ${playerRole === r ? 'rec-role-btn--active' : ''}`}
              onClick={() => onViewRoleChange && onViewRoleChange(r)}
              title={youRole === r ? `${ROLE_LABEL[r]} — your role` : `See top ${ROLE_LABEL[r]} picks for this draft`}
            >
              <img
                src={ROLE_ICON[r]}
                alt=""
                className="rec-role-btn-icon"
                onError={e => { e.target.style.visibility = 'hidden' }}
              />
              <span className="rec-role-btn-label">{ROLE_LABEL_SHORT[r]}</span>
              {youRole === r && <span className="rec-role-you-dot">YOU</span>}
            </button>
          ))}
        </div>
      </div>

      {playerRole !== youRole && youRole && (
        <div className="rec-advising-banner">
          <span>Showing top <strong>{ROLE_LABEL[playerRole]}</strong> picks for this draft — advising, not your role.</span>
          <button onClick={() => onViewRoleChange && onViewRoleChange(youRole)}>
            ↩ Back to your role · {ROLE_LABEL[youRole]}
          </button>
        </div>
      )}

      {/* Overall / My Champions tabs */}
      <div className="rec-main-tabs">
        <button
          className={`rec-main-tab ${recTab === 'overall' ? 'rec-main-tab--active' : ''}`}
          onClick={() => setRecTab('overall')}
        >Overall</button>
        <button
          className={`rec-main-tab ${recTab === 'pool' ? 'rec-main-tab--active' : ''}`}
          onClick={() => setRecTab('pool')}
        >
          My Champions
          {poolResults.length > 0 && (
            <span className="rec-tab-count">{poolResults.length}</span>
          )}
        </button>
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
        <div className="rec-toolbar-spacer" />

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

        {refreshing && <span className="rec-refreshing">Updating…</span>}
      </div>

      {recTab === 'overall' && (
        <>
          <SortHeaders sortMode={sortMode} onSort={(m) => setSortMode(s => s === m ? 'rating' : m)} />
          <div className="rec-grid rec-grid--row">
            {sorted.map(({ rec, origIdx }, rank) => (
              <RecCard
                key={origIdx}
                rec={rec}
                rank={rank + 1}
                isSelected={selectedIndex === origIdx}
                onSelect={() => {
                  if (selectedIndex !== origIdx) trackEvent('view_breakdown', { category: 'engagement', label: rec.champion })
                  onSelect(selectedIndex === origIdx ? null : origIdx)
                }}
                config={config}
                playerRole={playerRole}
                wrModifiers={wrModifiers}
                sortMode={sortMode}
                breakdownRef={selectedIndex === origIdx ? breakdownRef : null}
                inPool={poolChampions.has(rec.champion.toLowerCase())}
              />
            ))}
          </div>
        </>
      )}

      {recTab === 'pool' && (
        <>
          <SortHeaders sortMode={sortMode} onSort={(m) => setSortMode(s => s === m ? 'rating' : m)} />
          <div className="rec-grid rec-grid--row">
            {sortedPool.length === 0 ? (
              <div className="pool-results-empty">
                Add champions to your pool in Settings → My Champions.
              </div>
            ) : (
              sortedPool.map((rec, idx) => (
                <RecCard
                  key={rec.champion}
                  rec={rec}
                  rank="★"
                  isSelected={selectedPoolRec === idx}
                  onSelect={() => onSelectPoolRec(selectedPoolRec === idx ? null : idx)}
                  config={config}
                  playerRole={playerRole}
                  wrModifiers={wrModifiers}
                  sortMode={sortMode}
                  breakdownRef={selectedPoolRec === idx ? poolBreakdownRef : null}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
