/* ============================================================================
   Rabadon.GG core prototype — App shell
   Wires the redesigned core flow:
     • Primary nav = Draft + Configuration. About/Download are quiet
       secondary links in the header's top-right corner.
     • Champion pool lives by role; two layout variants (toggle in Config).
     • Pool picks feed the "My Champions" results tab; pool members get a
       star marker on Overall rows (the fixed, non-breaking marker).
   ========================================================================== */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

const ROLE_ALLY_SLOTS = {
  top: ['jungle', 'mid', 'adc', 'support'],
  jungle: ['top', 'mid', 'adc', 'support'],
  mid: ['top', 'jungle', 'adc', 'support'],
  adc: ['top', 'jungle', 'mid', 'support'],
  support: ['top', 'jungle', 'mid', 'adc'],
};
const ENEMY_SLOTS = ['top', 'jungle', 'mid', 'adc', 'support'];

const DEFAULT_CONFIG = {
  penalize: true,
  penalizeThreshold: 1000,
  roleWeights: Object.fromEntries(['top', 'jungle', 'mid', 'adc', 'support'].map(r => [r, {
    enemy: { top: 1, jungle: 1, mid: 1, adc: 1, support: 1 },
    ally: { top: 1, jungle: 1, mid: 1, adc: 1, support: 1 },
    blend: { counter: 1, synergy: 1 },
  }])),
};

function makeAllies(slots, existing = []) {
  return slots.map(slot => ({ champion: existing.find(a => a.role === slot)?.champion || '', role: slot }));
}
function makeEnemies(existing = []) {
  return ENEMY_SLOTS.map(slot => ({ champion: existing.find(e => e.role === slot)?.champion || '', role: slot }));
}

const SEED_POOL = [
  { champion: 'Caitlyn', roles: ['adc'] },
  { champion: 'Jinx', roles: ['adc'] },
  { champion: 'Ezreal', roles: ['adc', 'mid'] },
  { champion: 'Ahri', roles: ['mid'] },
  { champion: 'Thresh', roles: ['support'] },
  { champion: 'Lee Sin', roles: ['jungle'] },
];

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

