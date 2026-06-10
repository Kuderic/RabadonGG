/* ============================================================================
   Rabadon.GG core prototype — Results (RecommendationList + Breakdown)
   Redesign in this file:
     • Sort: Synergy / Counter are now clickable COLUMN HEADERS above their
       value columns (WR+Δ / Δ-only remain the primary sort in the toolbar).
     • Bug fix: the "in your pool" marker on an Overall row is rendered INSIDE
       .card-champion-name, never as a stray child of .card-header — so the
       5-column row grid is never disturbed.
   ========================================================================== */
const { useState: rlState, useMemo: rlMemo, useRef: rlRef, useEffect: rlEffect, Fragment: RLFragment } = React;

/* ── scoring (ported from utils/scoring.js) ──────────────────────────────── */
function getMultiplier(n, config) {
  if (!config?.penalize) return 1;
  if (!n || n <= 0) return 0;
  if (n >= config.penalizeThreshold) return 1;
  return n / config.penalizeThreshold;
}
function computeComponents(rec, config, playerRole, modifiers = {}) {
  const parseD = str => parseFloat(str) || 0;
  const rw = config?.roleWeights?.[playerRole];
  const enemyW = rw?.enemy || {};
  const allyW = rw?.ally || {};
  const blend = rw?.blend || { counter: 1, synergy: 1 };
  const adjSyn = (rec.synergy_breakdown || []).reduce((s, b) => s + parseD(b.delta) * getMultiplier(b.n, config) * (allyW[b.role] ?? 1), 0);
  const adjCtr = (rec.counter_breakdown || []).reduce((s, b) => s + parseD(b.delta) * getMultiplier(b.n, config) * (enemyW[b.role] ?? 1), 0);
  const synContrib = blend.synergy * adjSyn;
  const ctrContrib = blend.counter * adjCtr;
  const customOffset = modifiers?.[rec.champion] ?? 0;
  return { adjSyn, adjCtr, synContrib, ctrContrib, totalDelta: synContrib + ctrContrib + customOffset, customOffset, blend };
}
function computeAdjustedScore(rec, sortMode, config, playerRole, modifiers) {
  const { synContrib, ctrContrib, totalDelta } = computeComponents(rec, config, playerRole, modifiers);
  if (sortMode === 'delta') return totalDelta;
  if (sortMode === 'synergy') return synContrib;
  if (sortMode === 'counter') return ctrContrib;
  return rec.win_rate + totalDelta;
}
const rlImgErr = e => { e.target.style.visibility = 'hidden'; };

function RankBadge({ rank }) {
  const cls = rank <= 3 ? `rank-badge rank-${rank}` : 'rank-badge rank-other';
  return <span className={cls}><span className="rank-num">{rank}</span></span>;
}
function ExternalLink({ champion }) {
  return (
    <a href={`https://lolalytics.com/lol/${RBG.champSlug(champion)}/build/`} target="_blank" rel="noopener noreferrer"
       className="lola-link bp-lola-link" title={`Open ${champion} on lolalytics.com`} onClick={e => e.stopPropagation()}>
      <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 1h4v4M11 1L5.5 6.5M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
function StarGlyph() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M7 1l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 9.3l-3.2 1.6.6-3.6L1.8 4.8l3.6-.5z" />
    </svg>
  );
}
function PoolBadge() {
  return <span className="pool-badge" title="In your pool"><StarGlyph /></span>;
}
/* The FIX: in-pool marker lives inside the champion name (a single grid cell),
   so it can never become an extra grid item that wraps the Overall row. */
function PoolStar() {
  return <span className="card-pool-star" title="In your champion pool"><StarGlyph /></span>;
}

function hasLowN(rec, config) {
  if (!config?.penalize) return false;
  return [...(rec.synergy_breakdown || []), ...(rec.counter_breakdown || [])].some(b => b.n > 0 && b.n < config.penalizeThreshold);
}

