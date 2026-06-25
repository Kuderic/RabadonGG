import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import { champIconUrl, champDDragonKey, filterChampions } from '../utils/champion'
import { computeComponents } from '../utils/scoring'
import { RankBadge, ExternalLink } from './ChampionShared'
import BreakdownPanel from './BreakdownPanel'
import { trackEvent } from '../utils/analytics'

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']
const ROLE_LABEL = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'Bot', support: 'Support' }
const ROLE_LABEL_SHORT = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'BOT', support: 'SUP' }
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

function PoolStar({ onClick }) {
  if (onClick) {
    return (
      <button
        className="card-pool-star card-pool-star--remove"
        title="Remove from your champion pool"
        onClick={e => { e.stopPropagation(); onClick() }}
        type="button"
      >
        <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          <path d="M7 1l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.3l-3.2 1.6.6-3.6L1.8 4.8l3.6-.5z"/>
        </svg>
      </button>
    )
  }
  return (
    <span className="card-pool-star" title="In your champion pool">
      <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <path d="M7 1l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.3l-3.2 1.6.6-3.6L1.8 4.8l3.6-.5z"/>
      </svg>
    </span>
  )
}

function AddToPoolStar({ onClick }) {
  return (
    <button
      className="card-pool-star-add"
      title="Add to your champion pool for this role"
      onClick={e => { e.stopPropagation(); onClick() }}
      type="button"
    >
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M7 1l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.3l-3.2 1.6.6-3.6L1.8 4.8l3.6-.5z"/>
      </svg>
    </button>
  )
}

function LookupBadge() {
  return (
    <span className="lookup-badge" title="Champion lookup">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="5.5" cy="5.5" r="3.5"/>
        <line x1="8.5" y1="8.5" x2="12" y2="12"/>
      </svg>
    </span>
  )
}

