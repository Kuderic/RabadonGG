/* ============================================================================
   Rabadon.GG core prototype — Configuration panel
   Redesign focus: MY CHAMPIONS. Two role-first layouts the user can compare
   in place via a segmented toggle:
     • Variant A "Lanes"   — five role containers; add straight into a lane.
     • Variant B "By role" — pick a role, see only that role, add to it.
   Both share one data model: pool = [{ champion, roles:[...] }]. A champion
   can sit in several roles. Removing its last role removes it from the pool.
   The rest of the panel (Population, Sample-size penalty, Role weighting,
   Display) mirrors the real ConfigPanel unchanged.
   ========================================================================== */
const { useState: cfgState, useRef: cfgRef, useEffect: cfgEffect } = React;

const cfgImgErr = e => { e.target.style.visibility = 'hidden'; };
function cfgFilter(champions, query) {
  if (!query || query.length < 1) return [];
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const q = norm(query), ql = query.toLowerCase();
  const r = champions.filter(c => { const cn = norm(c), cl = c.toLowerCase(); return cn.startsWith(q) || cl.startsWith(ql) || cn.includes(q); });
  r.sort((a, b) => { const ap = norm(a).startsWith(q) ? 0 : 1, bp = norm(b).startsWith(q) ? 0 : 1; if (ap !== bp) return ap - bp; return a.localeCompare(b); });
  return r.slice(0, 8);
}