function RecCard({ rec, rank, isSelected, onSelect, config, playerRole, sortMode, breakdownRef, inPool, wrModifiers = {} }) {
  const isPool = rank === '★';
  const lowN = hasLowN(rec, config);
  const { adjSyn, adjCtr, totalDelta, customOffset } = computeComponents(rec, config, playerRole, wrModifiers);
  const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
  return [
    <div key="card" className={`recommendation-card ${isPool ? 'pool-card' : ''} ${!isPool && inPool ? 'in-pool' : ''} ${isSelected ? 'card-selected' : ''}`} onClick={onSelect}>
        <div className="card-header">
          {isPool ? <PoolBadge /> : <RankBadge rank={rank} />}
          <img src={RBG.iconUrl(rec.champion)} alt={rec.champion} className="card-champ-icon" onError={rlImgErr} />
          <span className="card-champion-name">
            {rec.champion}
            {!isPool && inPool && <PoolStar />}
            <ExternalLink champion={rec.champion} />
          </span>
          <div className="card-stats">
            <div className="card-wr-line">
              <span className="card-win-rate">{rec.win_rate.toFixed(1)}%</span>
              <span className={`card-wr-delta ${totalDelta >= 0 ? 'positive' : 'negative'}`}>{fmt(totalDelta)}</span>
              {lowN && <span className="low-n-warning" title="Some matchups have low sample size — score is weighted down">⚠</span>}
            </div>
            {customOffset !== 0 && (
              <div className="card-modifier-line">
                <span className={`custom-modifier-badge ${customOffset > 0 ? 'positive' : 'negative'}`} title={`Custom WR modifier: ${customOffset > 0 ? '+' : ''}${customOffset}%`}>✎ {customOffset > 0 ? '+' : ''}{customOffset}%</span>
              </div>
            )}
            {rec.total_games > 0 && <span className="card-total-games">{(rec.total_games / 1000).toFixed(0)}K games</span>}
          </div>
        </div>
        <div className="card-deltas">
          <div className={`delta-cell ${sortMode === 'synergy' ? 'delta-cell--sorted' : ''}`}>
            <div className="delta-label">Synergy</div>
            <div className={`delta-value ${adjSyn >= 0 ? 'positive' : 'negative'}`}>{fmt(adjSyn)}</div>
          </div>
          <div className={`delta-cell ${sortMode === 'counter' ? 'delta-cell--sorted' : ''}`}>
            <div className="delta-label">Counter</div>
            <div className={`delta-value ${adjCtr >= 0 ? 'positive' : 'negative'}`}>{fmt(adjCtr)}</div>
          </div>
        </div>
        <button className="card-details-toggle">{isSelected ? '▲ collapse' : '▼ details'}</button>
    </div>,
    isSelected ? (
      <div key="bd" ref={breakdownRef} className="breakdown-inline">
        <BreakdownPanel rec={rec} rank={rank} onClose={onSelect} settings={config} playerRole={playerRole} modifiers={wrModifiers} />
      </div>
    ) : null,
  ];
}

const RL_ROLE_LABEL = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Support' };

function SortHeaders({ sortMode, onSort }) {
  const caret = (mode) => sortMode === mode ? <span className="sort-caret">▼</span> : <span className="sort-caret">▼</span>;
  return (
    <div className="rec-col-headers" role="row">
      <div className="rec-col-head-pick">Pick</div>
      <div className="rec-col-deltas">
        <button type="button" className={`rec-col-sort ${sortMode === 'synergy' ? 'rec-col-sort--active' : ''}`}
                onClick={() => onSort('synergy')} title="Sort by synergy with your allies">
          Synergy {caret('synergy')}
        </button>
        <button type="button" className={`rec-col-sort ${sortMode === 'counter' ? 'rec-col-sort--active' : ''}`}
                onClick={() => onSort('counter')} title="Sort by counter vs. enemies">
          Counter {caret('counter')}
        </button>
      </div>
      <div className="rec-col-head-wr">Win rate</div>
    </div>
  );
}

