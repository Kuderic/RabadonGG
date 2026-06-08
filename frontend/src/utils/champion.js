// DDragon key exceptions: display name → DDragon filename key
const DDRAGON_KEY_EXCEPTIONS = {
  'Wukong': 'MonkeyKing',
  'Nunu & Willump': 'Nunu',
  "Bel'Veth": 'Belveth',
  "Cho'Gath": 'Chogath',
  'Dr. Mundo': 'DrMundo',
  "Kai'Sa": 'Kaisa',
  "Kha'Zix": 'Khazix',
  'LeBlanc': 'Leblanc',
  'Renata Glasc': 'Renata',
  "Vel'Koz": 'Velkoz',
}

export function champDDragonKey(name) {
  if (DDRAGON_KEY_EXCEPTIONS[name]) return DDRAGON_KEY_EXCEPTIONS[name]
  // Remove spaces and apostrophes: "Miss Fortune" → "MissFortune", "Kog'Maw" → "KogMaw"
  return name.replace(/[ ']/g, '')
}

// Lolalytics URL slug: lowercase, alphanumeric only
export function champSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const _apiBase = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')

export function champIconUrl(name) {
  const key = champDDragonKey(name)
  return `${_apiBase}/api/icon/${key}`
}

const CHAMPION_PRIMARY_ROLE = {
  Aatrox:'top',Ambessa:'top',Camille:'top',Cho_Gath:'top',Darius:'top',DrMundo:'top',
  Fiora:'top',Gangplank:'top',Garen:'top',Gnar:'top',Gwen:'top',Illaoi:'top',
  Irelia:'top',Jayce:'top',Kayle:'top',Kennen:'top',Kled:'top',Malphite:'top',
  Maokai:'top',Mordekaiser:'top',Nasus:'top',Ornn:'top',Pantheon:'top',Poppy:'top',
  Quinn:'top',Renekton:'top',Riven:'top',Rumble:'top',Sett:'top',Shen:'top',
  Singed:'top',Sion:'top',Teemo:'top',Tryndamere:'top',Urgot:'top',
  Vladimir:'top',Volibear:'top',Warwick:'top',Yorick:'top',KSante:'top',
  Amumu:'jungle',BelVeth:'jungle',Briar:'jungle',Diana:'jungle',Ekko:'jungle',
  Elise:'jungle',Evelynn:'jungle',Fiddlesticks:'jungle',Gragas:'jungle',Graves:'jungle',
  Hecarim:'jungle',Ivern:'jungle',JarvanIV:'jungle',Jax:'jungle',Kayn:'jungle',
  Karthus:'jungle',KhaZix:'jungle',Kindred:'jungle',LeeSin:'jungle',Lillia:'jungle',
  MasterYi:'jungle',Nidalee:'jungle',Nocturne:'jungle',Nunu:'jungle',Olaf:'jungle',
  Rammus:'jungle',RekSai:'jungle',Rengar:'jungle',Sejuani:'jungle',Shaco:'jungle',
  Shyvana:'jungle',Skarner:'jungle',Talon:'jungle',Trundle:'jungle',Udyr:'jungle',
  Vi:'jungle',Viego:'jungle',Wukong:'jungle',Xin_Zhao:'jungle',Zac:'jungle',
  Ahri:'mid',Akali:'mid',Akshan:'mid',Anivia:'mid',AurelionSol:'mid',Aurora:'mid',
  Azir:'mid',Cassiopeia:'mid',Corki:'mid',Fizz:'mid',Galio:'mid',Karma:'mid',
  Kassadin:'mid',Katarina:'mid',LeBlanc:'mid',Lissandra:'mid',Lux:'mid',
  Malzahar:'mid',Mel:'mid',Naafiri:'mid',Orianna:'mid',Qiyana:'mid',Ryze:'mid',
  Sylas:'mid',Syndra:'mid',Taliyah:'mid',TwistedFate:'mid',Veigar:'mid',Vex:'mid',
  Viktor:'mid',Xerath:'mid',Yone:'mid',Yasuo:'mid',Zed:'mid',Ziggs:'mid',Zoe:'mid',
  Annie:'mid',Neeko:'mid',Hwei:'mid',
  Aphelios:'adc',Ashe:'adc',Caitlyn:'adc',Draven:'adc',Ezreal:'adc',Jhin:'adc',
  Jinx:'adc',KaiSa:'adc',Kalista:'adc',KogMaw:'adc',Lucian:'adc',MissFortune:'adc',
  Nilah:'adc',Samira:'adc',Sivir:'adc',Smolder:'adc',Tristana:'adc',Twitch:'adc',
  Varus:'adc',Vayne:'adc',Xayah:'adc',Zeri:'adc',
  Alistar:'support',Bard:'support',Blitzcrank:'support',Brand:'support',Braum:'support',
  Janna:'support',Leona:'support',Lulu:'support',Milio:'support',Morgana:'support',
  Nami:'support',Nautilus:'support',Pyke:'support',Rakan:'support',Renata:'support',
  Senna:'support',Seraphine:'support',Sona:'support',Soraka:'support',TahmKench:'support',
  Taric:'support',Thresh:'support',Vel_Koz:'support',Yuumi:'support',Zilean:'support',
  Zyra:'support',Heimerdinger:'support',Swain:'support',
}

export function champPrimaryRole(name) {
  // "Bel'Veth" → "Bel_Veth", "Vel'Koz" → "Vel_Koz"
  const key1 = name.replace(/[ '&]/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  if (CHAMPION_PRIMARY_ROLE[key1]) return CHAMPION_PRIMARY_ROLE[key1]
  // "Miss Fortune" → "MissFortune", "Dr. Mundo" → "DrMundo"
  const key2 = name.replace(/[^a-zA-Z0-9]/g, '')
  if (CHAMPION_PRIMARY_ROLE[key2]) return CHAMPION_PRIMARY_ROLE[key2]
  // "Renata Glasc" → "Renata", "Nunu & Willump" → "Nunu"
  const key3 = name.split(/\s/)[0]
  return CHAMPION_PRIMARY_ROLE[key3] || null
}

// Most-played secondary (flex) roles for champions that commonly appear off-role.
// Used to resolve slot conflicts when two enemies share the same primary role.
const CHAMPION_SECONDARY_ROLE = {
  // Top flexes
  Camille:'jungle', Jayce:'mid', Vladimir:'mid', Gragas:'mid',
  Kennen:'jungle', Poppy:'jungle', Pantheon:'support', Malphite:'support',
  Garen:'support', Sion:'jungle', Cho_Gath:'mid', Volibear:'jungle',
  Warwick:'support', Mordekaiser:'jungle', Urgot:'jungle',

  // Jungle flexes
  Diana:'mid', Ekko:'mid', Graves:'mid', Karthus:'mid',
  Wukong:'top', Fiddlesticks:'support', Nocturne:'mid',
  Shyvana:'top', Trundle:'top', Olaf:'top', Udyr:'top',

  // Mid flexes
  Akali:'top', Irelia:'top', Sylas:'jungle', Zed:'jungle',
  LeBlanc:'support', TwistedFate:'support', Katarina:'jungle',
  Annie:'support', Lissandra:'support', Galio:'support',
  Neeko:'support', Hwei:'support', Taliyah:'jungle',

  // ADC flexes
  Lucian:'mid', Vayne:'top', Twitch:'jungle', Tristana:'mid',
  Senna:'support', Sivir:'mid', Varus:'mid',

  // Support flexes
  Brand:'mid', Karma:'mid', Lux:'mid', Zyra:'mid',
  Swain:'mid', Seraphine:'mid', Morgana:'mid',
  Heimerdinger:'top', Vel_Koz:'mid', Thresh:'jungle',
  Pyke:'mid', Milio:'mid',
}

function _roleKey(name) {
  const key1 = name.replace(/[ '&]/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  if (CHAMPION_SECONDARY_ROLE[key1] !== undefined) return CHAMPION_SECONDARY_ROLE[key1]
  const key2 = name.replace(/[^a-zA-Z0-9]/g, '')
  if (CHAMPION_SECONDARY_ROLE[key2] !== undefined) return CHAMPION_SECONDARY_ROLE[key2]
  const key3 = name.split(/\s/)[0]
  return CHAMPION_SECONDARY_ROLE[key3] ?? null
}

export function champSecondaryRole(name) {
  return _roleKey(name)
}

// Match champions by normalized name (handles "miss" → "Miss Fortune", "kogm" → "Kog'Maw")
export function filterChampions(champions, query) {
  if (!query || query.length < 1) return []
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const q = norm(query)
  const ql = query.toLowerCase()

  const results = champions.filter(c => {
    const cn = norm(c)
    const cl = c.toLowerCase()
    return cn.startsWith(q) || cl.startsWith(ql) || cn.includes(q)
  })

  results.sort((a, b) => {
    const an = norm(a), bn = norm(b)
    const ap = an.startsWith(q) ? 0 : 1
    const bp = bn.startsWith(q) ? 0 : 1
    if (ap !== bp) return ap - bp
    return a.localeCompare(b)
  })

  return results.slice(0, 8)
}
