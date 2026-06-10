/* ============================================================================
   Rabadon.GG core-flow prototype — data layer (plain JS, exposes window.RBG)
   Mocks the backend: champion list + icons from DDragon, deterministic
   recommendation generation with synergy/counter breakdowns, plus pool scoring.
   ========================================================================== */
(function () {
  const FALLBACK_VER = '15.11.1';
  let DDRAGON_VER = FALLBACK_VER;

  const KEY_EXCEPTIONS = { 'Wukong': 'MonkeyKing', 'Nunu & Willump': 'Nunu', 'Renata Glasc': 'Renata' };
  const NAME_TO_ID = {};
  function champKey(name) {
    if (NAME_TO_ID[name]) return NAME_TO_ID[name];
    if (KEY_EXCEPTIONS[name]) return KEY_EXCEPTIONS[name];
    return name.replace(/[ '.]/g, '');
  }
  function champSlug(name) { return name.toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function iconUrl(name) {
    return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/img/champion/${champKey(name)}.png`;
  }
  function splashUrl(name) {
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champKey(name)}_0.jpg`;
  }

  const ROLE_ICON = {
    top:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png',
    jungle:  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png',
    mid:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png',
    adc:     'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png',
    support: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png',
  };

  const ROLE_POOLS = {
    top:     ['Aatrox','Darius','Garen','Camille','Fiora','Sett','Ornn','Renekton','Jax','Gnar','Mordekaiser','Malphite','Shen','Gwen','Kennen','Riven'],
    jungle:  ['Lee Sin','Vi','Viego','Hecarim','Kha\'Zix','Graves','Elise','Nidalee','Warwick','Kindred','Jarvan IV','Xin Zhao','Diana','Ekko','Nocturne','Rengar'],
    mid:     ['Ahri','Zed','Yasuo','Syndra','Orianna','Sylas','Akali','LeBlanc','Viktor','Vex','Katarina','Lux','Annie','Galio','Kassadin','Yone'],
    adc:     ['Jinx','Caitlyn','Kai\'Sa','Ezreal','Jhin','Lucian','Aphelios','Xayah','Miss Fortune','Samira','Ashe','Vayne','Zeri','Sivir','Tristana','Draven'],
    support: ['Thresh','Lulu','Nautilus','Leona','Pyke','Senna','Milio','Rakan','Karma','Janna','Blitzcrank','Yuumi','Renata Glasc','Soraka','Bard','Rell'],
  };
  // For variant demos: which role(s) a champ can flex into
  const CHAMP_ROLES = {};
  Object.entries(ROLE_POOLS).forEach(([r, arr]) => arr.forEach(c => {
    (CHAMP_ROLES[c] = CHAMP_ROLES[c] || []).push(r);
  }));

  const ROLES = ['top','jungle','mid','adc','support'];
  const ROLE_DISPLAY = { top:'Top', jungle:'Jungle', mid:'Mid', adc:'ADC', support:'Support' };
  const ROLE_LABEL_SHORT = { top:'TOP', jungle:'JG', mid:'MID', adc:'ADC', support:'SUP' };

  const TIER_OPTIONS = [
    { value: 'diamond_plus',  label: 'Diamond+',  icon: 'https://opgg-static.akamaized.net/images/medals_new/diamond.png' },
    { value: 'emerald_plus',  label: 'Emerald+',  icon: 'https://opgg-static.akamaized.net/images/medals_new/emerald.png' },
    { value: 'platinum_plus', label: 'Platinum+', icon: 'https://opgg-static.akamaized.net/images/medals_new/platinum.png' },
    { value: 'gold',          label: 'Gold+',     icon: 'https://opgg-static.akamaized.net/images/medals_new/gold.png' },
    { value: 'all',           label: 'All Ranks', icon: null },
  ];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }
  function rand(seed, lo, hi) { return lo + hash(seed) * (hi - lo); }

  async function loadChampions() {
    try {
      const vres = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const vers = await vres.json();
      if (Array.isArray(vers) && vers.length) DDRAGON_VER = vers[0];
    } catch (e) { /* keep fallback */ }
    try {
      const cres = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VER}/data/en_US/champion.json`);
      const cdata = await cres.json();
      Object.values(cdata.data).forEach(c => { NAME_TO_ID[c.name] = c.id; });
      return Object.values(cdata.data).map(c => c.name).sort((a, b) => a.localeCompare(b));
    } catch (e) {
      const all = new Set();
      Object.values(ROLE_POOLS).forEach(arr => arr.forEach(n => all.add(n)));
      return [...all].sort((a, b) => a.localeCompare(b));
    }
  }

  // Score one champion against the live draft (used for both Overall + pool picks)
  function scoreChamp(champ, role, allies, enemies, seedBase) {
    const s = `${champ}|${seedBase}`;
    const baseWR = rand(s + 'wr', 47.5, 53.5);
    const totalGames = Math.round(rand(s + 'g', 3, 240)) * 1000;

    const synergy_breakdown = allies
      .filter(a => a.champion && a.role !== role)
      .map(a => {
        const ss = `${champ}|syn|${a.champion}`;
        const n = Math.round(rand(ss + 'n', 0.2, 60) * (rand(ss + 'k', 0, 1) < 0.18 ? 0.04 : 1) * 1000);
        const d = +(rand(ss + 'd', -2.6, 3.2)).toFixed(1);
        return { champion: a.champion, role: a.role, delta: `${d >= 0 ? '+' : ''}${d}`, n: Math.max(40, n) };
      });

    const counter_breakdown = enemies
      .filter(e => e.champion)
      .map(e => {
        const cs = `${champ}|ctr|${e.champion}`;
        const n = Math.round(rand(cs + 'n', 0.2, 80) * (rand(cs + 'k', 0, 1) < 0.18 ? 0.04 : 1) * 1000);
        const d = +(rand(cs + 'd', -3.4, 3.6)).toFixed(1);
        return { champion: e.champion, role: e.role, delta: `${d >= 0 ? '+' : ''}${d}`, n: Math.max(40, n) };
      });

    const data_warnings = [];
    const lowCt = [...synergy_breakdown, ...counter_breakdown].filter(b => b.n < 1000).length;
    if (lowCt >= 2) data_warnings.push(`${lowCt} matchups have limited sample size on this patch — interpret deltas with caution.`);
    if (totalGames < 12000) data_warnings.push(`${champ} is low-playrate in ${role} this patch (${(totalGames / 1000).toFixed(0)}K games).`);

    return {
      champion: champ,
      win_rate: +baseWR.toFixed(1),
      total_games: totalGames,
      synergy_breakdown,
      counter_breakdown,
      synergy_missing: [],
      counter_missing: [],
      data_warnings,
    };
  }

  function getRecommendations(role, allies, enemies, patch, tier, poolChamps = []) {
    const pool = ROLE_POOLS[role] || ROLE_POOLS.adc;
    const seedBase = `${role}|${patch}|${tier}|${allies.map(a => a.champion).join(',')}|${enemies.map(e => e.champion).join(',')}`;
    const recommendations = pool.map(champ => scoreChamp(champ, role, allies, enemies, seedBase)).slice(0, 10);

    // Pool picks: score the user's pool champs (those eligible for this role) against the same draft
    const poolForRole = poolChamps.filter(Boolean);
    const pool_picks = poolForRole.map(champ => scoreChamp(champ, role, allies, enemies, seedBase));

    return { recommendations, pool_picks };
  }

  window.RBG = {
    get version() { return DDRAGON_VER; },
    champKey, champSlug, iconUrl, splashUrl,
    ROLE_ICON, ROLE_POOLS, CHAMP_ROLES, ROLES, ROLE_DISPLAY, ROLE_LABEL_SHORT, TIER_OPTIONS,
    loadChampions, getRecommendations,
  };
})();