function RecommendationList({ recommendations, loading, refreshing, selectedIndex, onSelect, config, playerRole, youRole, viewRole, onViewRoleChange, onTogglePenalty, poolResults = [], selectedPoolRec, onSelectPoolRec, poolChampions = new Set(), wrModifiers = {} }) {
  const [sortMode, setSortMode] = rlState('rating');
  const [recTab, setRecTab] = rlState('overall');
  const breakdownRef = rlRef(null);
  const poolBreakdownRef = rlRef(null);

  rlEffect(() => {
    if (selectedIndex !== null && breakdownRef.current) {
      requestAnimationFrame(() => breakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
  }, [selectedIndex]);

  const { sorted, penalizedCount } = rlMemo(() => {
    if (!recommendations.length) return { sorted: [], penalizedCount: 0 };
    let penalizedCount = 0;
    if (config?.penalize) for (const rec of recommendations) {
      penalizedCount += [...(rec.synergy_breakdown || []), ...(rec.counter_breakdown || [])].filter(b => b.n > 0 && b.n < config.penalizeThreshold).length;
    }
    const sorted = [...recommendations].map((rec, origIdx) => ({ rec, origIdx }))
      .sort((a, b) => computeAdjustedScore(b.rec, sortMode, config, playerRole, wrModifiers) - computeAdjustedScore(a.rec, sortMode, config, playerRole, wrModifiers));
    return { sorted, penalizedCount };
  }, [recommendations, sortMode, config, playerRole, wrModifiers]);

  const sortedPool = rlMemo(() => {
    if (!poolResults.length) return [];
    return [...poolResults].sort((a, b) => computeAdjustedScore(b, sortMode, config, playerRole, wrModifiers) - computeAdjustedScore(a, sortMode, config, playerRole, wrModifiers));
  }, [poolResults, sortMode, config, playerRole, wrModifiers]);

  if (loading) return <div className="recommendations-loading"><span className="spinner" /> Analyzing draft...</div>;
  if (recommendations.length === 0) return <div className="recommendations-empty">Enter your draft above to get recommendations</div>;

  return (
    <div className="recommendations-list">
      <div className="rec-panel-heading">
        <span className="rec-panel-title">Recommended Picks</span>
        <div className="rec-role-switch" role="tablist" aria-label="View top picks for a role">
          {RBG.ROLES.map(r => (
            <button key={r} role="tab" aria-selected={playerRole === r}
              className={`rec-role-btn ${playerRole === r ? 'rec-role-btn--active' : ''}`}
              onClick={() => onViewRoleChange && onViewRoleChange(r)}
              title={youRole === r ? `${RBG.ROLE_DISPLAY[r]} — your role` : `See top ${RBG.ROLE_DISPLAY[r]} picks for this draft`}>
              <img src={RBG.ROLE_ICON[r]} alt="" className="rec-role-btn-icon" onError={rlImgErr} />
              <span className="rec-role-btn-label">{RBG.ROLE_LABEL_SHORT[r]}</span>
              {youRole === r && <span className="rec-role-you-dot">YOU</span>}
            </button>
          ))}
        </div>
      </div>

      {playerRole !== youRole && (
        <div className="rec-advising-banner">
          <span>Showing top <strong>{RBG.ROLE_DISPLAY[playerRole]}</strong> picks for this draft — advising, not your role.</span>
          <button onClick={() => onViewRoleChange(youRole)}>↩ Back to your role · {RBG.ROLE_DISPLAY[youRole]}</button>
        </div>
      )}

      <div className="rec-main-tabs">
        <button className={`rec-main-tab ${recTab === 'overall' ? 'rec-main-tab--active' : ''}`} onClick={() => setRecTab('overall')}>Overall</button>
        <button className={`rec-main-tab ${recTab === 'pool' ? 'rec-main-tab--active' : ''}`} onClick={() => setRecTab('pool')}>
          My Champions
          {poolResults.length > 0 && <span className="rec-tab-count">{poolResults.length}</span>}
        </button>
      </div>

      <div className="rec-toolbar">
        <span className="rec-toolbar-label">Sort by</span>
        <button className={`sort-btn ${sortMode === 'rating' ? 'sort-btn--active' : ''}`} onClick={() => setSortMode('rating')}>WR + Δ</button>
        <button className={`sort-btn ${sortMode === 'delta' ? 'sort-btn--active' : ''}`} onClick={() => setSortMode('delta')}>Δ only</button>
        <div className="rec-toolbar-spacer" />
        <label className="penalty-toggle" title="Weight matchups with fewer games than the threshold (configure in Configuration)">
          <input type="checkbox" checked={!!config?.penalize} onChange={onTogglePenalty} /> Penalize low sample
        </label>
        {config?.penalize && (
          <span className={`penalty-count ${penalizedCount > 0 ? 'penalty-count--active' : 'penalty-count--none'}`}>
            {penalizedCount > 0 ? `${penalizedCount} weighted` : 'no effect'}
          </span>
        )}
        {refreshing && <span className="rec-refreshing">Updating…</span>}
      </div>

      <SortHeaders sortMode={sortMode} onSort={(m) => setSortMode(s => s === m ? 'rating' : m)} />

      {recTab === 'overall' && (
        <div className="rec-grid rec-grid--row">
          {sorted.map(({ rec, origIdx }, rank) => (
            <RecCard key={origIdx} rec={rec} rank={rank + 1}
              isSelected={selectedIndex === origIdx}
              onSelect={() => onSelect(selectedIndex === origIdx ? null : origIdx)}
              config={config} playerRole={playerRole} sortMode={sortMode}
              breakdownRef={selectedIndex === origIdx ? breakdownRef : null}
              inPool={poolChampions.has(rec.champion.toLowerCase())} wrModifiers={wrModifiers} />
          ))}
        </div>
      )}

      {recTab === 'pool' && (
        <div className="rec-grid rec-grid--row">
          {sortedPool.length === 0 ? (
            <div className="pool-results-empty">Add champions to your pool in Settings → My Champions.</div>
          ) : (
            sortedPool.map((rec, idx) => (
              <RecCard key={rec.champion} rec={rec} rank="★"
                isSelected={selectedPoolRec === idx}
                onSelect={() => onSelectPoolRec(selectedPoolRec === idx ? null : idx)}
                config={config} playerRole={playerRole} sortMode={sortMode}
                breakdownRef={selectedPoolRec === idx ? poolBreakdownRef : null} wrModifiers={wrModifiers} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Breakdown panel ─────────────────────────────────────────────────────── */
function BreakdownRow({ champion, role, delta, n, missing, settings, isEmpty }) {
  if (isEmpty) return <div className="bd-row bd-row--empty" />;
  if (!champion) return null;
  const isPos = (delta || '').startsWith('+');
  const mult = missing ? 1 : getMultiplier(n, settings);
  const showMult = settings?.penalize && !missing && mult < 1;
  const isLowN = !missing && n > 0 && n < (settings?.penalizeThreshold || 1000);
  return (
    <div className={`bd-row ${missing ? 'bd-row--missing' : ''}`}>
      <img src={RBG.iconUrl(champion)} alt={champion} className="bd-icon" loading="lazy" onError={rlImgErr} />
      <span className="bd-champ">{champion}</span>
      <span className="bd-role">{RBG.ROLE_LABEL_SHORT[role] || (role || '').toUpperCase()}</span>
      {missing ? <span className="bd-no-data">no data</span> : <>
        <span className={`bd-delta ${isPos ? 'positive' : 'negative'}`}>{delta}</span>
        <span className={`bd-n ${isLowN ? 'bd-n--low' : ''}`}>{isLowN && <span className="bd-warn">⚠</span>}n={n?.toLocaleString()}</span>
        {showMult && <span className="bd-mult" title={`Only ${n?.toLocaleString()} games — ${Math.round(mult * 100)}% weight applied`}>×{mult.toFixed(2)}</span>}
      </>}
    </div>
  );
}
function BreakdownPanel({ rec, rank, onClose, settings, playerRole, splash = true, modifiers = {} }) {
  const { synContrib, ctrContrib, totalDelta, blend } = computeComponents(rec, settings, playerRole, modifiers);
  const adjRating = rec.win_rate + totalDelta;
  const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
  const synRows = [...(rec.synergy_breakdown || []).map(b => ({ ...b, missing: false })), ...(rec.synergy_missing || []).map(name => ({ champion: name, missing: true }))];
  const ctrRows = [...(rec.counter_breakdown || []).map(b => ({ ...b, missing: false })), ...(rec.counter_missing || []).map(name => ({ champion: name, missing: true }))];
  const maxRows = Math.max(synRows.length, ctrRows.length, 1);
  while (synRows.length < maxRows) synRows.push(null);
  while (ctrRows.length < maxRows) ctrRows.push(null);
  const hasSynergy = synRows.some(r => r !== null);
  const hasCounter = ctrRows.some(r => r !== null);
  return (
    <div className="breakdown-panel-full">
      {splash && <div className="bp-splash" style={{ backgroundImage: `url(${RBG.splashUrl(rec.champion)})` }} />}
      <div className="bp-header">
        <div className="bp-title">
          {rank === '★' ? <PoolBadge /> : <RankBadge rank={rank} />}
          <img src={RBG.iconUrl(rec.champion)} alt={rec.champion} className="bp-champ-icon" onError={rlImgErr} />
          <span className="bp-champ-name">{rec.champion}</span>
          <span className="bp-wr">{rec.win_rate.toFixed(1)}% WR</span>
          {rec.total_games > 0 && <span className="bp-games">{(rec.total_games / 1000).toFixed(0)}K games</span>}
          <ExternalLink champion={rec.champion} />
        </div>
        <button className="bp-close" onClick={onClose}>✕</button>
      </div>
      <div className="bp-summary">
        <div className="bp-summary-item"><span className="bp-summary-label">Rating</span><span className="bp-summary-value rating-value">{adjRating.toFixed(1)}%</span></div>
        <div className="bp-summary-divider" />
        <div className="bp-summary-item"><span className="bp-summary-label">Base WR</span><span className="bp-summary-value neutral-value">{rec.win_rate.toFixed(1)}%</span></div>
        <div className="bp-summary-plus">+</div>
        <div className={`bp-summary-item ${synContrib >= 0 ? 'positive' : 'negative'}`}>
          <span className="bp-summary-label">Synergy{blend.synergy !== 1 && <span className="bp-blend-factor">×{blend.synergy.toFixed(2)}</span>}</span>
          <span className="bp-summary-value">{fmt(synContrib)}</span>
        </div>
        <div className="bp-summary-plus">+</div>
        <div className={`bp-summary-item ${ctrContrib >= 0 ? 'positive' : 'negative'}`}>
          <span className="bp-summary-label">Counter{blend.counter !== 1 && <span className="bp-blend-factor">×{blend.counter.toFixed(2)}</span>}</span>
          <span className="bp-summary-value">{fmt(ctrContrib)}</span>
        </div>
        <div className="bp-summary-divider" />
        <div className={`bp-summary-item ${totalDelta >= 0 ? 'positive' : 'negative'}`}><span className="bp-summary-label">Total Δ</span><span className="bp-summary-value">{fmt(totalDelta)}</span></div>
        <div className="bp-summary-note">Rating = WR + (counter_mult × Σctr Δ × role_wt) + (synergy_mult × Σsyn Δ × role_wt){settings?.penalize ? ` · n<${settings.penalizeThreshold.toLocaleString()} penalized` : ''}</div>
      </div>
      <div className="bp-columns">
        {hasSynergy && (
          <div className="bp-col">
            <div className="bp-col-title ally-title">Ally Synergy</div>
            {synRows.map((row, i) => row === null ? <BreakdownRow key={`syn-spacer-${i}`} isEmpty settings={settings} /> : <BreakdownRow key={`syn-${row.champion}`} {...row} settings={settings} />)}
          </div>
        )}
        {hasCounter && (
          <div className="bp-col">
            <div className="bp-col-title enemy-title">Enemy Counter</div>
            {ctrRows.map((row, i) => row === null ? <BreakdownRow key={`ctr-spacer-${i}`} isEmpty settings={settings} /> : <BreakdownRow key={`ctr-${row.champion}`} {...row} settings={settings} />)}
          </div>
        )}
        {!hasSynergy && !hasCounter && <div className="bp-empty">No matchup data available for this draft.</div>}
      </div>
      {rec.data_warnings?.length > 0 && (
        <div className="bp-warnings">{rec.data_warnings.map((w, i) => <div key={i} className="warning-item">{w}</div>)}</div>
      )}
    </div>
  );
}

Object.assign(window, { RecommendationList, BreakdownPanel, computeComponents });
