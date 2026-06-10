# Rabadon.GG — core-flow redesign · handoff

Six changes to the **Draft / Results / Settings** flow. Unlike the
About/Download round (pure CSS), these need small JSX edits in four files.
The working reference is the prototype in **`core/`** — every change below has a
1:1 component there (`core/draft.jsx`, `core/results.jsx`, `core/config.jsx`,
`core/app.jsx`). Prototype helpers map to your real code like so:

| prototype | real app |
|---|---|
| `RBG.iconUrl(name)` | `champIconUrl(name)` (`utils/champion`) |
| `RBG.splashUrl(name)` | `https://ddragon…/splash/${champDDragonKey(name)}_0.jpg` |
| `dfFilter` / `cfgFilter` | `filterChampions` (`utils/champion`) |
| `RBG.ROLE_ICON`, `RBG.ROLE_LABEL_SHORT`, `RBG.ROLES` | already defined in your components |

## 0 · Stylesheet
Append **`ship-core/core.css`** to `src/App.css` (or import it after it). It only
adds new classes + a few row-grid/​header overrides — nothing existing is removed.

---

## 1 · Nav — About/Download out of the primary tabs
*(`App.jsx`)*

Keep `activeTab` exactly as-is (still `draft | config | about | download`). Only
the **markup** moves: pull About + Download out of `.tab-nav` and render them as
quiet links in the header's top-right, next to the GitHub icon.

```jsx
<header className="header">
  <div className="header-secondary">
    <button className={`header-secondary-link ${activeTab==='about' ? 'header-secondary-link--active' : ''}`}
            onClick={() => setActiveTab('about')}>About</button>
    {!import.meta.env.VITE_DESKTOP && (
      <button className={`header-secondary-link ${activeTab==='download' ? 'header-secondary-link--active' : ''}`}
              onClick={() => setActiveTab('download')}>Download</button>
    )}
    <span className="header-secondary-sep" />
    <a href="https://github.com/Kuderic/RabadonGG" className="header-github-link"
       target="_blank" rel="noopener noreferrer" aria-label="GitHub repository"
       onClick={handleExternalLink}>{/* existing GitHub svg */}</a>
  </div>
  <div className="header-logo"><img src="/rabadon.png" alt="" className="header-logo-img" /><h1>Rabadon.GG</h1></div>
  <p>Real-time champion select analysis</p>
</header>

<nav className="tab-nav">
  <button className={`tab-btn ${activeTab==='draft' ? 'tab-btn--active' : ''}`} onClick={() => setActiveTab('draft')}>Draft</button>
  <button className={`tab-btn ${activeTab==='config' ? 'tab-btn--active' : ''}`} onClick={() => setActiveTab('config')}>Settings</button>
</nav>
```

**Tab rename:** the Configuration tab is relabelled **Settings** (noun, shorter,
pairs with "Draft"). Label only — the `activeTab === 'config'` value is unchanged,
so no other code moves. Also swap the user-facing string "Configuration" →
"Settings" in the empty-pool hint (`RecommendationList`) and the About data-source
line.

The old standalone `.header-github-link` (absolute top-right) is now inside
`.header-secondary`; `core.css` repositions it. Optional nicety: when
`activeTab` is `about`/`download`, render the `.secondary-context-bar` (see
`core/app.jsx`) with a "← Back to the app" button.

---

## 2 · Enemy drag-and-drop — drag from a grip handle
*(`DraftForm.jsx`)*

Root cause of the bugginess: the **whole row** was the drag surface, so drags
fought the text input + autocomplete, and drop detection used `elementFromPoint`
(which hits the ghost/dropdown). The redesign:

- Drag only from an explicit **grip handle** placed **between the role pill and
  the champion** (inside the row, so it's close to the cursor, not way out
  right). It's faintly visible by default and brightens on hover; filled slots
  only. The input is a normal text field again.
- Hit-test drop targets by **row geometry** (`getBoundingClientRect`), not
  `elementFromPoint`.
- Uses `setPointerCapture`, so touch/mouse never "lose" the drag.
- Bonus: focus a grip + **↑/↓ arrows** to swap (keyboard a11y).

Replace your `EnemySection` (and `buildGhost`) with the versions in
**`core/draft.jsx`** — `GripIcon`, `SwapIcon`, `buildGhost`, `EnemySection`. Also
give `ChampionRow` an optional `dragHandle` node rendered right after the
`RolePill` (between the role pill and `.champ-input-wrap`):

