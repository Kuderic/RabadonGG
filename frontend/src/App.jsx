import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import DraftForm from './components/DraftForm'
import TitleBar from './components/TitleBar'
import { getRecommendations, getChampions, getPatches, getDraftOverview } from './api/client'
import { useLCUSession } from './services/lcu'
import { champPrimaryRole, champSecondaryRole, champIconUrl } from './utils/champion'
import { computeComponents } from './utils/scoring'
import releaseNotesRaw from '../../RELEASE_NOTES.md?raw'
import { TIER_OPTIONS } from './components/TierSelector'

const IS_DESKTOP = import.meta.env.VITE_DESKTOP === 'true'
const IS_TAURI = typeof window !== 'undefined' && window.__TAURI__ != null

// In Tauri the WebView doesn't route <a target="_blank"> to the system browser.
// Intercept clicks and call the native open_url command instead.
function handleExternalLink(e) {
  if (!IS_TAURI) return
  e.preventDefault()
  window.__TAURI__.core.invoke('open_url', { url: e.currentTarget.href })
}

const RecommendationList = lazy(() => import('./components/RecommendationList'))
const ConfigPanel = lazy(() => import('./components/ConfigPanel'))
const DraftOverview = lazy(() => import('./components/DraftOverview'))

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']

const ROLE_ALLY_SLOTS = {
  top:     ['jungle', 'mid', 'adc', 'support'],
  jungle:  ['top', 'mid', 'adc', 'support'],
  mid:     ['top', 'jungle', 'adc', 'support'],
  adc:     ['top', 'jungle', 'mid', 'support'],
  support: ['top', 'jungle', 'mid', 'adc'],
}

const ENEMY_SLOTS = ['top', 'jungle', 'mid', 'adc', 'support']