/* Shared champion search popover. onPick(name) is called on selection. */
function ChampionPicker({ champions, exclude = new Set(), placeholder, onPick, autoFocus }) {
  const [query, setQuery] = cfgState('');
  const [open, setOpen] = cfgState(false);
  const [active, setActive] = cfgState(0);
  const wrapRef = cfgRef(null);
  const inputRef = cfgRef(null);

  cfgEffect(() => {
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
  cfgEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const suggestions = query.length >= 1 ? cfgFilter(champions, query).filter(c => !exclude.has(c.toLowerCase())) : [];

  const pick = (name) => {
    const exact = champions.find(c => c.toLowerCase() === name.toLowerCase());
    if (!exact) return;
    onPick(exact);
    setQuery(''); setOpen(false); setActive(0);
    inputRef.current?.focus();
  };
  const onKey = (e) => {
    if (!open || suggestions.length === 0) { if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); pick(suggestions[0]); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[active] ?? suggestions[0]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  return (
    <div className="poolx-search" ref={wrapRef}>
      <input ref={inputRef} type="text" placeholder={placeholder} value={query} autoComplete="off" spellCheck="false"
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => { if (query) setOpen(true); }} onKeyDown={onKey} />
      {open && suggestions.length > 0 && (
        <div className="poolx-dropdown">
          {suggestions.map((c, i) => (
            <div key={c} className={`poolx-dd-item ${i === active ? 'is-active' : ''}`}
                 onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); pick(c); }}>
              <img src={RBG.iconUrl(c)} alt="" onError={cfgImgErr} />
              <span>{c}</span>
              {(RBG.CHAMP_ROLES[c] || []).length > 0 && (
                <span className="poolx-dd-roles">
                  {(RBG.CHAMP_ROLES[c] || []).map(r => <span key={r} className="poolx-dd-role">{RBG.ROLE_LABEL_SHORT[r]}</span>)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Variant A · Role lanes ──────────────────────────────────────────────── */
function PoolLanes({ pool, champions, onAddRole, onRemoveRole }) {
  return (
    <div className="pool-lanes">
      {RBG.ROLES.map(role => {
        const champs = pool.filter(p => p.roles.includes(role));
        const exclude = new Set(champs.map(c => c.champion.toLowerCase()));
        return (
          <div className="pool-lane" key={role}>
            <div className="pool-lane-head">
              <img src={RBG.ROLE_ICON[role]} alt="" onError={cfgImgErr} />
              <span className="pool-lane-title">{RBG.ROLE_LABEL_SHORT[role]}</span>
              <span className="pool-lane-n">{champs.length}</span>
            </div>
            <div className="pool-lane-body">
              {champs.length === 0
                ? <div className="pool-lane-empty">Add the champs you play here</div>
                : champs.map(c => (
                  <div className="pool-lane-card" key={c.champion}>
                    <img src={RBG.iconUrl(c.champion)} alt="" onError={cfgImgErr} />
                    <span className="pool-lane-card-name">{c.champion}</span>
                    <button className="pool-lane-card-x" onClick={() => onRemoveRole(c.champion, role)} aria-label={`Remove ${c.champion} from ${role}`}>✕</button>
                  </div>
                ))}
            </div>
            <div className="pool-lane-addrow">
              <ChampionPicker champions={champions} exclude={exclude}
                placeholder={`+ Add to ${RBG.ROLE_LABEL_SHORT[role]}`}
                onPick={name => onAddRole(name, role)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Variant B · Role picker + filtered list ─────────────────────────────── */
function PoolByRole({ pool, champions, onAddRole, onRemoveRole, onToggleRole }) {
  const [role, setRole] = cfgState('adc');
  const champs = pool.filter(p => p.roles.includes(role));
  const exclude = new Set(champs.map(c => c.champion.toLowerCase()));
  return (
    <div>
      <div className="pool-byrole-bar">
        <div className="pool-rolepick">
          {RBG.ROLES.map(r => {
            const n = pool.filter(p => p.roles.includes(r)).length;
            return (
              <button key={r} className={role === r ? 'is-active' : ''} onClick={() => setRole(r)}>
                <img src={RBG.ROLE_ICON[r]} alt="" onError={cfgImgErr} />
                {RBG.ROLE_LABEL_SHORT[r]}
                {n > 0 && <span className="pool-rolepick-n">{n}</span>}
              </button>
            );
          })}
        </div>
        <ChampionPicker champions={champions} exclude={exclude}
          placeholder={`Add a champion to ${RBG.ROLE_DISPLAY[role]}…`}
          onPick={name => onAddRole(name, role)} autoFocus />
      </div>
      <div className="pool-byrole-context">
        Showing your <strong>{RBG.ROLE_DISPLAY[role]}</strong> pool — {champs.length} champion{champs.length === 1 ? '' : 's'}. New adds go straight to this role.
      </div>
      {champs.length === 0 ? (
        <div className="pool-byrole-empty">No {RBG.ROLE_DISPLAY[role]} champions yet. Type above to add the ones you play.</div>
      ) : (
        <div className="pool-byrole-list">
          {champs.map(c => (
            <div className="pool-byrole-row" key={c.champion}>
              <img src={RBG.iconUrl(c.champion)} alt="" onError={cfgImgErr} />
              <span className="pool-byrole-row-name">{c.champion}</span>
              <div className="pool-byrole-flex" title="Also plays this champion in…">
                {RBG.ROLES.filter(r => r !== role).map(r => (
                  <button key={r} className={`pool-byrole-flexrole ${c.roles.includes(r) ? 'is-on' : ''}`}
                    onClick={() => onToggleRole(c.champion, r)} title={`Toggle ${c.champion} in ${RBG.ROLE_DISPLAY[r]}`}>
                    {RBG.ROLE_LABEL_SHORT[r]}
                  </button>
                ))}
              </div>
              <button className="pool-byrole-row-x" onClick={() => onRemoveRole(c.champion, role)} aria-label={`Remove ${c.champion} from ${role}`}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChampionPoolPanel({ variant, onVariantChange, pool, champions, onAddRole, onRemoveRole, onToggleRole }) {
  const total = pool.length;
  return (
    <div className="config-section pool-panel">
      <div className="pool-panel-head">
        <div>
          <div className="config-section-title">My Champions</div>
          <p className="pool-description" style={{ margin: '6px 0 0' }}>
            Build your pool once, by role. These power the <strong>My Champions</strong> tab in your results — scored against every draft.
          </p>
        </div>
        <div className="pool-variant-toggle" role="tablist" aria-label="My Champions layout">
          <button className={variant === 'lanes' ? 'is-active' : ''} onClick={() => onVariantChange('lanes')}>Lanes</button>
          <button className={variant === 'byrole' ? 'is-active' : ''} onClick={() => onVariantChange('byrole')}>By role</button>
        </div>
      </div>

      {variant === 'lanes'
        ? <PoolLanes pool={pool} champions={champions} onAddRole={onAddRole} onRemoveRole={onRemoveRole} />
        : <PoolByRole pool={pool} champions={champions} onAddRole={onAddRole} onRemoveRole={onRemoveRole} onToggleRole={onToggleRole} />}

      <div className="pool-variant-note">
        {variant === 'lanes'
          ? 'Lanes — see your whole pool at a glance. Add a champion straight into any role; the same champion can live in several lanes.'
          : 'By role — pick the role you’re building, and only that role’s champions show. Fastest when you main one or two positions.'}
        <span className="pool-total-count" style={{ marginLeft: 8 }}>· {total} champion{total === 1 ? '' : 's'} total</span>
      </div>
    </div>
  );
}

/* ── Custom WR modifiers ─────────────────────────────────────────────────── */
function CustomModifiersPanel({ wrModifiers = {}, onModifierChange, champions = [] }) {
  const modified = Object.keys(wrModifiers);
  const exclude = new Set(modified.map(m => m.toLowerCase()));
  return (
    <div className="config-section">
      <div className="config-section-title">Custom Modifiers</div>
      <p className="config-desc">Apply a custom WR adjustment to any champion to make them rank higher or lower in recommendations — useful when you think a champion is stronger or weaker than their win rate indicates.</p>
      <div style={{ marginBottom: 16 }}>
        <ChampionPicker champions={champions} exclude={exclude} placeholder="Search for a champion to adjust…" onPick={name => onModifierChange(name, 1)} />
      </div>
      {modified.length === 0 ? (
        <div className="pool-empty">No modifiers set. Search for a champion above to add one.</div>
      ) : (
        <div className="modifier-list">
          {modified.map(champion => {
            const value = wrModifiers[champion] ?? 0;
            return (
              <div key={champion} className="modifier-row">
                <img src={RBG.iconUrl(champion)} alt="" className="modifier-row-icon" onError={cfgImgErr} />
                <span className="modifier-row-name">{champion}</span>
                <div className="modifier-row-input-wrap">
                  <input type="number" className={`pool-modifier-input${value !== 0 ? ' pool-modifier-input--active' : ''}`}
                    value={value} step="0.5" min="-10" max="10" aria-label={`WR modifier for ${champion}`}
                    onChange={e => onModifierChange(champion, parseFloat(e.target.value) || 0)}
                    onBlur={e => { let v = parseFloat(e.target.value) || 0; v = Math.max(-10, Math.min(10, Math.round(v * 2) / 2)); onModifierChange(champion, v); }} />
                  <span className="pool-modifier-pct">%</span>
                </div>
                <button className="pool-pill-remove" onClick={() => onModifierChange(champion, 0)} aria-label={`Remove modifier for ${champion}`}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Role weighting + the rest (unchanged from real ConfigPanel) ─────────── */
const CFG_ALLY_SLOTS = { top: ['jungle', 'mid', 'adc', 'support'], jungle: ['top', 'mid', 'adc', 'support'], mid: ['top', 'jungle', 'adc', 'support'], adc: ['top', 'jungle', 'mid', 'support'], support: ['top', 'jungle', 'mid', 'adc'] };
function WeightSlider({ role, value, onChange }) {
  return (
    <div className="weight-row">
      <span className="weight-role">{RBG.ROLE_LABEL_SHORT[role]}</span>
      <input type="range" className="weight-slider" min={0} max={1} step={0.05} value={value} onChange={e => onChange(+e.target.value)} />
      <span className="weight-val">{value.toFixed(2)}</span>
    </div>
  );
}

function ConfigPanel({ config, onChange, defaultConfig, patch, tier, availablePatches, onPatchChange, onTierChange, poolVariant, onPoolVariantChange, pool, champions, onAddRole, onRemoveRole, onToggleRole, lowDetail, onLowDetailChange, wrModifiers = {}, onModifierChange }) {
  const [viewRole, setViewRole] = cfgState('adc');
  const weights = config.roleWeights?.[viewRole] || {};
  const allySlots = CFG_ALLY_SLOTS[viewRole] || [];
  const setEnemy = (role, v) => onChange({ ...config, roleWeights: { ...config.roleWeights, [viewRole]: { ...weights, enemy: { ...(weights.enemy || {}), [role]: v } } } });
  const setAlly = (role, v) => onChange({ ...config, roleWeights: { ...config.roleWeights, [viewRole]: { ...weights, ally: { ...(weights.ally || {}), [role]: v } } } });
  const setBlend = (key, v) => onChange({ ...config, roleWeights: { ...config.roleWeights, [viewRole]: { ...weights, blend: { ...(weights.blend || {}), [key]: v } } } });
  const ctrBlend = weights.blend?.counter ?? 0.5;
  const synBlend = weights.blend?.synergy ?? 0.5;
  const RL = RBG.ROLE_DISPLAY;

  return (
    <div className="config-panel">
      <div className="config-section">
        <div className="config-section-title">Population</div>
        <p className="config-desc">The data set used for all synergy and counter calculations. Larger sample sizes are more reliable; 30 Days aggregates across all recent patches.</p>
        <div className="config-row">
          <div className="config-inline-label">
            <label htmlFor="config-patch-select" className="config-field-label">Patch</label>
            <select id="config-patch-select" className="config-select" value={patch} onChange={e => onPatchChange(e.target.value)}>
              <option value="30">30 Days</option>
              {availablePatches?.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="config-inline-label"><span className="config-field-label">Tier</span><TierSelector value={tier} onChange={onTierChange} /></div>
        </div>
      </div>

      <ChampionPoolPanel
        variant={poolVariant} onVariantChange={onPoolVariantChange}
        pool={pool} champions={champions}
        onAddRole={onAddRole} onRemoveRole={onRemoveRole} onToggleRole={onToggleRole} />

      <CustomModifiersPanel wrModifiers={wrModifiers} onModifierChange={onModifierChange} champions={champions} />

      <div className="config-section">
        <div className="config-section-title">Sample Size Penalty</div>
        <p className="config-desc">Matchups with fewer games than the threshold are less statistically reliable. The penalty linearly scales each matchup's contribution from 0 (no data) up to full weight at the threshold.</p>
        <div className="config-row">
          <label className="config-check-label"><input type="checkbox" checked={config.penalize} onChange={e => onChange({ ...config, penalize: e.target.checked })} /> Enable sample size weighting</label>
        </div>
        <div className={`config-row ${!config.penalize ? 'config-row--disabled' : ''}`}>
          <label className="config-inline-label">Full weight at n ≥
            <input type="number" className="config-number" value={config.penalizeThreshold} min={100} max={10000} step={100} disabled={!config.penalize} onChange={e => onChange({ ...config, penalizeThreshold: Math.max(100, +e.target.value) })} /> games
          </label>
          <span className="config-hint">e.g. at threshold {config.penalizeThreshold.toLocaleString()}: n=500 games → ×{(500 / config.penalizeThreshold).toFixed(2)} weight</span>
        </div>
      </div>

      <div className="config-section">
        <div className="config-section-title">Role Weighting<span className="config-section-subtitle">How much each opposing/allied role's matchup data contributes to the final score</span></div>
        <div className="config-role-tabs">
          {RBG.ROLES.map(r => <button key={r} className={`config-role-tab ${viewRole === r ? 'config-role-tab--active' : ''}`} onClick={() => setViewRole(r)}>{RL[r]}</button>)}
        </div>
        <div className="config-weights-grid">
          <div className="config-weights-col">
            <div className="config-weights-title enemy-title">Enemy Counter Weights</div>
            <p className="config-weights-desc">Relative importance of each enemy role when you play {RL[viewRole]}</p>
            {RBG.ROLES.map(r => <WeightSlider key={r} role={r} value={weights.enemy?.[r] ?? 0} onChange={v => setEnemy(r, v)} />)}
          </div>
          <div className="config-weights-col">
            <div className="config-weights-title ally-title">Ally Synergy Weights</div>
            <p className="config-weights-desc">Relative importance of each ally role when you play {RL[viewRole]}</p>
            {allySlots.map(r => <WeightSlider key={r} role={r} value={weights.ally?.[r] ?? 0} onChange={v => setAlly(r, v)} />)}
            {Array(RBG.ROLES.length - allySlots.length).fill(null).map((_, i) => <div key={i} className="weight-row weight-row--spacer" />)}
          </div>
        </div>
        <div className="config-blend">
          <div className="config-blend-title">Score Multipliers — {RL[viewRole]}</div>
          <p className="config-blend-desc">Final score = WR + (<span className="enemy-color">counter multiplier</span> × Σcounter Δ) + (<span className="ally-color">synergy multiplier</span> × Σsynergy Δ). Both default to 1 and are independent.</p>
          <div className="config-blend-sliders">
            <div className="config-blend-row"><span className="blend-label enemy-title">Counter ×</span><input type="range" className="weight-slider weight-slider--counter" min={0} max={3} step={0.1} value={ctrBlend} onChange={e => setBlend('counter', +e.target.value)} /><span className="weight-val">{ctrBlend.toFixed(1)}</span></div>
            <div className="config-blend-row"><span className="blend-label ally-title">Synergy ×</span><input type="range" className="weight-slider weight-slider--synergy" min={0} max={3} step={0.1} value={synBlend} onChange={e => setBlend('synergy', +e.target.value)} /><span className="weight-val">{synBlend.toFixed(1)}</span></div>
          </div>
        </div>
      </div>

      <div className="config-section">
        <div className="config-section-title">Display</div>
        <p className="config-desc">Low detail mode removes splash art, animations, and GPU-heavy visual effects. Useful on lower-end hardware or if the breakdown panel feels sluggish.</p>
        <div className="config-row">
          <label className="config-check-label"><input type="checkbox" checked={!!lowDetail} onChange={e => onLowDetailChange(e.target.checked)} /> Low detail mode</label>
        </div>
      </div>

      <div className="config-footer"><button className="config-reset-btn" onClick={() => onChange(defaultConfig)}>↺ Reset all to defaults</button></div>
    </div>
  );
}

Object.assign(window, { ConfigPanel, ChampionPoolPanel, PoolLanes, PoolByRole, ChampionPicker, CustomModifiersPanel });