```jsx
<div className={`champ-row champ-row--${side}`} ref={wrapRef}>
  <RolePill role={role} side={side} />
  {dragHandle}                         {/* ← grip sits here, between role + champ */}
  <div className="champ-input-wrap"> … </div>
</div>
```

Behaviour on drop = **swap the two slots' champions** (your existing
`onEnemySwap(fromIdx, toIdx)` already does exactly this; no `App.jsx` change).
`EnemySection` passes the handle in:

```jsx
<div ref={el => rowRefs.current[i] = el}
     className={`enemy-drag-wrap${enemy.champion ? ' has-champ' : ''}${dragSrc===i ? ' drag-source' : ''}${dragOver===i && dragSrc!==i ? ' drag-over' : ''}`}>
  <ChampionRow … dragging={dragSrc !== null} dragHandle={
    <button className="enemy-drag-handle" onPointerDown={e => startDrag(e, i)}
            onKeyDown={e => handleKey(e, i)} tabIndex={enemy.champion ? 0 : -1}
            title="Drag to swap roles">
      {dragOver===i && dragSrc!==null && dragSrc!==i ? <SwapIcon/> : <GripIcon/>}
    </button>
  } />
</div>
```
…plus the `<div className="enemy-drag-hint">…</div>` after the list.

---

## 3 · Sort — Synergy / Counter as column headers
*(`RecommendationList.jsx`)*

Synergy + Counter move OUT of the toolbar and become **clickable column headers**
sitting directly above their value columns. WR+Δ / Δ-only stay as the primary
sort in the toolbar.

1. In `.rec-toolbar`, delete the two `sort-btn` buttons for `synergy` and
   `counter`. Keep `rating` and `delta`. (Swap `.rec-toolbar-sep` for
   `<div className="rec-toolbar-spacer" />` to push the penalty toggle right.)
2. Add the header row **immediately before** `<div className="rec-grid rec-grid--row">`
   (both Overall and pool tabs). Copy `SortHeaders` from `core/results.jsx`:

```jsx
<SortHeaders sortMode={sortMode} onSort={(m) => setSortMode(s => s === m ? 'rating' : m)} />
```

`computeAdjustedScore` already handles `sortMode === 'synergy' | 'counter'`, so no
scoring change. The grid template in `core.css` (`.rec-col-headers`) is pinned to
your existing row template (`30px 42px minmax(80px,1fr) 165px 130px`). On mobile
the header row hides and per-row `.delta-label`s return automatically.

---

## 4 · Fix — in-pool star breaking the Overall row
*(`RecommendationList.jsx`, in `RecCard`)*

In the row layout `.card-header { display:contents }`, so its children are laid
out by `order` into the 5-column grid. The in-pool `<PoolBadge>` had **no order**
→ it became a stray 6th grid item (order 0), shoving every column right and
wrapping `.card-stats` onto a second row (your screenshot).

**Fix:** render the marker *inside* `.card-champion-name` (a single grid cell),
never as a bare child of `.card-header`. Delete this line from the header:

```jsx
{!isPool && inPool && <PoolBadge />}        // ← remove
```
and put the marker in the name instead — and add an `in-pool` class to the card
so the row gets its gold accent + tint highlight:

```jsx
<div className={`recommendation-card ${isPool ? 'pool-card' : ''} ${!isPool && inPool ? 'in-pool' : ''} ${isSelected ? 'card-selected' : ''}`} …>
  …
  <span className="card-champion-name">
    {rec.champion}
    {!isPool && inPool && <PoolStar />}        {/* ← add */}
    <ExternalLink champion={rec.champion} />
  </span>
```

`PoolStar` is in `core/results.jsx`. In `core.css` the in-pool row gets a bigger
glowing gold star, a warm-gold champion name, a gold left accent bar and a faint
gold tint — so a champion you actually play jumps out of the top-10 at a glance.
The pool-tab cards (rank `★`) are unaffected — `core.css` pins that `.pool-badge`
to the rank column.

---

## 5 · My Champions — role-first redesign
*(`ChampionPoolPanel.jsx` + small `App.jsx` additions)*

> Note: the current `ChampionPoolPanel.jsx` references `setPendingRoles` and
> `selectChampion`, which aren't defined — it throws on type. The replacement
> fixes that.

Replace `ChampionPoolPanel.jsx` with the redesign in **`core/config.jsx`**
(`ChampionPicker`, `PoolLanes`, `PoolByRole`, `ChampionPoolPanel`). It ships
**both** layouts behind a segmented toggle so you (and users) can pick:

- **Lanes** *(recommended default)* — five role containers; add a champion
  straight into any lane via its own `+ Add to …` search. Solves the "assign
  10–15 champs" pain — no per-champion role-button fiddling.