export const DEFAULT_CONFIG = {
  penalize: true,
  penalizeThreshold: 2000,
  roleWeights: {
    top: {
      enemy: { top: 1.0, jungle: 1.0, mid: 1.0, support: 1.0, adc: 1.0 },
      ally:  { jungle: 1.0, mid: 1.0, support: 1.0, adc: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
    jungle: {
      enemy: { jungle: 1.0, mid: 1.0, top: 1.0, support: 1.0, adc: 1.0 },
      ally:  { mid: 1.0, top: 1.0, support: 1.0, adc: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
    mid: {
      enemy: { mid: 1.0, jungle: 1.0, support: 1.0, adc: 1.0, top: 1.0 },
      ally:  { jungle: 1.0, support: 1.0, adc: 1.0, top: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
    adc: {
      enemy: { adc: 1.0, support: 1.0, jungle: 1.0, mid: 1.0, top: 1.0 },
      ally:  { support: 1.0, jungle: 1.0, mid: 1.0, top: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
    support: {
      enemy: { support: 1.0, adc: 1.0, jungle: 1.0, mid: 1.0, top: 1.0 },
      ally:  { adc: 1.0, jungle: 1.0, mid: 1.0, top: 1.0 },
      blend: { counter: 1, synergy: 1 },
    },
  }
}

function makeAllies(slots, existing = []) {
  return slots.map(slot => ({
    champion: existing.find(a => a.role === slot)?.champion || '',
    role: slot,
  }))
}

function makeEnemies(existing = []) {
  return ENEMY_SLOTS.map(slot => ({
    champion: existing.find(e => e.role === slot)?.champion || '',
    role: slot,
  }))
}

function parseUrlDraft() {
  const p = new URLSearchParams(window.location.search)
  const role = p.get('role')
  if (!role || !ROLE_ALLY_SLOTS[role]) return null
  return { role, params: p }
}

const _url = parseUrlDraft()
const _initialRole = _url?.role ?? localStorage.getItem('rabadon_role') ?? 'adc'

const _onImgErr = e => { e.target.style.visibility = 'hidden' }

// Inline icons used by the About + Download panels
const IC = {
  windows: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.5l8-1.1v7.2H3zM12 4.2L21 3v8.6h-9zM3 12.6h8v7.1l-8-1.1zM12 12.6h9V21l-9-1.2z"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>,
  github: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  badge: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 21.3 5 17.4 5 13V6z"/><polyline points="9 12 11 14 15 10"/></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/></svg>,
  data: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7"/><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>,
  sliders: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="9" cy="8" r="2.4" fill="var(--panel)"/><circle cx="15" cy="16" r="2.4" fill="var(--panel)"/></svg>,
  win: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
}

function AboutPanel() {
  const counters = [
    { c: 'Caitlyn', r: 'adc', d: '+1.4' },
    { c: 'Leona', r: 'sup', d: '+0.9' },
    { c: 'Zed', r: 'mid', d: '-0.4' },
  ]
  const synergies = [
    { c: 'Thresh', r: 'sup', d: '+1.1' },
    { c: 'Vi', r: 'jg', d: '+0.5' },
    { c: 'Ahri', r: 'mid', d: '-0.2' },
  ]
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
          <img src="https://opgg-static.akamaized.net/images/medals_new/challenger.png" alt="" onError={_onImgErr} />
          <span className="creator-rank">Challenger</span>
        </div>
        <div className="creator-body">
          <div className="about-eyebrow">Who built this</div>
          <h2 className="about-heading">Made by Kuderic — a Challenger Bot main</h2>
          <p>Kuderic climbed from <strong>Master to Challenger</strong> by trusting the data: every game, he and his support picked the champion with the best win rate <em>into the specific draft</em> — not the one sitting on top of a tier list. With a degree in <strong>Applied Statistics</strong>, he knew the edge was real, measurable, and repeatable.</p>
          <p>Rabadon.GG is that method, automated. The same draft-aware scoring he used to reach the top of the ladder is now in front of you, every champion select — so you can climb the same way.</p>
          <div className="creator-badges">
            <span className="creator-badge"><img src="https://opgg-static.akamaized.net/images/medals_new/challenger.png" alt="" onError={_onImgErr} /> Challenger</span>
            <span className="creator-badge">{IC.data} Applied Statistics degree</span>
            <span className="creator-badge"><img src="https://opgg-static.akamaized.net/images/medals_new/master.png" alt="" onError={_onImgErr} /> Master → Challenger climb</span>
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
            <div className="versus-line">"Pick the S-tier Bot."</div>
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
            { i: IC.target, t: 'Draft-aware', d: 'A champion that\'s mediocre in a vacuum can be the perfect answer to a specific enemy comp. Rabadon scores the full context, never the champion in isolation.' },
            { i: IC.data, t: 'Data-driven', d: 'Every number traces back to real match outcomes from the Riot API. The algorithm doesn\'t know what\'s "meta" — it just reads the win rates.' },
            { i: IC.sliders, t: 'Configurable', d: 'Role weighting lets you decide how much each enemy or ally lane influences the score. Tune counter vs. synergy emphasis to your playstyle.' },
            { i: IC.shield, t: 'Sample-size honest', d: 'Rare matchups get flagged and optionally down-weighted. 60% across 50 games is not the same as 60% across 10,000.' },
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
          <p className="about-subheading">Every rating starts from the champion's base win rate, then adds two draft-aware adjustments. Here's a real example for a <strong>Bot</strong> pick:</p>
        </div>
        <div className="about-example">
          <div className="about-eq">
            <div className="about-eq-champ">
              <img src={champIconUrl('Ezreal')} alt="" onError={_onImgErr} />
              <div>
                <div className="about-eq-name">Ezreal</div>
                <div className="about-eq-role">Bot · 50.2% base WR</div>
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
                  <img src={champIconUrl(x.c)} alt="" onError={_onImgErr} />
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
                  <img src={champIconUrl(x.c)} alt="" onError={_onImgErr} />
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
        <p>Counter and synergy win rates are computed on our servers from the official <strong>Riot Games API</strong>. Choose your patch window (current, previous, or a rolling 30-day aggregate) and rank tier in the <strong>Settings</strong> tab.</p>
      </div>
    </div>
  )
}

function OverlayShowcase() {
  const ROLE_ICON_ADC = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png';
  const showcaseTier = TIER_OPTIONS.find(t => t.value === 'emerald_plus') || TIER_OPTIONS[1];
  const enemies = ['Darius', 'Lee Sin', 'Zed', 'Jinx', 'Leona'];
  const picks = [
    { c: 'Caitlyn', wr: 52.4, g: 184, d: 3.8, s: 1.2, cc: 2.6, low: false },
    { c: 'Jhin',    wr: 51.6, g: 142, d: 2.9, s: 2.1, cc: 0.8, low: false },
    { c: "Kai'Sa",  wr: 50.8, g: 97,  d: 1.7, s: 0.4, cc: 1.3, low: true },
    { c: 'Ezreal',  wr: 49.9, g: 203, d: 0.6, s: 0.9, cc: -0.3, low: false },
    { c: 'Samira',  wr: 50.2, g: 76,  d: -0.4, s: -0.6, cc: 0.2, low: true },
  ];
  const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
  const onErr = e => { e.target.style.visibility = 'hidden'; };
  return (
    <div className="ovx-panel">
      <div className="ovx-head">
        <span className="ovx-logo" /><span className="ovx-word">RABADON.GG</span>
        <span className="ovx-sp" /><span className="ovx-patch">16.11</span><span className="ovx-close">✕</span>
      </div>
      <div className="ovx-matchup">
        <span className="ovx-myrole"><img src={ROLE_ICON_ADC} alt="" onError={onErr} /><span>BOT</span></span>
        <span className="ovx-vs">VS</span>
        <span className="ovx-enemies">
          {enemies.map(c => <img key={c} className="ovx-enemy" src={champIconUrl(c)} alt={c} title={c} onError={onErr} />)}
        </span>
      </div>
      <div className="ovx-picks-head"><span className="l">Top Picks</span><span className="r">Win% · Δ</span></div>
      <div className="ovx-picks">
        {picks.map((p, i) => (
          <div className={i === 0 ? 'ovx-pick ovx-pick--best' : 'ovx-pick'} key={p.c}>
            <span className={i < 3 ? 'ovx-rank' : 'ovx-rank ovx-rank--dim'}>{i + 1}</span>
            <img className="ovx-icon" src={champIconUrl(p.c)} alt={p.c} onError={onErr} />
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
      <div className="ovx-foot"><span className="dot" /><span>Champion select</span><span className="tier">{showcaseTier.icon && <img src={showcaseTier.icon} alt="" className="tier-icon" onError={e => { e.target.style.display = 'none' }} />}{showcaseTier.label}</span></div>
    </div>
  );
}

function DownloadPanel() {
  const allySlots = [
    { r: 'TOP', c: 'Aatrox', cls: 'ally' },
    { r: 'JG', c: 'Vi', cls: 'ally' },
    { r: 'MID', c: 'Ahri', cls: 'ally' },
    { r: 'BOT', c: null, cls: 'you' },
    { r: 'SUP', c: 'Thresh', cls: 'ally' },
  ]
  const enemySlots = [
    { r: 'TOP', c: 'Darius' }, { r: 'JG', c: 'Lee Sin' }, { r: 'MID', c: 'Zed' },
    { r: 'BOT', c: 'Caitlyn' }, { r: 'SUP', c: 'Leona' },
  ]
  return (
    <div className="download-panel">
      <section className="download-hero hx-panel hx-ticks">
        <div className="download-platform">{IC.windows} Windows 10 / 11</div>
        <div className="download-hero-title">The Desktop App</div>
        <p className="download-hero-sub">It reads your champion select straight from the League client. No typing — your draft fills in live as picks and bans lock, and recommendations update in real time.</p>
        <a href="https://github.com/Kuderic/RabadonGG/releases" className="download-cta-btn" target="_blank" rel="noopener noreferrer" onClick={handleExternalLink}>{IC.download} Download for Windows</a>
        <div className="download-meta">
          <span><strong>v1.2.28</strong></span>
          <span>4.3 MB</span>
          <span>Installer (.exe)</span>
          <span><a href="https://github.com/Kuderic/RabadonGG/releases" target="_blank" rel="noopener noreferrer" onClick={handleExternalLink}>Release notes &amp; checksums</a></span>
        </div>
      </section>

      <section className="app-preview">
        <div className="app-preview-chrome">
          <div className="app-preview-dots"><i></i><i></i><i></i></div>
          <div className="app-preview-titlebar">Rabadon.GG — Desktop</div>
          <div className="app-preview-live"><i></i> Live · reading client</div>
        </div>
        <video
          src="/desktop-demo.mp4"
          className="app-preview-video"
          autoPlay muted loop playsInline
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'grid' }}
        />
        <div className="app-preview-body" style={{ display: 'none' }}>
          <div>
            <div className="app-preview-col-title ally">Allied Team</div>
            {allySlots.map(s => (
              <div className={`app-preview-slot ${s.cls}`} key={s.r}>
                {s.c ? <img src={champIconUrl(s.c)} alt="" onError={_onImgErr} /> : <span className="ps-empty"></span>}
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
                <img src={champIconUrl(s.c)} alt="" onError={_onImgErr} />
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
          <div className="download-platform">{IC.eye} Always-on-top · In game</div>
          <h2>The in-client overlay</h2>
          <p>A compact, draggable panel that floats over the client during champion select. Your top picks — and the math behind them — stay one glance away while you draft, no alt-tab required.</p>
          <div className="overlay-showcase-points">
            <div className="overlay-showcase-point">
              <span className="m">{IC.target}</span>
              <div><h4>Reads the live draft</h4><p>The matchup strip shows your role against the enemy team as picks lock in.</p></div>
            </div>
            <div className="overlay-showcase-point">
              <span className="m">{IC.win}</span>
              <div><h4>The edge, front and center</h4><p>Each pick leads with its draft-adjusted Δ, then the synergy and counter split behind it.</p></div>
            </div>
            <div className="overlay-showcase-point">
              <span className="m">{IC.sliders}</span>
              <div><h4>Stays out of your way</h4><p>Drag it anywhere; it remembers the spot. Click ✕ to tuck it away, hotkey to bring it back.</p></div>
            </div>
          </div>
        </div>
        <div className="overlay-stage">
          <div className="overlay-stage-hud">
            <i style={{ top: '8%', left: '6%', width: '24%', height: '12%' }} />
            <i style={{ top: '8%', right: '6%', width: '24%', height: '12%' }} />
            <i style={{ bottom: '10%', left: '12%', width: '76%', height: '9%' }} />
          </div>
          <OverlayShowcase />
        </div>
      </section>

      <section className="download-install hx-panel hx-ticks">
        <h3 className="download-install-title">Install in three steps</h3>
        <div className="install-steps">
          <div className="install-step"><span className="install-step-n">1</span><p>Download and run <strong>Rabadon_version_x64-setup.exe </strong>. Windows may show a SmartScreen notice — click <strong>More info → Run anyway</strong>.</p></div>
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
          <div className="download-safety-card hx-panel">
            <span className="download-safety-mark">{IC.github}</span>
            <div><h4>Open source</h4><p>The full source is public on <a href="https://github.com/Kuderic/RabadonGG" target="_blank" rel="noopener noreferrer" onClick={handleExternalLink}>GitHub</a>. Anyone can read, audit, and build it themselves — nothing is hidden.</p></div>
          </div>
          <div className="download-safety-card hx-panel">
            <span className="download-safety-mark">{IC.eye}</span>
            <div><h4>Read-only access</h4><p>It reads one local endpoint from the client to get the draft. It cannot pick, ban, click, or chat. No game data leaves your machine.</p></div>
          </div>
          <div className="download-safety-card hx-panel">
            <span className="download-safety-mark">{IC.badge}</span>
            <div><h4>Verified releases</h4><p>Each <a href="https://github.com/Kuderic/RabadonGG/releases" target="_blank" rel="noopener noreferrer" onClick={handleExternalLink}>release</a> ships a SHA256 checksum and VirusTotal scan link so you can verify the binary before running it.</p></div>
          </div>
          <div className="download-safety-card hx-panel">
            <span className="download-safety-mark">{IC.shield}</span>
            <div><h4>Riot ToS-safe</h4><p>Read-only LCU use is permitted by Riot's third-party policy. The app never automates gameplay or touches the game memory.</p></div>
          </div>
        </div>
      </section>
    </div>
  )
}

function parseMarkdown(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const lines = md.split('\n')
  let html = ''
  let inList = false
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false }
      html += `<h2 class="cl-h2">${inline(esc(line.slice(3)))}</h2>`
    } else if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false }
      html += `<h3 class="cl-h3">${inline(esc(line.slice(4)))}</h3>`
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul class="cl-list">'; inList = true }
      html += `<li>${inline(esc(line.slice(2)))}</li>`
    } else if (line === '') {
      if (inList) { html += '</ul>'; inList = false }
    } else {
      if (inList) { html += '</ul>'; inList = false }
      if (line) html += `<p class="cl-p">${inline(esc(line))}</p>`
    }
  }
  if (inList) html += '</ul>'
  return html
}

const GITHUB_RELEASES_URL = 'https://github.com/Kuderic/RabadonGG/releases'

function ChangelogModal({ onClose }) {
  const html = useMemo(() => parseMarkdown(releaseNotesRaw), [])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleReleasesLink = e => {
    if (IS_TAURI) {
      e.preventDefault()
      window.__TAURI__.core.invoke('open_url', { url: GITHUB_RELEASES_URL }).catch(() => {})
    }
  }

  return (
    <div className="changelog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="changelog-panel hx-panel">
        <div className="changelog-header">
          <span className="changelog-title">What&apos;s new</span>
          <button className="changelog-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="changelog-body" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="changelog-footer">
          <a
            href={GITHUB_RELEASES_URL}
            className="changelog-releases-link"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleReleasesLink}
          >
            View all releases on GitHub ↗
          </a>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('draft')
  const [role, setRole] = useState(_initialRole)
  const [viewRole, setViewRole] = useState(_initialRole)
  const [allies, setAllies] = useState(() => _url
    ? ROLE_ALLY_SLOTS[_url.role].map(s => ({ role: s, champion: _url.params.get(`a.${s}`) ?? '' }))
    : makeAllies(ROLE_ALLY_SLOTS[_initialRole] ?? ROLE_ALLY_SLOTS['adc']))
  const [enemies, setEnemies] = useState(() => _url
    ? ENEMY_SLOTS.map(s => ({ role: s, champion: _url.params.get(`e.${s}`) ?? '' }))
    : makeEnemies())
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [champions, setChampions] = useState([])
  // Data-derived primary role per champion (from lolalytics pick volume) — fallback
  // for champions missing from the hardcoded role map in utils/champion.js.
  const [championRoles, setChampionRoles] = useState({})
  const [patch, setPatch] = useState(
    _url?.params.get('patch') ?? localStorage.getItem('rabadon_patch') ?? '30'
  )
  const [tier, setTier] = useState(
    _url?.params.get('tier') ?? localStorage.getItem('rabadon_tier') ?? 'emerald_plus'
  )
  const [availablePatches, setAvailablePatches] = useState(['16.11'])
  const [selectedRec, setSelectedRec] = useState(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [lowDetail, setLowDetail] = useState(false)
  const [overlayEnabled, setOverlayEnabled] = useState(
    () => localStorage.getItem('rabadon_overlay_enabled') !== 'false'
  )
  const [overlayHotkey, setOverlayHotkey] = useState(
    // ?? not ||: an intentionally removed hotkey is stored as '' and must stay removed
    () => localStorage.getItem('rabadon_overlay_hotkey') ?? 'Ctrl+ArrowDown'
  )
  const [overlayScale, setOverlayScale] = useState(
    () => parseInt(localStorage.getItem('rabadon-overlay-scale') || '100', 10)
  )
  const [champBlacklist, setChampBlacklist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rabadon_champ_blacklist') || '{}') } catch { return {} }
  })
  const [overlayTransparent, setOverlayTransparent] = useState(
    () => localStorage.getItem('rabadon-overlay-transparent') !== 'false'
  )
  const [zoomLevel, setZoomLevel] = useState(
    () => parseFloat(localStorage.getItem('rabadon_zoom') || '1')
  )
  const [shareCopied, setShareCopied] = useState(false)
  const [manualOverrides, setManualOverrides] = useState(() => new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [lookupChampion, setLookupChampion] = useState(null)
  const [lookupResult, setLookupResult] = useState(null)
  const [updateInfo, setUpdateInfo] = useState(null)
  const [updateStatus, setUpdateStatus] = useState('idle')
  const [showChangelog, setShowChangelog] = useState(false)
  const [championPool, setChampionPool] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('rabadon_champion_pool') || '[]')
      // Migrate from old string[] format
      if (stored.length > 0 && typeof stored[0] === 'string') {
        return stored.map(champion => ({ champion, roles: [] }))
      }
      return stored
    }
    catch { return [] }
  })
  const [poolVariant, setPoolVariant] = useState(() => localStorage.getItem('rabadon_pool_variant') || 'lanes')
  const [wrModifiers, setWrModifiers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rabadon_wr_modifiers') || '{}') }
    catch { return {} }
  })
  const [poolResults, setPoolResults] = useState([])
  const [selectedPoolRec, setSelectedPoolRec] = useState(null)
  // Overlay "open this champion's breakdown" request; resolved by RecommendationList
  const [focusRequest, setFocusRequest] = useState(null)
  // Sticky top nav: shown when the real tab-nav is scrolled out of view
  const [showStickyNav, setShowStickyNav] = useState(false)
  const tabNavRef = useRef(null)
  const [myPick, setMyPick] = useState('')
  const [myPickResult, setMyPickResult] = useState(null)
  const [draftOverview, setDraftOverview] = useState(null)
  const [draftOverviewLoading, setDraftOverviewLoading] = useState(false)
  const [computeDraftRecs, setComputeDraftRecs] = useState(
    () => localStorage.getItem('rabadon_compute_draft_recs') === 'true'
  )
  const [sortMode, setSortMode] = useState(
    () => localStorage.getItem('rabadon_sort_mode') || 'wr_delta'
  )
  const debounceRef = useRef(null)
  const overviewDebounceRef = useRef(null)

  // Refs so handleSubmit can read current state without being in its dep array
  const recommendationsRef = useRef(recommendations)
  recommendationsRef.current = recommendations
  const selectedRecRef = useRef(selectedRec)
  selectedRecRef.current = selectedRec
  // Pool ref: lets handleSubmit read current pool without adding it to deps
  // (pool changes should NOT trigger auto-resubmit)
  const championPoolRef = useRef(championPool)
  championPoolRef.current = championPool
  const lookupChampionRef = useRef(lookupChampion)
  lookupChampionRef.current = lookupChampion
  const myPickRef = useRef(myPick)
  myPickRef.current = myPick
  // Enemies ref: lets the overlay storage listener resolve roles → slot indices
  const enemiesRef = useRef(enemies)
  enemiesRef.current = enemies

  const { connected: lcuConnected, session: lcuSession } = useLCUSession()
  const prevLcuPhaseRef = useRef(null)
  const prevLcuSessionPhaseRef = useRef(null)
  const overlayEnabledRef = useRef(overlayEnabled)
  overlayEnabledRef.current = overlayEnabled
  const champBlacklistRef = useRef(champBlacklist)
  champBlacklistRef.current = champBlacklist

  // Auto-fill draft form when the LCU session changes.
  // Role must be applied first so ally slots are rebuilt for the correct role
  // before champions are filled in — otherwise role-based slot matching fails.
  useEffect(() => {
    if (!lcuConnected || !lcuSession) {
      if (!lcuSession) prevLcuSessionPhaseRef.current = null
      return
    }

    // Detect new champion select session (null → truthy phase transition).
    // On a new session, manual overrides from the previous game must not block
    // the fresh LCU data from clearing old champions out of the slots.
    const isNewSession = !!lcuSession.phase && !prevLcuSessionPhaseRef.current
    prevLcuSessionPhaseRef.current = lcuSession.phase ?? null

    const knownRole = lcuSession.my_role && lcuSession.my_role !== 'fill' ? lcuSession.my_role : null
    const detectedRole = knownRole || role
    const slots = ROLE_ALLY_SLOTS[detectedRole] || ROLE_ALLY_SLOTS['adc']

    if (knownRole) {
      setRole(knownRole)
      setViewRole(knownRole)
    }

    // Build ally lookup: role → first ally with that role; collect fill-role allies separately
    const allyByRole = {}
    const fillAllies = []
    for (const a of lcuSession.allies) {
      if (a.role && a.role !== 'fill') {
        if (!allyByRole[a.role]) allyByRole[a.role] = a
      } else {
        fillAllies.push(a)
      }
    }
    let fillIdx = 0
    setAllies(makeAllies(slots).map(slot => {
      if (!isNewSession && manualOverrides.has(`ally.${slot.role}`)) {
        const existing = allies.find(a => a.role === slot.role)
        return existing || slot
      }
      if (allyByRole[slot.role]) return { ...slot, champion: allyByRole[slot.role].champion }
      // No ally assigned to this specific role — place next fill-role ally in this empty slot
      if (fillIdx < fillAllies.length) return { ...slot, champion: fillAllies[fillIdx++].champion }
      return { ...slot, champion: '' }
    }))

    const knownRoles = ['top','jungle','mid','adc','support']
    const filledSlots = {}

    // Champions the user manually pinned to a slot (e.g. dragged in the overlay)
    // are already placed — exclude them from auto-assignment entirely so they
    // don't consume the slot they were dragged OUT of, keeping that role free
    // for other hovers/lock-ins. On a new session overrides are stale (about to
    // be reset below), so nothing is excluded.
    const pinnedByUser = isNewSession ? new Set() : new Set(
      enemies
        .filter(s => manualOverrides.has(`enemy.${s.role}`) && s.champion.trim())
        .map(s => s.champion.toLowerCase())
    )

    // Pass 1: enemies with explicit known roles — no overwriting; slot collision defers to pass 2
    for (const e of lcuSession.enemies) {
      if (pinnedByUser.has(e.champion.toLowerCase())) continue
      if (e.role && e.role !== 'fill' && knownRoles.includes(e.role) && !filledSlots[e.role]) {
        filledSlots[e.role] = e.champion
      }
    }

    // Pass 2: all remaining unplaced enemies via primary → secondary → first empty slot
    const placed = new Set(Object.values(filledSlots))
    for (const e of lcuSession.enemies) {
      if (placed.has(e.champion)) continue
      if (pinnedByUser.has(e.champion.toLowerCase())) continue
      // Fall back to the data-derived role (from lolalytics pick volume) when the
      // champion isn't in the hardcoded map — avoids silently defaulting to top.
      const primary = champPrimaryRole(e.champion) || championRoles[e.champion] || null
      if (primary && !filledSlots[primary]) {
        filledSlots[primary] = e.champion
      } else {
        // Try secondary (flex) role before falling back to first empty slot
        const secondary = champSecondaryRole(e.champion)
        if (secondary && !filledSlots[secondary]) {
          filledSlots[secondary] = e.champion
        } else {
          for (const r of knownRoles) {
            if (!filledSlots[r]) { filledSlots[r] = e.champion; break }
          }
        }
      }
      placed.add(e.champion)
    }

    setEnemies(prev => {
      if (isNewSession) {
        // New session — fill from LCU only, ignoring any leftover manual overrides
        return prev.map(slot => ({ ...slot, champion: filledSlots[slot.role] || '' }))
      }
      // Champions the user has manually pinned to a specific slot — don't auto-fill these elsewhere
      const pinnedChamps = new Set(
        prev
          .filter(s => manualOverrides.has(`enemy.${s.role}`) && s.champion.trim())
          .map(s => s.champion.toLowerCase())
      )
      return prev.map(slot => {
        if (manualOverrides.has(`enemy.${slot.role}`)) return slot
        const champion = filledSlots[slot.role] || ''
        // Suppress auto-fill if this champion was already manually placed in another slot
        if (champion && pinnedChamps.has(champion.toLowerCase())) return { ...slot, champion: '' }
        return { ...slot, champion }
      })
    })

    if (isNewSession) {
      setManualOverrides(new Set())
      setRecommendations([])
      setPoolResults([])
      setSelectedRec(null)
      setSelectedPoolRec(null)
      setLookupChampion(null)
      setLookupResult(null)
      setError(null)
      setDraftOverview(null)
      setDraftOverviewLoading(false)
      setMyPick('')
      setMyPickResult(null)
      try { localStorage.removeItem('rabadon-overlay-dismissed') } catch {}
    }

    // Auto-fill "Your Pick" from LCU when the player locks their champion.
    if (lcuSession.my_locked_champ) {
      setMyPick(lcuSession.my_locked_champ)
    }
  }, [lcuSession, lcuConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show the overlay when champion select starts; hide it when it ends.
  useEffect(() => {
    if (!IS_TAURI) return
    const phase = lcuSession?.phase ?? null
    if (phase !== prevLcuPhaseRef.current) {
      if (phase && overlayEnabledRef.current && !localStorage.getItem('rabadon-overlay-dismissed')) {
        window.__TAURI__.core.invoke('control_overlay', { action: 'show' }).catch(() => {})
      } else if (prevLcuPhaseRef.current) {
        window.__TAURI__.core.invoke('control_overlay', { action: 'hide' }).catch(() => {})
      }
      prevLcuPhaseRef.current = phase
    }
  }, [lcuSession?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem('rabadon_champion_pool', JSON.stringify(championPool))
  }, [championPool])

  useEffect(() => {
    localStorage.setItem('rabadon_pool_variant', poolVariant)
  }, [poolVariant])

  useEffect(() => {
    localStorage.setItem('rabadon_wr_modifiers', JSON.stringify(wrModifiers))
  }, [wrModifiers])

  useEffect(() => {
    localStorage.setItem('rabadon_role', role)
  }, [role])

  useEffect(() => {
    localStorage.setItem('rabadon_patch', patch)
  }, [patch])

  useEffect(() => {
    localStorage.setItem('rabadon_tier', tier)
  }, [tier])

  useEffect(() => {
    localStorage.setItem('rabadon_compute_draft_recs', String(computeDraftRecs))
  }, [computeDraftRecs])

  useEffect(() => {
    localStorage.setItem('rabadon_sort_mode', sortMode)
  }, [sortMode])

  useEffect(() => {
    localStorage.setItem('rabadon_champ_blacklist', JSON.stringify(champBlacklist))
  }, [champBlacklist])

  useEffect(() => {
    if (selectedRec === null || !recommendations[selectedRec]) return
    const bl = new Set((champBlacklist[role] || []).map(c => c.toLowerCase()))
    if (bl.has(recommendations[selectedRec].champion.toLowerCase())) setSelectedRec(null)
  }, [champBlacklist, role]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem('rabadon_overlay_enabled', String(overlayEnabled))
    if (!overlayEnabled && IS_TAURI) {
      window.__TAURI__.core.invoke('control_overlay', { action: 'hide' }).catch(() => {})
    }
  }, [overlayEnabled])

  // Register the overlay hotkey with Tauri on startup and whenever it changes.
  useEffect(() => {
    localStorage.setItem('rabadon_overlay_hotkey', overlayHotkey)
    if (!IS_TAURI) return
    window.__TAURI__.core.invoke('set_overlay_shortcut', { shortcut: overlayHotkey }).catch(() => {})
  }, [overlayHotkey])

  useEffect(() => {
    localStorage.setItem('rabadon-overlay-scale', String(overlayScale))
  }, [overlayScale])

  useEffect(() => {
    localStorage.setItem('rabadon-overlay-transparent', String(overlayTransparent))
  }, [overlayTransparent])

  // Publish the resolved draft to localStorage so the overlay window can read it.
  // The overlay reads this instead of doing its own LCU role-resolution, so manual
  // enemy slot corrections in the main app are always reflected in the overlay.
  useEffect(() => {
    if (!IS_DESKTOP) return
    try {
      localStorage.setItem('rabadon-overlay-draft', JSON.stringify({
        phase: lcuSession?.phase ?? null,
        role,
        allies,
        enemies,
        patch,
        tier,
        pool: championPool,
        intentChamp: lcuSession?.intent_champ ?? null,
        lockedChamp: lcuSession?.my_locked_champ ?? null,
      }))
    } catch (_) {}
  }, [role, allies, enemies, patch, tier, lcuSession?.phase, lcuSession?.intent_champ, lcuSession?.my_locked_champ])

  useEffect(() => {
    if (!IS_TAURI) return
    localStorage.setItem('rabadon_zoom', String(zoomLevel))
    // Zoom is applied via inline style on the wrapper div inside .app-container
    // (not on documentElement) so scrollIntoView only ever scrolls .app-container.
  }, [zoomLevel])

  // Overlay → main: when user clicks a pick in the overlay, focus this window and
  // select its breakdown card if the champion is in the top-10 results, otherwise
  // fall back to the lookup input.
  useEffect(() => {
    if (!IS_DESKTOP) return
    const handler = e => {
      if (e.key === 'rabadon-overlay-focus') {
        if (!e.newValue) return
        let champion
        try { champion = JSON.parse(e.newValue).champion } catch { return }
        if (!champion) return
        setActiveTab('draft')
        const overlaySort = localStorage.getItem('rabadon-overlay-sort')
        if (overlaySort === 'delta' || overlaySort === 'wr_delta') setSortMode(overlaySort)
        // Resolution happens in RecommendationList, which owns the Overall/My
        // Champions tab state and the sorted pool order needed to reveal the card.
        setFocusRequest({ champion, ts: Date.now() })
      } else if (e.key === 'rabadon-overlay-nav') {
        if (!e.newValue) return
        try {
          if (JSON.parse(e.newValue).tab === 'overview') setActiveTab('overview')
        } catch (_) {}
      } else if (e.key === 'rabadon-overlay-scale') {
        // Overlay corner-drag resize — keep the Settings slider in sync
        const v = parseInt(e.newValue || '', 10)
        if (!Number.isNaN(v)) setOverlayScale(v)
      } else if (e.key === 'rabadon-overlay-roleswap') {
        // Overlay dragged an enemy icon to a different lane slot
        if (!e.newValue) return
        try {
          const { from, to } = JSON.parse(e.newValue)
          const slots = enemiesRef.current
          const fromIdx = slots.findIndex(s => s.role === from)
          const toIdx = slots.findIndex(s => s.role === to)
          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) handleEnemySwap(fromIdx, toIdx)
        } catch (_) {}
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Compute and publish draft advantage data for the overlay whenever draftOverview changes.
  useEffect(() => {
    if (!IS_DESKTOP) return
    if (!draftOverview) {
      try { localStorage.removeItem('rabadon-overlay-advantage') } catch {}
      return
    }
    const allyDelta = draftOverview.ally.filter(s => s.locked && s.rec).reduce(
      (sum, s) => sum + computeComponents(s.rec, config, s.role).totalDelta, 0)
    const enemyDelta = draftOverview.enemy.filter(s => s.locked && s.rec).reduce(
      (sum, s) => sum + computeComponents(s.rec, config, s.role).totalDelta, 0)
    const allyLocked = draftOverview.ally.filter(s => s.locked).length
    const enemyLocked = draftOverview.enemy.filter(s => s.locked).length
    try {
      localStorage.setItem('rabadon-overlay-advantage', JSON.stringify({ allyDelta, enemyDelta, allyLocked, enemyLocked }))
    } catch {}
  }, [draftOverview, config])

  useEffect(() => {
    if (!IS_TAURI) return
    const onKey = e => {
      if (!e.ctrlKey) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        setZoomLevel(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))
      } else if (e.key === '-') {
        e.preventDefault()
        setZoomLevel(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))
      } else if (e.key === '0') {
        e.preventDefault()
        setZoomLevel(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    getChampions().then(({ names, primaryRoles }) => {
      setChampions(names)
      setChampionRoles(primaryRoles)
    }).catch(() => {})
    getPatches().then(patches => {
      setAvailablePatches(patches)
      // Auto-select latest patch only for first-time web users (no saved pref, no URL param)
      const noPreference = !_url?.params.get('patch') && !localStorage.getItem('rabadon_patch')
      if (patches.length > 0 && !IS_DESKTOP && noPreference) {
        setPatch(patches[0])
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) return
    let cancelled = false
    async function checkForUpdate() {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (!cancelled && update?.available) {
          setUpdateInfo({ version: update.version, body: update.body ?? '' })
          window.__pendingUpdate = update
        }
      } catch (e) {
        console.warn('[updater] check failed', e)
      }
    }
    checkForUpdate()
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const handlePoolAdd = useCallback((champion, roles = []) => {
    setChampionPool(prev => {
      if (prev.some(p => p.champion.toLowerCase() === champion.toLowerCase())) return prev
      return [...prev, { champion, roles }]
    })
  }, [])

  const handlePoolRemove = useCallback((champion) => {
    setChampionPool(prev => prev.filter(p => p.champion.toLowerCase() !== champion.toLowerCase()))
    setWrModifiers(prev => {
      const next = { ...prev }
      delete next[champion]
      return next
    })
  }, [])

  const handlePoolRoleChange = useCallback((champion, roles) => {
    setChampionPool(prev => prev.map(p =>
      p.champion.toLowerCase() === champion.toLowerCase() ? { ...p, roles } : p
    ))
  }, [])

  const addRole = useCallback((champion, role) => {
    setChampionPool(prev => {
      const i = prev.findIndex(p => p.champion.toLowerCase() === champion.toLowerCase())
      if (i === -1) {
        return [...prev, { champion, roles: [role] }]
      }
      if (prev[i].roles.includes(role)) return prev
      const next = [...prev]
      next[i] = { ...next[i], roles: [...next[i].roles, role] }
      return next
    })
  }, [])

  const removeRole = useCallback((champion, role) => {
    setChampionPool(prev => prev.flatMap(p => {
      if (p.champion.toLowerCase() !== champion.toLowerCase()) return [p]
      const roles = p.roles.filter(r => r !== role)
      return roles.length ? [{ ...p, roles }] : []
    }))
  }, [])

  const toggleRole = useCallback((champion, role) => {
    setChampionPool(prev => {
      const p = prev.find(x => x.champion.toLowerCase() === champion.toLowerCase())
      if (p && p.roles.includes(role)) return prev.flatMap(x => {
        if (x.champion.toLowerCase() !== champion.toLowerCase()) return [x]
        const roles = x.roles.filter(r => r !== role)
        return roles.length ? [{ ...x, roles }] : []
      })
      const i = prev.findIndex(x => x.champion.toLowerCase() === champion.toLowerCase())
      if (i === -1) return [...prev, { champion, roles: [role] }]
      const next = [...prev]
      next[i] = { ...next[i], roles: [...next[i].roles, role] }
      return next
    })
  }, [])

  const handleEnemySwap = useCallback((fromIdx, toIdx) => {
    setEnemies(prev => {
      const next = [...prev]
      const fromChamp = next[fromIdx].champion
      const toChamp = next[toIdx].champion
      next[fromIdx] = { ...next[fromIdx], champion: toChamp }
      next[toIdx] = { ...next[toIdx], champion: fromChamp }
      setManualOverrides(overrides => {
        const nextOverrides = new Set(overrides)
        if (toChamp.trim()) nextOverrides.add(`enemy.${next[fromIdx].role}`)
        else nextOverrides.delete(`enemy.${next[fromIdx].role}`)
        if (fromChamp.trim()) nextOverrides.add(`enemy.${next[toIdx].role}`)
        else nextOverrides.delete(`enemy.${next[toIdx].role}`)
        return nextOverrides
      })
      return next
    })
  }, [])

  const handleModifierChange = useCallback((champion, value) => {
    setWrModifiers(prev => {
      const next = { ...prev }
      if (value === 0) delete next[champion]
      else next[champion] = value
      return next
    })
  }, [])

  const handleRoleChange = (newRole) => {
    setRole(newRole)
    setViewRole(newRole)
    setAllies(makeAllies(ROLE_ALLY_SLOTS[newRole] || ROLE_ALLY_SLOTS['adc'], allies))
    setSelectedRec(null)
    setSelectedPoolRec(null)
  }

  const handleViewRoleChange = useCallback((r) => {
    setViewRole(r)
    setSelectedRec(null)
    setSelectedPoolRec(null)
  }, [])

  // Show the sticky nav whenever the real tab-nav leaves the viewport.
  // IntersectionObserver accounts for ancestor clipping, so this works for both
  // scroll modes: document scrolling (web) and .app-container scrolling (desktop).
  useEffect(() => {
    const el = tabNavRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setShowStickyNav(!entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const handleStickyNav = useCallback((tab) => {
    setActiveTab(tab)
    // Scroll whichever container scrolls: .app-container on desktop, the document on web
    document.querySelector('.app-container')?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleAllyChange = (index, champion) => {
    const norm = s => s.trim().toLowerCase()
    const champNorm = norm(champion)
    // Clear this champion from any other ally or enemy slot that already has it
    const updatedAllies = allies.map((a, i) => {
      if (i === index) return { ...a, champion }
      if (champNorm && norm(a.champion) === champNorm) return { ...a, champion: '' }
      return a
    })
    const updatedEnemies = champNorm
      ? enemies.map(e => norm(e.champion) === champNorm ? { ...e, champion: '' } : e)
      : enemies
    setAllies(updatedAllies)
    setEnemies(updatedEnemies)
    setManualOverrides(prev => {
      const next = new Set(prev)
      const key = `ally.${allies[index].role}`
      if (champion.trim()) next.add(key)
      else next.delete(key)
      // Drop override for any enemy slot we just cleared
      if (champNorm) {
        enemies.forEach(e => {
          if (norm(e.champion) === champNorm) next.delete(`enemy.${e.role}`)
        })
        allies.forEach((a, i) => {
          if (i !== index && norm(a.champion) === champNorm) next.delete(`ally.${a.role}`)
        })
      }
      return next
    })
  }

  const handleEnemyChange = (index, champion) => {
    const norm = s => s.trim().toLowerCase()
    const champNorm = norm(champion)
    // Clear this champion from any other enemy or ally slot that already has it
    const updatedEnemies = enemies.map((e, i) => {
      if (i === index) return { ...e, champion }
      if (champNorm && norm(e.champion) === champNorm) return { ...e, champion: '' }
      return e
    })
    const updatedAllies = champNorm
      ? allies.map(a => norm(a.champion) === champNorm ? { ...a, champion: '' } : a)
      : allies
    setEnemies(updatedEnemies)
    setAllies(updatedAllies)
    setManualOverrides(prev => {
      const next = new Set(prev)
      const key = `enemy.${enemies[index].role}`
      if (champion.trim()) next.add(key)
      else next.delete(key)
      // Drop override for any ally slot we just cleared
      if (champNorm) {
        allies.forEach(a => {
          if (norm(a.champion) === champNorm) next.delete(`ally.${a.role}`)
        })
        enemies.forEach((e, i) => {
          if (i !== index && norm(e.champion) === champNorm) next.delete(`enemy.${e.role}`)
        })
      }
      return next
    })
  }

  const handleSubmit = useCallback(async () => {
    setError(null)
    const prevRecs = recommendationsRef.current
    const prevIdx = selectedRecRef.current

    if (prevRecs.length === 0) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      // Build allies as seen from viewRole: all roles except viewRole, carrying
      // whatever champion is known (including your own role slot, left empty).
      const currentMyPick = myPickRef.current?.trim() || ''
      const allAllies = {}
      allies.forEach(a => { allAllies[a.role] = a.champion })
      // When viewing another role, the player's locked champion is a known ally
      if (viewRole !== role && currentMyPick) {
        allAllies[role] = currentMyPick
      } else {
        allAllies[role] = allAllies[role] ?? ''
      }
      const alliesForView = ROLES
        .filter(r => r !== viewRole)
        .map(r => ({ role: r, champion: allAllies[r] || '' }))

      const poolForRole = championPoolRef.current
        .filter(p => p.roles.length === 0 || p.roles.includes(viewRole))
        .map(p => p.champion)
      const currentLookup = lookupChampionRef.current
      if (currentLookup && !poolForRole.some(c => c.toLowerCase() === currentLookup.toLowerCase())) {
        poolForRole.push(currentLookup)
      }
      // Only add myPick to pool when scoring the player's own role (otherwise it's an ally)
      if (viewRole === role && currentMyPick && !poolForRole.some(c => c.toLowerCase() === currentMyPick.toLowerCase())) {
        poolForRole.push(currentMyPick)
      }
      const result = await getRecommendations(
        viewRole,
        alliesForView.filter(a => a.champion.trim()),
        enemies.filter(e => e.champion.trim()),
        patch,
        tier,
        poolForRole
      )
      const newRecs = result.recommendations || []
      setRecommendations(newRecs)
      const allPoolPicks = result.pool_picks || []
      // Extract "Your Pick" result
      if (currentMyPick) {
        const mpRec = allPoolPicks.find(p => p.champion.toLowerCase() === currentMyPick.toLowerCase())
        setMyPickResult(mpRec ?? null)
      } else {
        setMyPickResult(null)
      }
      const currentLookupName = lookupChampionRef.current
      if (currentLookupName) {
        const lr = allPoolPicks.find(p => p.champion.toLowerCase() === currentLookupName.toLowerCase())
        setLookupResult(lr ?? null)
        setPoolResults(allPoolPicks.filter(p => p.champion.toLowerCase() !== currentLookupName.toLowerCase()))
      } else {
        setLookupResult(null)
        setPoolResults(allPoolPicks)
      }
      setSelectedPoolRec(null)

      // Restore the open breakdown to the same champion if it's still in the new list and not blacklisted
      if (prevIdx !== null && prevRecs[prevIdx]) {
        const prevChamp = prevRecs[prevIdx].champion
        const bl = new Set((champBlacklistRef.current[role] || []).map(c => c.toLowerCase()))
        const newIdx = newRecs.findIndex(r => r.champion === prevChamp)
        setSelectedRec(newIdx >= 0 && !bl.has(prevChamp.toLowerCase()) ? newIdx : null)
      }
    } catch (err) {
      setError('Failed to get recommendations. Is the backend running?')
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [role, viewRole, allies, enemies, patch, tier])

  // Check if at least one entered value matches a known champion name
  const hasValidChampion = useMemo(() => {
    const champSet = new Set(champions.map(c => c.toLowerCase()))
    return allies.some(a => champSet.has(a.champion.trim().toLowerCase())) ||
           enemies.some(e => champSet.has(e.champion.trim().toLowerCase()))
  }, [allies, enemies, champions])

  // Auto-submit: debounce 600ms after any champion/patch/tier/role change
  useEffect(() => {
    if (!hasValidChampion) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(handleSubmit, 600)
    return () => clearTimeout(debounceRef.current)
  }, [handleSubmit, hasValidChampion, lookupChampion, myPick])

  // Draft overview: fetch whenever the draft changes (debounced 800ms)
  useEffect(() => {
    if (!hasValidChampion) { setDraftOverview(null); return }
    clearTimeout(overviewDebounceRef.current)
    overviewDebounceRef.current = setTimeout(async () => {
      setDraftOverviewLoading(true)
      try {
        // Build full 5-slot ally array (player's own slot is always open)
        const isSpectating = !!(lcuSession?.spectating)
        const myLockedChamp = lcuSession?.my_locked_champ ?? null
        const myPickChamp = myPickRef.current?.trim() || null
        const allySlots = ROLES.map(r => {
          // Player's own slot: LCU lock-in takes priority; fall back to manual "Your Pick" input
          if (r === role && !isSpectating) {
            const champ = myLockedChamp || myPickChamp
            return { role: r, champion: champ, locked: !!champ }
          }
          const a = allies.find(x => x.role === r)
          let champ = a?.champion?.trim() || null
          // Spectate: the "your role" champion lives in lcuSession.allies (not the allies state)
          if (!champ && isSpectating && lcuSession?.allies) {
            champ = lcuSession.allies.find(x => x.role === r)?.champion?.trim() || null
          }
          return { role: r, champion: champ, locked: !!champ }
        })
        const enemySlots = enemies.map(e => {
          const champ = e.champion.trim() || null
          return { role: e.role, champion: champ, locked: !!champ }
        })
        // Don't fetch if no champions have been locked — avoids scoring 175+ candidates × 9 open slots
        const lockedCount = allySlots.filter(s => s.locked).length + enemySlots.filter(s => s.locked).length
        if (lockedCount === 0) { setDraftOverviewLoading(false); return }
        // In spectate mode there is no "you" — all 10 slots are equal
        const you = isSpectating ? null : { side: 'ally', role }
        const data = await getDraftOverview(allySlots, enemySlots, patch, tier, you, computeDraftRecs)
        setDraftOverview(data)
      } catch (err) {
        console.error('[draft-overview]', err)
      } finally {
        setDraftOverviewLoading(false)
      }
    }, 800)
    return () => clearTimeout(overviewDebounceRef.current)
  }, [allies, enemies, patch, tier, role, hasValidChampion, computeDraftRecs, myPick, lcuSession?.spectating, lcuSession?.my_locked_champ]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep URL in sync with draft state so any URL can be shared
  useEffect(() => {
    const p = new URLSearchParams()
    p.set('role', role)
    allies.forEach(a => { if (a.champion.trim()) p.set(`a.${a.role}`, a.champion.trim()) })
    enemies.forEach(e => { if (e.champion.trim()) p.set(`e.${e.role}`, e.champion.trim()) })
    p.set('patch', patch)
    p.set('tier', tier)
    window.history.replaceState(null, '', `?${p}`)
  }, [role, allies, enemies, patch, tier])

  const handleInstallUpdate = useCallback(async () => {
    if (!window.__pendingUpdate) return
    setUpdateStatus('downloading')
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await window.__pendingUpdate.downloadAndInstall()
      await relaunch()
    } catch (e) {
      console.error('[updater] install failed', e)
      setUpdateStatus('error')
    }
  }, [])

  const handleDismissUpdate = useCallback(() => {
    setUpdateInfo(null)
    setUpdateStatus('idle')
  }, [])

  const handleShare = useCallback(() => {
    let url = window.location.href
    if (import.meta.env.VITE_DESKTOP) {
      url = 'https://www.rabadon.gg' + window.location.pathname + window.location.search
    }
    navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [])

  return (
    <>
      {IS_DESKTOP && <TitleBar lcuConnected={lcuConnected} lcuSession={lcuSession} version={__APP_VERSION__} onShowChangelog={() => setShowChangelog(true)} />}
      <div className={`sticky-nav${showStickyNav ? ' sticky-nav--visible' : ''}`} aria-hidden={!showStickyNav}>
        <img src="/rabadon.png" alt="" className="sticky-nav-logo" />
        <button
          className={`sticky-nav-btn ${activeTab === 'draft' ? 'sticky-nav-btn--active' : ''}`}
          onClick={() => handleStickyNav('draft')}
          tabIndex={showStickyNav ? 0 : -1}
        >Recommend</button>
        <button
          className={`sticky-nav-btn ${activeTab === 'overview' ? 'sticky-nav-btn--active' : ''}`}
          onClick={() => handleStickyNav('overview')}
          tabIndex={showStickyNav ? 0 : -1}
        >Draft</button>
      </div>
      <div className="app-container" data-fx="refined" data-detail={lowDetail ? 'low' : undefined}>
      <div style={IS_TAURI ? { zoom: zoomLevel } : undefined}>
      {updateInfo && (
        <div className="update-banner" role="status" aria-live="polite">
          <span className="update-banner-text">
            Version <strong>{updateInfo.version}</strong> is available
          </span>
          <button
            className="update-banner-btn"
            onClick={handleInstallUpdate}
            disabled={updateStatus === 'downloading'}
          >
            {updateStatus === 'downloading' ? 'Installing…' : 'Update now'}
          </button>
          <button
            className="update-banner-dismiss"
            onClick={handleDismissUpdate}
            aria-label="Dismiss update notification"
          >✕</button>
          {updateStatus === 'error' && (
            <span className="update-banner-error">Install failed — check your connection</span>
          )}
        </div>
      )}
      <header className="header">
        <div className="header-secondary">
          <button
            className={`header-secondary-link ${activeTab === 'about' ? 'header-secondary-link--active' : ''}`}
            onClick={() => setActiveTab('about')}
          >About</button>
          {!import.meta.env.VITE_DESKTOP && (
            <button
              className={`header-secondary-link ${activeTab === 'download' ? 'header-secondary-link--active' : ''}`}
              onClick={() => setActiveTab('download')}
            >Download</button>
          )}
          <span className="header-secondary-sep" />
          <a
            href="https://github.com/Kuderic/RabadonGG"
            className="header-github-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            onClick={handleExternalLink}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
        <div className="header-logo">
          <img src="/rabadon.png" alt="" className="header-logo-img" />
          <h1>Rabadon.GG</h1>
        </div>
        <p>Real-time champion select analysis</p>
      </header>

      <nav className="tab-nav" ref={tabNavRef}>
        <button
          className={`tab-btn ${activeTab === 'draft' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('draft')}
        >Recommend</button>
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >Draft</button>
        <button
          className={`tab-btn ${activeTab === 'config' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('config')}
        >Settings</button>
      </nav>

      <main>
        {(activeTab === 'about' || activeTab === 'download') && (
          <div className="secondary-context-bar">
            <span>You're viewing {activeTab === 'about' ? 'About' : 'Download'}</span>
            <button onClick={() => setActiveTab('draft')}>← Back to the app</button>
          </div>
        )}
        {activeTab === 'draft' && (
          <>
            <DraftForm
              role={role}
              allies={allies}
              enemies={enemies}
              champions={champions}
              onRoleChange={handleRoleChange}
              onAllyChange={handleAllyChange}
              onEnemyChange={handleEnemyChange}
              onEnemySwap={handleEnemySwap}
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
              patch={patch}
              tier={tier}
              onShare={handleShare}
              shareCopied={shareCopied}
              onClear={() => {
                setAllies(makeAllies(ROLE_ALLY_SLOTS[role]))
                setEnemies(makeEnemies())
                setRecommendations([])
                setSelectedRec(null)
                setSelectedPoolRec(null)
                setError(null)
                setManualOverrides(new Set())
                setLookupChampion(null)
                setLookupResult(null)
                setDraftOverview(null)
                setMyPick('')
                setMyPickResult(null)
              }}
              lcuConnected={lcuConnected}
              lcuSession={lcuSession}
              myPick={myPick}
              onMyPickChange={setMyPick}
            />

            {(recommendations.length > 0 || loading) && (
              <div className="results-section">
                <Suspense fallback={null}>
                  <RecommendationList
                    recommendations={recommendations}
                    loading={loading}
                    refreshing={refreshing}
                    focusRequest={focusRequest}
                    onFocusResolved={() => setFocusRequest(null)}
                    selectedIndex={selectedRec}
                    onSelect={(idx) => { setSelectedRec(idx); if (idx !== null) setSelectedPoolRec(null) }}
                    config={config}
                    playerRole={viewRole}
                    youRole={role}
                    onViewRoleChange={handleViewRoleChange}
                    onTogglePenalty={() => setConfig(c => ({ ...c, penalize: !c.penalize }))}
                    poolResults={poolResults}
                    selectedPoolRec={selectedPoolRec}
                    onSelectPoolRec={(idx) => { setSelectedPoolRec(idx); if (idx !== null) setSelectedRec(null) }}
                    wrModifiers={wrModifiers}
                    poolChampions={new Set(
                      championPool
                        .filter(p => p.roles.length === 0 || p.roles.includes(viewRole))
                        .map(p => p.champion.toLowerCase())
                    )}
                    tier={tier}
                    patch={patch}
                    champions={champions}
                    lookupChampion={lookupChampion}
                    lookupResult={lookupResult}
                    onLookupChange={setLookupChampion}
                    onAddToPool={(champion, role) => handlePoolAdd(champion, [role])}
                    onRemoveFromPool={handlePoolRemove}
                    sortMode={sortMode}
                    onSortModeChange={setSortMode}
                    champBlacklist={champBlacklist}
                    myPickRec={myPickResult}
                  />
                </Suspense>
              </div>
            )}

          </>
        )}

        {activeTab === 'overview' && (
          <Suspense fallback={null}>
            <DraftOverview
              overviewData={draftOverview}
              loading={draftOverviewLoading}
              youRole={role}
              config={config}
              patch={patch}
              tier={tier}
              computeDraftRecs={computeDraftRecs}
              onComputeDraftRecsChange={setComputeDraftRecs}
            />
          </Suspense>
        )}

        {activeTab === 'config' && (
          <Suspense fallback={null}>
            <ConfigPanel
              config={config}
              onChange={setConfig}
              defaultConfig={DEFAULT_CONFIG}
              patch={patch}
              tier={tier}
              availablePatches={availablePatches}
              onPatchChange={setPatch}
              onTierChange={setTier}
              lowDetail={lowDetail}
              onLowDetailChange={setLowDetail}
              overlayEnabled={overlayEnabled}
              onOverlayEnabledChange={setOverlayEnabled}
              overlayHotkey={overlayHotkey}
              onOverlayHotkeyChange={setOverlayHotkey}
              overlayScale={overlayScale}
              onOverlayScaleChange={setOverlayScale}
              overlayTransparent={overlayTransparent}
              onOverlayTransparentChange={setOverlayTransparent}
              pool={championPool}
              onPoolAdd={handlePoolAdd}
              onPoolRemove={handlePoolRemove}
              onPoolRoleChange={handlePoolRoleChange}
              poolVariant={poolVariant}
              onPoolVariantChange={setPoolVariant}
              onAddRole={addRole}
              onRemoveRole={removeRole}
              onToggleRole={toggleRole}
              champions={champions}
              playerRole={role}
              wrModifiers={wrModifiers}
              onModifierChange={handleModifierChange}
              computeDraftRecs={computeDraftRecs}
              onComputeDraftRecsChange={setComputeDraftRecs}
              champBlacklist={champBlacklist}
              onChampBlacklistChange={setChampBlacklist}
            />
          </Suspense>
        )}

        {activeTab === 'download' && !import.meta.env.VITE_DESKTOP && (
          <DownloadPanel />
        )}

        {activeTab === 'about' && (
          <AboutPanel />
        )}

      </main>
      <footer className="site-footer">
        <p>Rabadon.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
      </footer>
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      </div>{/* end zoom wrapper */}
    </div>
    </>
  )
}