function LookupInput({ lookupChampion, champions, onLookupChange }) {
  const [query, setQuery] = useState(lookupChampion || '')
  const [open, setOpen] = useState(false)
  const [filtered, setFiltered] = useState([])
  const [cursor, setCursor] = useState(0)
  const wrapRef = useRef(null)

  useEffect(() => { setQuery(lookupChampion || '') }, [lookupChampion])

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleInput = v => {
    setQuery(v)
    if (v.trim().length === 0) { setOpen(false); setFiltered([]); if (lookupChampion) onLookupChange(null); return }
    const exact = champions.find(c => c.toLowerCase() === v.trim().toLowerCase())
    if (exact) { onLookupChange(exact); setOpen(false); setFiltered([]); return }
    const matches = filterChampions(champions, v)
    setFiltered(matches)
    setOpen(matches.length > 0)
    setCursor(0)
  }

  const select = name => { setQuery(name); setOpen(false); setCursor(0); onLookupChange(name) }

  const handleKeyDown = e => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'Backspace' && lookupChampion && query === lookupChampion) { e.preventDefault(); setQuery(''); onLookupChange(null); return }
    if (e.key === 'Enter' && open && filtered.length > 0) { e.preventDefault(); select(filtered[Math.max(0, cursor)]); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
  }

  const matchedChamp = champions.find(c => c.toLowerCase() === query.trim().toLowerCase()) ?? null

  return (
    <div className="lookup-input-wrap" ref={wrapRef}>
      {matchedChamp && (
        <img className="lookup-champ-icon" src={champIconUrl(matchedChamp)} alt="" onError={e => { e.target.style.display = 'none' }} />
      )}
      <input
        type="text"
        className="lookup-input"
        placeholder="Look up a champion…"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {lookupChampion && (
        <button className="lookup-clear" onClick={() => { setQuery(''); onLookupChange(null) }} title="Clear lookup">✕</button>
      )}
      {open && (
        <div className="champ-autocomplete">
          {filtered.map((name, i) => (
            <div
              key={name}
              className={`champ-ac-item ${i === cursor ? 'champ-ac-item--active' : ''}`}
              onMouseDown={() => select(name)}
              onMouseEnter={() => setCursor(i)}
            >
              <img src={champIconUrl(name)} alt="" className="champ-ac-icon" onError={e => { e.target.style.display = 'none' }} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecCard({ rec, rank, isPool, isSelected, onSelect, config, playerRole, wrModifiers, sortMode, breakdownRef, inPool, tier, patch, onAddToPool, onRemoveFromPool }) {
  const lowN = hasLowN(rec, config)
  const { adjSyn, adjCtr, totalDelta, customOffset } = computeComponents(rec, config, playerRole, wrModifiers)
  const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  const isLookup = rank === '?'

  return (
    <Fragment>
      <div
        className={`recommendation-card ${isPool ? 'pool-card' : ''} ${isLookup ? 'lookup-card' : ''} ${!isPool && !isLookup && inPool ? 'in-pool' : ''} ${isSelected ? 'card-selected' : ''}`}
        onClick={onSelect}
        onMouseEnter={!isPool ? () => {
          const img = new Image()
          img.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champDDragonKey(rec.champion)}_0.jpg`
        } : undefined}
      >
        <div className="card-header">
          {isLookup ? <LookupBadge /> : <RankBadge rank={rank} />}
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
            {!isPool && !isLookup && (inPool
              ? <PoolStar onClick={onRemoveFromPool ? () => onRemoveFromPool(rec.champion) : undefined} />
              : onAddToPool && <AddToPoolStar onClick={() => onAddToPool(rec.champion, playerRole)} />
            )}
            <ExternalLink champion={rec.champion} tier={tier} patch={patch} lane={playerRole} />
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
            tier={tier}
            patch={patch}
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

export default function RecommendationList({ recommendations, loading, refreshing, selectedIndex, onSelect, config, playerRole, youRole, onViewRoleChange, onTogglePenalty, poolResults = [], selectedPoolRec, onSelectPoolRec, wrModifiers = {}, poolChampions = new Set(), tier, patch, champions = [], lookupChampion, lookupResult, onLookupChange, onAddToPool, onRemoveFromPool, sortMode: externalSort, onSortModeChange }) {
  const [recTab, setRecTab] = useState('overall')
  const [sortOverall, setSortOverall] = useState(() => externalSort || 'wr_delta')
  const [sortPool, setSortPool]       = useState(() => externalSort || 'wr_delta')
  const sortMode    = recTab === 'pool' ? sortPool : sortOverall
  const setSortMode = (val) => {
    if (recTab === 'pool') setSortPool(val)
    else setSortOverall(val)
    onSortModeChange?.(val)
  }

  useEffect(() => {
    if (!externalSort) return
    setSortOverall(externalSort)
    setSortPool(externalSort)
  }, [externalSort])
  const [visibleCount, setVisibleCount] = useState(10)

  const breakdownRef = useRef(null)
  const poolBreakdownRef = useRef(null)

  useEffect(() => {
    if (selectedIndex !== null && breakdownRef.current) {
      requestAnimationFrame(() => {
        breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      })
    }
  }, [selectedIndex])

  useEffect(() => {
    setVisibleCount(10)
  }, [playerRole])

  const lookupRank = useMemo(() => {
    if (!lookupResult || !recommendations.length) return null
    const score = r => computeAdjustedScore(r, 'rating', config, playerRole, wrModifiers)
    // Prefer using the recommendations version of the champion to avoid pool_picks
    // scoring discrepancies that can make rank exceed field.
    const inRecs = recommendations.find(
      r => r.champion.toLowerCase() === lookupResult.champion.toLowerCase()
    )
    const refScore = score(inRecs ?? lookupResult)
    const rank = recommendations.filter(r =>
      r.champion.toLowerCase() !== lookupResult.champion.toLowerCase() && score(r) > refScore
    ).length + 1
    const field = inRecs ? recommendations.length : recommendations.length + 1
    return { rank, field }
  }, [lookupResult, recommendations, config, playerRole, wrModifiers])

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
        <span className="rec-panel-title">
          Recommended Picks
          {recommendations.length > 0 && (
            <span className="rec-result-count">{recommendations.length}</span>
          )}
        </span>
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
          className={`sort-btn ${sortMode !== 'delta' && sortMode !== 'synergy' && sortMode !== 'counter' ? 'sort-btn--active' : ''}`}
          onClick={() => setSortMode('wr_delta')}
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

      </div>

      {refreshing && (
        <div className="rec-analyzing-banner">
          <span className="spinner" />
          Analyzing draft…
        </div>
      )}

      <div className="lookup-row">
        <LookupInput lookupChampion={lookupChampion} champions={champions} onLookupChange={onLookupChange} />
      </div>

      {lookupChampion && (
        <div className="lookup-result-section">
          {lookupResult ? (
            <>
              {lookupRank != null && (
                <div className="lookup-rank-line">
                  Ranked <strong>#{lookupRank.rank}</strong> of {lookupRank.field} for this draft
                </div>
              )}
              <BreakdownPanel
                rec={lookupResult}
                rank={lookupRank?.rank ?? '?'}
                onClose={() => onLookupChange(null)}
                settings={config}
                playerRole={playerRole}
                modifiers={wrModifiers}
                tier={tier}
                patch={patch}
              />
            </>
          ) : !refreshing && (
            <div className="lookup-no-data">{lookupChampion} has no data for this role — they may not be played here.</div>
          )}
        </div>
      )}

      {recTab === 'overall' && (
        <>
          <SortHeaders sortMode={sortMode} onSort={(m) => setSortMode(sortMode === m ? 'wr_delta' : m)} />
          <div className="rec-grid rec-grid--row">
            {sorted.slice(0, visibleCount).map(({ rec, origIdx }, rank) => (
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
                tier={tier}
                patch={patch}
                onAddToPool={onAddToPool}
                onRemoveFromPool={onRemoveFromPool}
              />
            ))}
          </div>
          {visibleCount < sorted.length && (
            <button
              className="show-more-btn"
              onClick={() => setVisibleCount(v => Math.min(v + 10, 30))}
            >
              Show more · {Math.min(sorted.length - visibleCount, 10)} more picks
            </button>
          )}
        </>
      )}

      {recTab === 'pool' && (
        <>
          <SortHeaders sortMode={sortMode} onSort={(m) => setSortMode(sortMode === m ? 'wr_delta' : m)} />
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
                  rank={idx + 1}
                  isPool
                  isSelected={selectedPoolRec === idx}
                  onSelect={() => onSelectPoolRec(selectedPoolRec === idx ? null : idx)}
                  config={config}
                  playerRole={playerRole}
                  wrModifiers={wrModifiers}
                  sortMode={sortMode}
                  breakdownRef={selectedPoolRec === idx ? poolBreakdownRef : null}
                  tier={tier}
                  patch={patch}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