- **By role** — a role picker filters the list to one role; new adds go to that
  role. Fastest for one-trick / two-role players. Flex chips toggle a champ into
  other roles.

Both share the existing `pool = [{ champion, roles:[…] }]` model, so the
`pool_picks` backend path is unchanged. Add three handlers to `App.jsx` (see
`core/app.jsx` for exact bodies) and a `poolVariant` state:

```jsx
const [poolVariant, setPoolVariant] = useState(() => localStorage.getItem('rabadon_pool_variant') || 'lanes');
useEffect(() => localStorage.setItem('rabadon_pool_variant', poolVariant), [poolVariant]);

const addRole    = useCallback((champ, role) => { /* add role, or push {champion,roles:[role]} */ }, []);
const removeRole = useCallback((champ, role) => { /* drop role; if none left, drop champ */ }, []);
const toggleRole = useCallback((champ, role) => { /* add/remove that role */ }, []);
```

Pass `poolVariant`, `onPoolVariantChange`, `pool`, `champions`, `onAddRole`,
`onRemoveRole`, `onToggleRole` through `ConfigPanel` → `ChampionPoolPanel`. Your
old `handlePoolAdd / handlePoolRemove / handlePoolRoleChange` can be removed once
the three role-scoped handlers are wired (or kept — they're compatible with the
same data model).

Want to ship just one layout? Render only `PoolLanes` (or `PoolByRole`) and drop
the `.pool-variant-toggle`.

---

## 6 · View other roles' top picks
*(`RecommendationList.jsx` + `App.jsx`)*

A role switcher above the recommendations lets you peek at **any** role's top
picks for the current draft (e.g. a mid player advising their ADC), without
changing your own role. Your role stays marked **YOU**.

**`App.jsx`** — add a `viewRole` state (defaults to `role`), and recompute
recommendations for `viewRole` against allies-as-seen-from-that-role:

```jsx
const [viewRole, setViewRole] = useState(role);

// allies for the viewed role = every role except viewRole, carrying known champs
const alliesForView = useMemo(() => {
  const byRole = {}; allies.forEach(a => byRole[a.role] = a.champion);
  if (!(role in byRole)) byRole[role] = '';
  return ROLES.filter(r => r !== viewRole).map(r => ({ role: r, champion: byRole[r] || '' }));
}, [allies, role, viewRole]);

// in the recompute effect: getRecommendations(viewRole, alliesForView.filter(…), enemies.filter(…), …)
// pool + stars also key off viewRole:
const poolForRole   = pool.filter(p => p.roles.includes(viewRole)).map(p => p.champion);
const poolChampions = useMemo(() => new Set(pool.filter(p => p.roles.includes(viewRole)).map(p => p.champion.toLowerCase())), [pool, viewRole]);

const handleRoleChange     = (r) => { setRole(r); setViewRole(r); /* …rebuild allies… */ };
const handleViewRoleChange = (r) => { setViewRole(r); setSelectedRec(null); setSelectedPoolRec(null); };
```
Pass to `RecommendationList`: `playerRole={viewRole}` (scoring + display follow the
viewed role), `youRole={role}` (marks the YOU pill), `onViewRoleChange={handleViewRoleChange}`.
Replace the old `playerRole={role}` prop. Everything downstream (`computeComponents`,
breakdown, sort) already takes `playerRole`, so it just works.

**`RecommendationList.jsx`** — add `youRole` + `onViewRoleChange` params and the
switcher in `.rec-panel-heading` (markup + the `.rec-advising-banner` shown when
`playerRole !== youRole`). Copy both from `core/results.jsx`. The old
`.rec-panel-role` badge is replaced by the switcher.

---

## Verify after dropping in
- **Draft:** hover an enemy row → grip appears; drag onto another enemy → the two
  champions swap, roles stay put. Arrow keys on a focused grip also swap.
- **Results:** click the **Synergy** / **Counter** column headers → list re-sorts,
  caret shows on the active column. A pooled champ in Overall shows a ★ by its
  name with the row perfectly aligned (the bug).
- **Settings → My Champions:** toggle **Lanes / By role**; add a champ in
  each; confirm it appears in the results **My Champions** tab.
- **Settings → Custom Modifiers** is your existing `CustomModifiersPanel`,
  unchanged — keep it (the prototype restored it for completeness). Likewise the
  **Display / low-detail** section is your existing one, unchanged.
- **View other roles:** in the results header, click a role in the switcher →
  top picks recompute for that role; an advising banner + "Back to your role"
  appear; your own role keeps the **YOU** marker.
