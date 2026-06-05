// DDragon key exceptions: display name → DDragon filename key
const DDRAGON_KEY_EXCEPTIONS = {
  'Wukong': 'MonkeyKing',
  'Nunu & Willump': 'Nunu',
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
  Aatrox:'top',Camille:'top',Cho_Gath:'top',Darius:'top',DrMundo:'top',Fiora:'top',
  Gangplank:'top',Garen:'top',Gnar:'top',Gwen:'top',Illaoi:'top',Irelia:'top',
  Jayce:'top',Kennen:'top',Malphite:'top',Maokai:'top',Mordekaiser:'top',Nasus:'top',
  Ornn:'top',Pantheon:'top',Poppy:'top',Renekton:'top',Riven:'top',Rumble:'top',
  Sett:'top',Singed:'top',Sion:'top',Teemo:'top',Tryndamere:'top',Urgot:'top',
  Vladimir:'top',Volibear:'top',Warwick:'top',Yorick:'top',KSante:'top',
  Amumu:'jungle',BelVeth:'jungle',Briar:'jungle',Diana:'jungle',Ekko:'jungle',
  Elise:'jungle',Evelynn:'jungle',Fiddlesticks:'jungle',Graves:'jungle',Hecarim:'jungle',
  Ivern:'jungle',JarvanIV:'jungle',Jax:'jungle',Kayn:'jungle',Karthus:'jungle',
  KhaZix:'jungle',Kindred:'jungle',LeeSin:'jungle',Lillia:'jungle',MasterYi:'jungle',
  Nidalee:'jungle',Nocturne:'jungle',Nunu:'jungle',Rammus:'jungle',Rengar:'jungle',
  Sejuani:'jungle',Shaco:'jungle',Shyvana:'jungle',Skarner:'jungle',Talon:'jungle',
  Trundle:'jungle',Udyr:'jungle',Vi:'jungle',Viego:'jungle',Wukong:'jungle',Xin_Zhao:'jungle',
  Zac:'jungle',
  Ahri:'mid',Akali:'mid',AurelionSol:'mid',Azir:'mid',Cassiopeia:'mid',Corki:'mid',
  Fizz:'mid',Galio:'mid',Karma:'mid',Kassadin:'mid',LeBlanc:'mid',Lissandra:'mid',
  Lux:'mid',Malzahar:'mid',Naafiri:'mid',Orianna:'mid',Qiyana:'mid',Ryze:'mid',
  Syndra:'mid',Taliyah:'mid',TwistedFate:'mid',Veigar:'mid',Vex:'mid',Viktor:'mid',
  Xerath:'mid',Yone:'mid',Yasuo:'mid',Zed:'mid',Zoe:'mid',Annie:'mid',Neeko:'mid',
  Smolder:'mid',Hwei:'mid',
  Aphelios:'adc',Ashe:'adc',Caitlyn:'adc',Draven:'adc',Ezreal:'adc',Jhin:'adc',
  Jinx:'adc',KaiSa:'adc',Kalista:'adc',KogMaw:'adc',Lucian:'adc',MissFortune:'adc',
  Nilah:'adc',Samira:'adc',Sivir:'adc',Tristana:'adc',Twitch:'adc',Varus:'adc',
  Vayne:'adc',Xayah:'adc',Zeri:'adc',
  Alistar:'support',Bard:'support',Blitzcrank:'support',Brand:'support',Braum:'support',
  Janna:'support',Leona:'support',Lulu:'support',Milio:'support',Morgana:'support',
  Nami:'support',Nautilus:'support',Pyke:'support',Rakan:'support',Renata:'support',
  Senna:'support',Seraphine:'support',Sona:'support',Soraka:'support',Thresh:'support',
  Vel_Koz:'support',Yuumi:'support',Zilean:'support',Zyra:'support',
  Heimerdinger:'support',Swain:'support',
}

export function champPrimaryRole(name) {
  const key = name.replace(/[ '&]/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  return CHAMPION_PRIMARY_ROLE[key] || CHAMPION_PRIMARY_ROLE[name.replace(/[ ']/g, '')] || null
}
