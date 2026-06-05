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
