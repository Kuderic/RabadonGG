/* Rabadon.GG core prototype — About + Download panels (carried over from the
   prior redesign round, unchanged). Exposed on window for app.jsx. */
const icon = n => RBG.iconUrl(n);
const onErr = e => { e.target.style.visibility = 'hidden'; };

/* ── icons (inline, original) ─────────────────────────────────────────────── */
const I = {
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/></svg>,
  data: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7"/><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>,
  sliders: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="9" cy="8" r="2.4" fill="var(--panel)"/><circle cx="15" cy="16" r="2.4" fill="var(--panel)"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 21.3 5 17.4 5 13V6z"/><polyline points="9 12 11 14 15 10"/></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  badge: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5"/></svg>,
  win: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12v4a6 6 0 0 1-12 0z"/><path d="M6 6H3v1a3 3 0 0 0 3 3M18 6h3v1a3 3 0 0 1-3 3M9 16h6M8 20h8M10 16v4M14 16v4"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>,
  windows: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5l8-1.1v7.2H3zM12 4.2L21 3v8.6h-9zM3 12.6h8v7.1l-8-1.1zM12 12.6h9V21l-9-1.2z"/></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  bookmark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>,
  history: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 8v4l3 2"/></svg>,
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>,
  github: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>,
  discord: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.25.5a18.3 18.3 0 0 1 4.3 1.4 13.5 13.5 0 0 0-11-0A18 18 0 0 1 12.8 3.5L12.55 3A19.8 19.8 0 0 0 7.7 4.4 20.6 20.6 0 0 0 4 18a19.9 19.9 0 0 0 6 3l.7-1.2a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 11.6 0l.5.4a13 13 0 0 1-2 1L20 21a19.8 19.8 0 0 0 6-3 20.6 20.6 0 0 0-3.7-13.6zM9.7 15.3c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm4.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>,
  google: <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.7-.06-1.4-.18-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-7.9z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.6-2.7c-1 .67-2.28 1.06-3.68 1.06-2.83 0-5.23-1.9-6.08-4.47H2.2v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.92 14.23a6.6 6.6 0 0 1 0-4.22v-2.8H2.2a11 11 0 0 0 0 9.82z"/><path fill="#EA4335" d="M12 5.5c1.62 0 3.07.56 4.21 1.64l3.15-3.15A10.5 10.5 0 0 0 12 1 11 11 0 0 0 2.2 7.2l3.72 2.8C6.77 7.42 9.17 5.5 12 5.5z"/></svg>,
};

const Diamond = ({ children, cls = '' }) => <span className={`hx-mark ${cls}`}>{children}</span>;

