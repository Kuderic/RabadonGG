/* Rabadon.GG — My Champions layout comparison (side-by-side, both interactive).
   Reuses PoolLanes / PoolByRole from config.jsx. Each artboard owns its own
   pool state so you can play with both at once. */

const MC_SEED = [
  { champion: 'Caitlyn', roles: ['adc'] },
  { champion: 'Jinx', roles: ['adc'] },
  { champion: 'Ezreal', roles: ['adc', 'mid'] },
  { champion: 'Ahri', roles: ['mid'] },
  { champion: 'Thresh', roles: ['support'] },
  { champion: 'Lee Sin', roles: ['jungle'] },
  { champion: 'Aatrox', roles: ['top'] },
];

function useDemoPool(seed) {
  const [pool, setPool] = React.useState(seed);
  const addRole = (c, r) => setPool(p => {
    const i = p.findIndex(x => x.champion.toLowerCase() === c.toLowerCase());
    if (i === -1) return [...p, { champion: c, roles: [r] }];
    if (p[i].roles.includes(r)) return p;
    const n = [...p]; n[i] = { ...n[i], roles: [...n[i].roles, r] }; return n;
  });
  const removeRole = (c, r) => setPool(p => p.flatMap(x => {
    if (x.champion.toLowerCase() !== c.toLowerCase()) return [x];
    const roles = x.roles.filter(z => z !== r);
    return roles.length ? [{ ...x, roles }] : [];
  }));
  const toggleRole = (c, r) => {
    const has = pool.find(x => x.champion.toLowerCase() === c.toLowerCase())?.roles.includes(r);
    has ? removeRole(c, r) : addRole(c, r);
  };
  return { pool, addRole, removeRole, toggleRole };
}

function ArtboardShell({ children }) {
  return (
    <div className="app-container" data-fx="refined" style={{ background: '#0a0e1a', width: '100%', maxWidth: 'none', minHeight: '100%', padding: '12px', margin: 0, boxSizing: 'border-box' }}>
      <div className="config-panel" style={{ display: 'block' }}>
        <div className="config-section pool-panel" style={{ marginBottom: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function LanesDemo({ champions }) {
  const { pool, addRole, removeRole } = useDemoPool(MC_SEED);
  return (
    <ArtboardShell>
      <div className="config-section-title">My Champions</div>
      <p className="pool-description" style={{ margin: '6px 0 0' }}>Five role containers. Add the champs you play straight into each lane — a champion can live in several lanes.</p>
      <PoolLanes pool={pool} champions={champions} onAddRole={addRole} onRemoveRole={removeRole} />
    </ArtboardShell>
  );
}

function ByRoleDemo({ champions }) {
  const { pool, addRole, removeRole, toggleRole } = useDemoPool(MC_SEED);
  return (
    <ArtboardShell>
      <div className="config-section-title">My Champions</div>
      <p className="pool-description" style={{ margin: '6px 0 0' }}>Pick the role you’re building; only that role’s champions show, and new adds go straight to it. Flex chips add a champ to other roles.</p>
      <PoolByRole pool={pool} champions={champions} onAddRole={addRole} onRemoveRole={removeRole} onToggleRole={toggleRole} />
    </ArtboardShell>
  );
}

function CanvasApp() {
  const [champions, setChampions] = React.useState([]);
  React.useEffect(() => { RBG.loadChampions().then(setChampions).catch(() => {}); }, []);
  return (
    <DesignCanvas>
      <DCSection id="mychamps" title="My Champions — layout options" subtitle="Two role-first redesigns · both fully interactive (add / remove / reassign)">
        <DCArtboard id="lanes" label="A · Role lanes — five containers" width={1080} height={420}>
          <LanesDemo champions={champions} />
        </DCArtboard>
        <DCArtboard id="byrole" label="B · Role picker + filtered list" width={680} height={470}>
          <ByRoleDemo champions={champions} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CanvasApp />);