function App() {
  const [view, setView] = useState('draft');               // draft | config | about | download
  const [role, setRole] = useState('adc');
  const [viewRole, setViewRole] = useState('adc');   // which role's picks are shown (defaults to your role)
  const [allies, setAllies] = useState(() => makeAllies(ROLE_ALLY_SLOTS['adc'], [{ role: 'mid', champion: 'Ahri' }, { role: 'support', champion: 'Thresh' }]));
  const [enemies, setEnemies] = useState(() => makeEnemies([
    { role: 'top', champion: 'Darius' }, { role: 'jungle', champion: 'Lee Sin' },
    { role: 'mid', champion: 'Zed' }, { role: 'adc', champion: 'Caitlyn' }, { role: 'support', champion: 'Leona' },
  ]));
  const [champions, setChampions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [poolResults, setPoolResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error] = useState(null);
  const [patch, setPatch] = useState('16.11');
  const [tier, setTier] = useState('emerald_plus');
  const [availablePatches] = useState(['16.11', '16.10', '16.9']);
  const [selectedRec, setSelectedRec] = useState(null);
  const [selectedPoolRec, setSelectedPoolRec] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [pool, setPool] = useState(SEED_POOL);
  const [poolVariant, setPoolVariant] = useState('lanes');
  const [lowDetail, setLowDetail] = useState(false);
  const [wrModifiers, setWrModifiers] = useState({});
  const [shareCopied, setShareCopied] = useState(false);
  const firstRun = useRef(true);

  useEffect(() => {
    RBG.loadChampions().then(list => { setChampions(list); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // Allies as seen FROM the viewed role: every role except the one being
  // recommended for, carrying whatever champion is known (your own pick is open).
  const alliesForView = useMemo(() => {
    const byRole = {};
    allies.forEach(a => { byRole[a.role] = a.champion; });
    if (!(role in byRole)) byRole[role] = '';
    return RBG.ROLES.filter(r => r !== viewRole).map(r => ({ role: r, champion: byRole[r] || '' }));
  }, [allies, role, viewRole]);

  // Recompute recommendations whenever the draft / population / pool / viewed role changes.
  useEffect(() => {
    if (champions.length === 0) return;
    if (!firstRun.current) setRefreshing(true);
    const poolForRole = pool.filter(p => p.roles.includes(viewRole)).map(p => p.champion);
    const t = setTimeout(() => {
      const result = RBG.getRecommendations(
        viewRole,
        alliesForView.filter(a => a.champion.trim()),
        enemies.filter(e => e.champion.trim()),
        patch, tier, poolForRole
      );
      setRecommendations(result.recommendations || []);
      setPoolResults(result.pool_picks || []);
      setRefreshing(false);
      firstRun.current = false;
    }, firstRun.current ? 0 : 260);
    return () => clearTimeout(t);
  }, [viewRole, alliesForView, enemies, patch, tier, pool, champions]);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setViewRole(newRole);
    setAllies(makeAllies(ROLE_ALLY_SLOTS[newRole] || ROLE_ALLY_SLOTS['adc'], allies));
    setSelectedRec(null); setSelectedPoolRec(null);
  };
  const handleViewRoleChange = (r) => {
    setViewRole(r);
    setSelectedRec(null); setSelectedPoolRec(null);
  };
  const setSlot = (setter, list, index, champion) => {
    const norm = s => s.trim().toLowerCase();
    setter(list.map((x, i) => i === index ? { ...x, champion } : (norm(x.champion) === norm(champion) && champion.trim() ? { ...x, champion: '' } : x)));
  };
  const handleAllyChange = (index, champion) => setSlot(setAllies, allies, index, champion);
  const handleEnemyChange = (index, champion) => setSlot(setEnemies, enemies, index, champion);
  const handleEnemySwap = useCallback((fromIdx, toIdx) => {
    setEnemies(prev => {
      const next = [...prev];
      const a = next[fromIdx].champion, b = next[toIdx].champion;
      next[fromIdx] = { ...next[fromIdx], champion: b };
      next[toIdx] = { ...next[toIdx], champion: a };
      return next;
    });
  }, []);

  // ── Pool handlers (role-tied) ──────────────────────────────────────────
  const addRole = useCallback((champion, role) => {
    setPool(prev => {
      const i = prev.findIndex(p => p.champion.toLowerCase() === champion.toLowerCase());
      if (i === -1) {
        if (prev.length >= 20) return prev;
        return [...prev, { champion, roles: [role] }];
      }
      if (prev[i].roles.includes(role)) return prev;
      const next = [...prev];
      next[i] = { ...next[i], roles: [...next[i].roles, role] };
      return next;
    });
  }, []);
  const removeRole = useCallback((champion, role) => {
    setPool(prev => prev.flatMap(p => {
      if (p.champion.toLowerCase() !== champion.toLowerCase()) return [p];
      const roles = p.roles.filter(r => r !== role);
      return roles.length ? [{ ...p, roles }] : [];
    }));
  }, []);
  const toggleRole = useCallback((champion, role) => {
    setPool(prev => {
      const p = prev.find(x => x.champion.toLowerCase() === champion.toLowerCase());
      if (p && p.roles.includes(role)) return prev.flatMap(x => {
        if (x.champion.toLowerCase() !== champion.toLowerCase()) return [x];
        const roles = x.roles.filter(r => r !== role);
        return roles.length ? [{ ...x, roles }] : [];
      });
      const i = prev.findIndex(x => x.champion.toLowerCase() === champion.toLowerCase());
      if (i === -1) return [...prev, { champion, roles: [role] }];
      const next = [...prev]; next[i] = { ...next[i], roles: [...next[i].roles, role] }; return next;
    });
  }, []);

  const handleModifierChange = useCallback((champion, value) => {
    setWrModifiers(prev => { const next = { ...prev }; if (!value) delete next[champion]; else next[champion] = value; return next; });
  }, []);

  const poolChampions = useMemo(() =>
    new Set(pool.filter(p => p.roles.includes(viewRole)).map(p => p.champion.toLowerCase())),
    [pool, viewRole]);

  const handleShare = useCallback(() => {
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1600);
  }, []);

  const isSecondary = view === 'about' || view === 'download';

  return (
    <div className="app-container" data-fx="refined" data-detail={lowDetail ? 'low' : undefined}>
      <header className="header">
        <div className="header-secondary">
          <button className={`header-secondary-link ${view === 'about' ? 'header-secondary-link--active' : ''}`} onClick={() => setView('about')}>About</button>
          <button className={`header-secondary-link ${view === 'download' ? 'header-secondary-link--active' : ''}`} onClick={() => setView('download')}>Download</button>
          <span className="header-secondary-sep" />
          <a href="https://github.com/Kuderic/RabadonGG" className="header-github-link" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository"><GitHubIcon /></a>
        </div>
        <div className="header-logo">
          <img src="rabadon.png" alt="" className="header-logo-img" onError={e => { e.target.style.display = 'none'; }} />
          <h1>Rabadon.GG</h1>
        </div>
        <p>Real-time champion select analysis</p>
      </header>

      <nav className="tab-nav">
        <button className={`tab-btn ${view === 'draft' ? 'tab-btn--active' : ''}`} onClick={() => setView('draft')}>Draft</button>
        <button className={`tab-btn ${view === 'config' ? 'tab-btn--active' : ''}`} onClick={() => setView('config')}>Settings</button>
      </nav>

      <main>
        {isSecondary && (
          <div className="secondary-context-bar">
            <span>You’re viewing {view === 'about' ? 'About' : 'Download'}</span>
            <button onClick={() => setView('draft')}>← Back to the app</button>
          </div>
        )}

        {view === 'draft' && (
          <>
            <DraftForm
              role={role} allies={allies} enemies={enemies} champions={champions}
              onRoleChange={handleRoleChange} onAllyChange={handleAllyChange}
              onEnemyChange={handleEnemyChange} onEnemySwap={handleEnemySwap}
              onSubmit={() => {}} loading={loading} error={error}
              patch={patch} tier={tier} onShare={handleShare} shareCopied={shareCopied}
            />
            {(recommendations.length > 0 || loading) && (
              <div className="results-section">
                <RecommendationList
                  recommendations={recommendations} loading={loading} refreshing={refreshing}
                  selectedIndex={selectedRec}
                  onSelect={idx => { setSelectedRec(idx); if (idx !== null) setSelectedPoolRec(null); }}
                  config={config} playerRole={viewRole} youRole={role}
                  viewRole={viewRole} onViewRoleChange={handleViewRoleChange}
                  onTogglePenalty={() => setConfig(c => ({ ...c, penalize: !c.penalize }))}
                  poolResults={poolResults}
                  selectedPoolRec={selectedPoolRec}
                  onSelectPoolRec={idx => { setSelectedPoolRec(idx); if (idx !== null) setSelectedRec(null); }}
                  poolChampions={poolChampions}
                  wrModifiers={wrModifiers}
                />
              </div>
            )}
          </>
        )}

        {view === 'config' && (
          <ConfigPanel
            config={config} onChange={setConfig} defaultConfig={DEFAULT_CONFIG}
            patch={patch} tier={tier} availablePatches={availablePatches}
            onPatchChange={setPatch} onTierChange={setTier}
            poolVariant={poolVariant} onPoolVariantChange={setPoolVariant}
            pool={pool} champions={champions}
            onAddRole={addRole} onRemoveRole={removeRole} onToggleRole={toggleRole}
            lowDetail={lowDetail} onLowDetailChange={setLowDetail}
            wrModifiers={wrModifiers} onModifierChange={handleModifierChange}
          />
        )}

        {view === 'about' && <AboutPanel />}
        {view === 'download' && <DownloadPanel />}
      </main>

      <footer className="site-footer">
        <p>Rabadon.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.</p>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
