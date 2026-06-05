import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import DraftForm from './components/DraftForm'
import { getRecommendations, getChampions, getPatches } from './api/client'
import { useLCUSession } from './services/lcu'
import { champPrimaryRole, champIconUrl } from './utils/champion'

const RecommendationList = lazy(() => import('./components/RecommendationList'))
const ConfigPanel = lazy(() => import('./components/ConfigPanel'))

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
  penalizeThreshold: 1000,
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
          <h2 className="about-heading">Made by Kuderic — a Challenger main</h2>
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
          <p className="about-subheading">Every rating starts from the champion's base win rate, then adds two draft-aware adjustments. Here's a real example for an <strong>ADC</strong> pick:</p>
        </div>
        <div className="about-example">
          <div className="about-eq">
            <div className="about-eq-champ">
              <img src={champIconUrl('Ezreal')} alt="" onError={_onImgErr} />
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
        <p>Counter and synergy win rates are computed on our servers from the official <strong>Riot Games API</strong>. Choose your patch window (current, previous, or a rolling 30-day aggregate) and rank tier in the <strong>Configuration</strong> tab.</p>
      </div>
    </div>
  )
}

function DownloadPanel() {
  const allySlots = [
    { r: 'TOP', c: 'Aatrox', cls: 'ally' },
    { r: 'JG', c: 'Vi', cls: 'ally' },
    { r: 'MID', c: 'Ahri', cls: 'ally' },
    { r: 'ADC', c: null, cls: 'you' },
    { r: 'SUP', c: 'Thresh', cls: 'ally' },
  ]
  const enemySlots = [
    { r: 'TOP', c: 'Darius' }, { r: 'JG', c: 'Lee Sin' }, { r: 'MID', c: 'Zed' },
    { r: 'ADC', c: 'Caitlyn' }, { r: 'SUP', c: 'Leona' },
  ]
  return (
    <div className="download-panel">
      <section className="download-hero hx-panel hx-ticks">
        <div className="download-platform">{IC.windows} Windows 10 / 11</div>
        <div className="download-hero-title">The Desktop App</div>
        <p className="download-hero-sub">It reads your champion select straight from the League client. No typing — your draft fills in live as picks and bans lock, and recommendations update in real time.</p>
        <a href="https://github.com/Kuderic/RabadonGG/releases" className="download-cta-btn" target="_blank" rel="noopener noreferrer">{IC.download} Download for Windows</a>
        <div className="download-meta">
          <span><strong>v1.0.1</strong></span>
          <span>4.3 MB</span>
          <span>Installer (.exe)</span>
          <span><a href="https://github.com/Kuderic/RabadonGG/releases" target="_blank" rel="noopener noreferrer">Release notes &amp; checksums</a></span>
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
            <div><h4>Open source</h4><p>The full source is public on <a href="https://github.com/Kuderic/RabadonGG" target="_blank" rel="noopener noreferrer">GitHub</a>. Anyone can read, audit, and build it themselves — nothing is hidden.</p></div>
          </div>
          <div className="download-safety-card hx-panel">
            <span className="download-safety-mark">{IC.eye}</span>
            <div><h4>Read-only access</h4><p>It reads one local endpoint from the client to get the draft. It cannot pick, ban, click, or chat. No game data leaves your machine.</p></div>
          </div>
          <div className="download-safety-card hx-panel">
            <span className="download-safety-mark">{IC.badge}</span>
            <div><h4>Verified releases</h4><p>Each <a href="https://github.com/Kuderic/RabadonGG/releases" target="_blank" rel="noopener noreferrer">release</a> ships a SHA256 checksum and VirusTotal scan link so you can verify the binary before running it.</p></div>
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

export default function App() {
  const [activeTab, setActiveTab] = useState('draft')
  const [role, setRole] = useState(_url?.role ?? 'adc')
  const [allies, setAllies] = useState(() => _url
    ? ROLE_ALLY_SLOTS[_url.role].map(s => ({ role: s, champion: _url.params.get(`a.${s}`) ?? '' }))
    : makeAllies(ROLE_ALLY_SLOTS['adc']))
  const [enemies, setEnemies] = useState(() => _url
    ? ENEMY_SLOTS.map(s => ({ role: s, champion: _url.params.get(`e.${s}`) ?? '' }))
    : makeEnemies())
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [champions, setChampions] = useState([])
  const [patch, setPatch] = useState(_url?.params.get('patch') ?? '16.11')
  const [tier, setTier] = useState(_url?.params.get('tier') ?? 'emerald_plus')
  const [availablePatches, setAvailablePatches] = useState(['16.11'])
  const [selectedRec, setSelectedRec] = useState(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [lowDetail, setLowDetail] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [manualOverrides, setManualOverrides] = useState(() => new Set())
  const [refreshing, setRefreshing] = useState(false)
  const debounceRef = useRef(null)

  // Refs so handleSubmit can read current state without being in its dep array
  const recommendationsRef = useRef(recommendations)
  recommendationsRef.current = recommendations
  const selectedRecRef = useRef(selectedRec)
  selectedRecRef.current = selectedRec

  const { connected: lcuConnected, session: lcuSession } = useLCUSession()

  // Auto-fill draft form when the LCU session changes.
  // Role must be applied first so ally slots are rebuilt for the correct role
  // before champions are filled in — otherwise role-based slot matching fails.
  useEffect(() => {
    if (!lcuConnected || !lcuSession) return

    const detectedRole = lcuSession.my_role || role
    const slots = ROLE_ALLY_SLOTS[detectedRole] || ROLE_ALLY_SLOTS['adc']

    if (lcuSession.my_role) setRole(lcuSession.my_role)

    setAllies(makeAllies(slots).map(slot => {
      if (manualOverrides.has(`ally.${slot.role}`)) {
        const existing = allies.find(a => a.role === slot.role)
        return existing || slot
      }
      const match = lcuSession.allies.find(a => a.role === slot.role)
      return match ? { ...slot, champion: match.champion } : slot
    }))

    const knownRoles = ['top','jungle','mid','adc','support']
    const filledSlots = {}

    for (const e of lcuSession.enemies) {
      if (e.role && e.role !== 'fill' && knownRoles.includes(e.role)) {
        filledSlots[e.role] = e.champion
      }
    }

    for (const e of lcuSession.enemies) {
      if (!e.role || e.role === 'fill') {
        const primary = champPrimaryRole(e.champion)
        if (primary && !filledSlots[primary]) {
          filledSlots[primary] = e.champion
        } else {
          for (const r of knownRoles) {
            if (!filledSlots[r]) { filledSlots[r] = e.champion; break }
          }
        }
      }
    }

    setEnemies(prev => prev.map(slot => {
      if (manualOverrides.has(`enemy.${slot.role}`)) return slot
      if (filledSlots[slot.role]) return { ...slot, champion: filledSlots[slot.role] }
      return slot
    }))
  }, [lcuSession, lcuConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getChampions().then(setChampions).catch(() => {})
    getPatches().then(patches => {
      setAvailablePatches(patches)
      if (patches.length > 0) setPatch(patches[0])
    }).catch(() => {})
  }, [])

  const handleRoleChange = (newRole) => {
    setRole(newRole)
    setAllies(makeAllies(ROLE_ALLY_SLOTS[newRole] || ROLE_ALLY_SLOTS['adc'], allies))
  }

  const handleAllyChange = (index, champion) => {
    const updated = [...allies]
    updated[index] = { ...updated[index], champion }
    setAllies(updated)
    setManualOverrides(prev => {
      const next = new Set(prev)
      const key = `ally.${allies[index].role}`
      if (champion.trim()) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const handleEnemyChange = (index, champion) => {
    const updated = [...enemies]
    updated[index] = { ...updated[index], champion }
    setEnemies(updated)
    setManualOverrides(prev => {
      const next = new Set(prev)
      const key = `enemy.${enemies[index].role}`
      if (champion.trim()) next.add(key)
      else next.delete(key)
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
      const result = await getRecommendations(
        role,
        allies.filter(a => a.champion.trim()),
        enemies.filter(e => e.champion.trim()),
        patch,
        tier
      )
      const newRecs = result.recommendations || []
      setRecommendations(newRecs)

      // Restore the open breakdown to the same champion if it's still in the new list
      if (prevIdx !== null && prevRecs[prevIdx]) {
        const prevChamp = prevRecs[prevIdx].champion
        const newIdx = newRecs.findIndex(r => r.champion === prevChamp)
        setSelectedRec(newIdx >= 0 ? newIdx : null)
      }
    } catch (err) {
      setError('Failed to get recommendations. Is the backend running?')
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [role, allies, enemies, patch, tier])

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
  }, [handleSubmit, hasValidChampion])

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
    <div className="app-container" data-fx="refined" data-detail={lowDetail ? 'low' : undefined}>
      <header className="header">
        <a
          href="https://github.com/Kuderic/RabadonGG"
          className="header-github-link"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
        <div className="header-logo">
          <img src="/rabadon.png" alt="" className="header-logo-img" />
          <h1>Rabadon.GG</h1>
        </div>
        <p>Real-time champion select analysis</p>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'draft' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('draft')}
        >Draft</button>
        <button
          className={`tab-btn ${activeTab === 'config' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('config')}
        >Configuration</button>
        <button
          className={`tab-btn ${activeTab === 'about' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('about')}
        >About</button>
        {!import.meta.env.VITE_DESKTOP && (
          <button
            className={`tab-btn ${activeTab === 'download' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('download')}
          >Download</button>
        )}
      </nav>

      <main>
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
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
              patch={patch}
              tier={tier}
              onShare={handleShare}
              shareCopied={shareCopied}
              lcuConnected={lcuConnected}
              lcuSession={lcuSession}
            />

            {(recommendations.length > 0 || loading) && (
              <div className="results-section">
                <Suspense fallback={null}>
                  <RecommendationList
                    recommendations={recommendations}
                    loading={loading}
                    refreshing={refreshing}
                    selectedIndex={selectedRec}
                    onSelect={setSelectedRec}
                    config={config}
                    playerRole={role}
                    onTogglePenalty={() => setConfig(c => ({ ...c, penalize: !c.penalize }))}
                  />
                </Suspense>
              </div>
            )}

          </>
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
    </div>
  )
}