/* ════════════════════════════ ABOUT ════════════════════════════ */
function AboutPanel() {
  // Worked example: you're ADC; example champ Ezreal vs a sample enemy draft
  const counters = [
    { c: 'Caitlyn', r: 'adc', d: '+1.4' },
    { c: 'Leona', r: 'sup', d: '+0.9' },
    { c: 'Zed', r: 'mid', d: '-0.4' },
  ];
  const synergies = [
    { c: 'Thresh', r: 'sup', d: '+1.1' },
    { c: 'Vi', r: 'jg', d: '+0.5' },
    { c: 'Ahri', r: 'mid', d: '-0.2' },
  ];
  return (
    <div className="about-panel">
      <section className="about-hero hx-panel hx-ticks">
        <div className="about-eyebrow">Champion Select Assistant</div>
        <h1>Pick better. Win more. <span className="grad">Climb higher.</span></h1>
        <p>Rabadon.GG scores every champion for your role against the <em>real</em> draft in front of you and hands you the highest-win-rate pick for this exact game. Better picks win more games — and winning more games is how you climb the ladder.</p>
        <div className="about-steps">
          {[
            { n: 1, t: 'Enter the draft', d: 'Pick your role and type in the champions already locked on both teams. Or run the desktop app and it fills itself.' },
            { n: 2, t: 'We score everyone', d: 'Every champion in your role is rated against the live draft using millions of real games from your patch and tier.' },
            { n: 3, t: 'Pick with an edge', d: 'Read the top 10 at a glance, or open any pick to see the exact synergy and counter math behind its score.' },
          ].map(s => (
            <div className="about-step" key={s.n}>
              <span className="about-step-num">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="about-creator hx-panel hx-ticks">
        <div className="creator-emblem">
          <img src="https://opgg-static.akamaized.net/images/medals_new/challenger.png" alt="" onError={onErr} />
          <span className="creator-rank">Challenger</span>
        </div>
        <div className="creator-body">
          <div className="about-eyebrow">Who built this</div>
          <h2 className="about-heading">Made by Kuderic — a Challenger main</h2>
          <p>Kuderic climbed from <strong>Master to Challenger</strong> by trusting the data: every game, he and his support picked the champion with the best win rate <em>into the specific draft</em> — not the one sitting on top of a tier list. With a degree in <strong>Applied Statistics</strong>, he knew the edge was real, measurable, and repeatable.</p>
          <p>Rabadon.GG is that method, automated. The same draft-aware scoring he used to reach the top of the ladder is now in front of you, every champion select — so you can climb the same way.</p>
          <div className="creator-badges">
            <span className="creator-badge"><img src="https://opgg-static.akamaized.net/images/medals_new/challenger.png" alt="" onError={onErr} /> Challenger</span>
            <span className="creator-badge">{I.data} Applied Statistics degree</span>
            <span className="creator-badge"><img src="https://opgg-static.akamaized.net/images/medals_new/master.png" alt="" onError={onErr} /> Master → Challenger climb</span>
          </div>
        </div>
      </section>

      <section className="about-block hx-panel hx-ticks">
        <div className="about-block-head">
          <h2 className="about-heading">Why it beats a tier list</h2>
          <p className="about-subheading">A tier list ranks champions in a vacuum. It can't see that the enemy locked Blitzcrank, or that your support is Thresh. Rabadon reads the <em>actual</em> draft and scores the pick that wins <em>this</em> game — which is the pick that actually climbs.</p>
        </div>
        <div className="about-versus">
          <div className="versus-col tier">
            <div className="versus-tag">A tier list says</div>
            <div className="versus-line">"Pick the S-tier ADC."</div>
            <div className="versus-note">The same answer in every lobby — blind to who you're actually drafting against.</div>
          </div>
          <div className="versus-arrow">→</div>
          <div className="versus-col rabadon">
            <div className="versus-tag gold">Rabadon says</div>
            <div className="versus-line">"They have Blitzcrank. With your Thresh, <b>Ezreal</b> wins <span className="versus-up">+3.3%</span>."</div>
            <div className="versus-note">A different, draft-specific answer every single game — the one with the best odds to win.</div>
          </div>
        </div>
        <div className="about-features">
          {[
            { i: I.target, t: 'Draft-aware', d: 'A champion that\'s mediocre in a vacuum can be the perfect answer to a specific enemy comp. Rabadon scores the full context, never the champion in isolation.' },
            { i: I.data, t: 'Data-driven', d: 'Every number traces back to real match outcomes from the Riot API. The algorithm doesn\'t know what\'s "meta" — it just reads the win rates.' },
            { i: I.sliders, t: 'Configurable', d: 'Role weighting lets you decide how much each enemy or ally lane influences the score. Tune counter vs. synergy emphasis to your playstyle.' },
            { i: I.shield, t: 'Sample-size honest', d: 'Rare matchups get flagged and optionally down-weighted. 60% across 50 games is not the same as 60% across 10,000.' },
          ].map(f => (
            <div className="about-feature" key={f.t}>
              <span className="about-feature-mark">{f.i}</span>
              <div><h4>{f.t}</h4><p>{f.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="about-block hx-panel hx-ticks">
        <div className="about-block-head">
          <h2 className="about-heading">How the score is built</h2>
          <p className="about-subheading">Every rating starts from the champion's base win rate, then adds two draft-aware adjustments. Here's a real example for an <strong>ADC</strong> pick:</p>
        </div>
        <div className="about-example">
          <div className="about-eq">
            <div className="about-eq-champ">
              <img src={icon('Ezreal')} alt="" onError={onErr} />
              <div>
                <div className="about-eq-name">Ezreal</div>
                <div className="about-eq-role">ADC · 50.2% base WR</div>
              </div>
            </div>
            <div className="about-eq-tiles">
              <div className="eq-tile base"><div className="eq-tile-label">Base WR</div><div className="eq-tile-val">50.2</div></div>
              <span className="eq-op">+</span>
              <div className="eq-tile counter"><div className="eq-tile-label">Counter Δ</div><div className="eq-tile-val">+1.9</div></div>
              <span className="eq-op">+</span>
              <div className="eq-tile synergy"><div className="eq-tile-label">Synergy Δ</div><div className="eq-tile-val">+1.4</div></div>
              <span className="eq-op">=</span>
              <div className="eq-tile result"><div className="eq-tile-label">Rating</div><div className="eq-tile-val">53.5</div></div>
            </div>
          </div>
          <div className="about-contribs">
            <div>
              <div className="contrib-group-title enemy-color">Counter Δ — vs enemies</div>
              {counters.map(x => (
                <div className="contrib-row" key={x.c}>
                  <img src={icon(x.c)} alt="" onError={onErr} />
                  <span className="contrib-name">{x.c}</span>
                  <span className="contrib-vs">{x.r}</span>
                  <span className={`contrib-delta ${x.d.startsWith('+') ? 'positive' : 'negative'}`}>{x.d}%</span>
                </div>
              ))}
            </div>
            <div>
              <div className="contrib-group-title ally-color">Synergy Δ — with allies</div>
              {synergies.map(x => (
                <div className="contrib-row" key={x.c}>
                  <img src={icon(x.c)} alt="" onError={onErr} />
                  <span className="contrib-name">{x.c}</span>
                  <span className="contrib-vs">{x.r}</span>
                  <span className={`contrib-delta ${x.d.startsWith('+') ? 'positive' : 'negative'}`}>{x.d}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="about-datasource">
        <span className="ds-mark"></span>
        <p>Counter and synergy win rates are computed on our servers from the official <strong>Riot Games API</strong>. Choose your patch window (current, previous, or a rolling 30-day aggregate) and rank tier in the <strong>Settings</strong> tab. Rabadon.GG isn't endorsed by Riot Games.</p>
      </div>
    </div>
  );
}

/* ════════════════════════════ DOWNLOAD ════════════════════════════ */
/* Live render of the redesigned in-game overlay, dummy draft data. */
function OverlayShowcase() {
  const role = 'adc';
  const ROLE_ICON_ADC = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png';
  const enemies = ['Darius', 'Lee Sin', 'Zed', 'Jinx', 'Leona'];
  const picks = [
    { c: 'Caitlyn', wr: 52.4, g: 184, d: 3.8, s: 1.2, cc: 2.6, low: false },
    { c: 'Jhin',    wr: 51.6, g: 142, d: 2.9, s: 2.1, cc: 0.8, low: false },
    { c: "Kai'Sa",  wr: 50.8, g: 97,  d: 1.7, s: 0.4, cc: 1.3, low: true },
    { c: 'Ezreal',  wr: 49.9, g: 203, d: 0.6, s: 0.9, cc: -0.3, low: false },
    { c: 'Samira',  wr: 50.2, g: 76,  d: -0.4, s: -0.6, cc: 0.2, low: true },
  ];
  const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
  return (
    <div className="ovx-panel">
      <div className="ovx-head">
        <span className="ovx-logo"></span><span className="ovx-word">RABADON.GG</span>
        <span className="ovx-sp"></span><span className="ovx-patch">16.11</span><span className="ovx-close">✕</span>
      </div>
      <div className="ovx-matchup">
        <span className="ovx-myrole"><img src={ROLE_ICON_ADC} alt="" onError={onErr} /><span>ADC</span></span>
        <span className="ovx-vs">VS</span>
        <span className="ovx-enemies">
          {enemies.map(c => <img key={c} className="ovx-enemy" src={icon(c)} alt={c} title={c} onError={onErr} />)}
        </span>
      </div>
      <div className="ovx-picks-head"><span className="l">Top Picks</span><span className="r">Win% · Δ</span></div>
      <div className="ovx-picks">
        {picks.map((p, i) => (
          <div className={i === 0 ? 'ovx-pick ovx-pick--best' : 'ovx-pick'} key={p.c}>
            <span className={i < 3 ? 'ovx-rank' : 'ovx-rank ovx-rank--dim'}>{i + 1}</span>
            <img className="ovx-icon" src={icon(p.c)} alt={p.c} onError={onErr} />
            <div className="ovx-mid">
              <span className="ovx-name">{p.c}</span>
              <span className="ovx-sub"><span className="wr">{p.wr.toFixed(1)}%</span><span className="games">{p.g}K</span>{p.low && <span className="lown" title="Low sample">⚠</span>}</span>
            </div>
            <div className="ovx-right">
              <span className={`ovx-delta ${p.d >= 0 ? 'pos' : 'neg'}`}>{fmt(p.d)}</span>
              <span className="ovx-sc"><span className="s">S {fmt(p.s)}</span><span className="c">C {fmt(p.cc)}</span></span>
            </div>
          </div>
        ))}
      </div>
      <div className="ovx-foot"><span className="dot"></span><span>Champion select</span><span className="tier">Emerald+</span></div>
    </div>
  );
}

function DownloadPanel() {
  const allySlots = [
    { r: 'TOP', c: 'Aatrox', cls: 'ally' },
    { r: 'JG', c: 'Vi', cls: 'ally' },
    { r: 'MID', c: 'Ahri', cls: 'ally' },
    { r: 'ADC', c: null, cls: 'you' },
    { r: 'SUP', c: 'Thresh', cls: 'ally' },
  ];
  const enemySlots = [
    { r: 'TOP', c: 'Darius' }, { r: 'JG', c: 'Lee Sin' }, { r: 'MID', c: 'Zed' },
    { r: 'ADC', c: 'Caitlyn' }, { r: 'SUP', c: 'Leona' },
  ];
  return (
    <div className="download-panel">
      <section className="download-hero hx-panel hx-ticks">
        <div className="download-platform">{I.windows} Windows 10 / 11</div>
        <div className="download-hero-title">The Desktop App</div>
        <p className="download-hero-sub">It reads your champion select straight from the League client. No typing — your draft fills in live as picks and bans lock, and recommendations update in real time.</p>
        <a href="#" className="download-cta-btn" onClick={e => e.preventDefault()}>{I.download} Download for Windows</a>
        <div className="download-meta">
          <span><strong>v1.0.1</strong></span>
          <span>24.6 MB</span>
          <span>Installer (.exe)</span>
          <span><a href="#" onClick={e => e.preventDefault()}>Release notes &amp; checksums</a></span>
        </div>
      </section>

      <section className="app-preview">
        <div className="app-preview-chrome">
          <div className="app-preview-dots"><i></i><i></i><i></i></div>
          <div className="app-preview-titlebar">Rabadon.GG — Desktop</div>
          <div className="app-preview-live"><i></i> Live · reading client</div>
        </div>
        <div className="app-preview-body">
          <div>
            <div className="app-preview-col-title ally">Allied Team</div>
            {allySlots.map(s => (
              <div className={`app-preview-slot ${s.cls}`} key={s.r}>
                {s.c ? <img src={icon(s.c)} alt="" onError={onErr} /> : <span className="ps-empty"></span>}
                <span className="ps-role">{s.r}</span>
                <span className="ps-name">{s.c || 'your pick…'}</span>
                {s.c && <span className="ps-lock">✓ locked</span>}
              </div>
            ))}
          </div>
          <div>
            <div className="app-preview-col-title enemy">Enemy Team</div>
            {enemySlots.map(s => (
              <div className="app-preview-slot enemy" key={s.r}>
                <img src={icon(s.c)} alt="" onError={onErr} />
                <span className="ps-role">{s.r}</span>
                <span className="ps-name">{s.c}</span>
                <span className="ps-lock">✓ locked</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overlay-showcase hx-panel hx-ticks">
        <div className="overlay-showcase-copy">
          <div className="download-platform">{I.eye} Always-on-top · In client</div>
          <h2>The in-client overlay</h2>
          <p>A compact, draggable panel that floats over the client during champion select. Your top picks — and the math behind them — stay one glance away while you draft, no alt-tab required.</p>
          <div className="overlay-showcase-points">
            <div className="overlay-showcase-point">
              <span className="m">{I.target}</span>
              <div><h4>Reads the live draft</h4><p>The matchup strip shows your role against the enemy team as picks lock in.</p></div>
            </div>
            <div className="overlay-showcase-point">
              <span className="m">{I.win}</span>
              <div><h4>The edge, front and center</h4><p>Each pick leads with its draft-adjusted Δ, then the synergy and counter split behind it.</p></div>
            </div>
            <div className="overlay-showcase-point">
              <span className="m">{I.sliders}</span>
              <div><h4>Stays out of your way</h4><p>Drag it anywhere; it remembers the spot. Click ✕ to tuck it away, hotkey to bring it back.</p></div>
            </div>
          </div>
        </div>
        <div className="overlay-stage">
          <div className="overlay-stage-hud">
            <i style={{ top: '8%', left: '6%', width: '24%', height: '12%' }}></i>
            <i style={{ top: '8%', right: '6%', width: '24%', height: '12%' }}></i>
            <i style={{ bottom: '10%', left: '12%', width: '76%', height: '9%' }}></i>
          </div>
          <OverlayShowcase />
        </div>
      </section>

      <section className="download-install hx-panel hx-ticks">
        <h3 className="download-install-title">Install in three steps</h3>
        <div className="install-steps">
          <div className="install-step"><span className="install-step-n">1</span><p>Download and run <strong>RabadonGG-Setup.exe</strong>. Windows may show a SmartScreen notice — click <strong>More info → Run anyway</strong>.</p></div>
          <div className="install-step"><span className="install-step-n">2</span><p>Launch Rabadon and open the League client. The app detects your session automatically — nothing to configure.</p></div>
          <div className="install-step"><span className="install-step-n">3</span><p>Enter champion select. Your draft fills in live and the top 10 picks for your role update with every lock-in.</p></div>
        </div>
      </section>

      <section className="download-safety">
        <div>
          <h2 className="download-safety-title">Is it safe?</h2>
          <p className="download-safety-sub">Short answer: yes, and you don't have to take our word for it.</p>
        </div>
        <div className="download-safety-grid">
          {[
            { i: I.github, t: 'Open source', d: <>The full source is public on <a href="#" onClick={e=>e.preventDefault()}>GitHub</a>. Anyone can read, audit, and build it themselves — nothing is hidden.</> },
            { i: I.eye, t: 'Read-only access', d: <>It reads one local endpoint from the client to get the draft. It cannot pick, ban, click, or chat. No game data leaves your machine.</> },
            { i: I.badge, t: 'Verified releases', d: <>Each <a href="#" onClick={e=>e.preventDefault()}>release</a> ships a SHA256 checksum and VirusTotal scan link so you can verify the binary before running it.</> },
            { i: I.shield, t: 'Riot ToS-safe', d: <>Read-only LCU use is permitted by Riot's third-party policy. The app never automates gameplay or touches the game memory.</> },
          ].map(c => (
            <div className="download-safety-card hx-panel" key={c.t}>
              <span className="download-safety-mark">{c.i}</span>
              <div><h4>{c.t}</h4><p>{c.d}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { AboutPanel, DownloadPanel, AB_ICONS: I });
