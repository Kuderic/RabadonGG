// In dev, hit the local backend. In a production build, default to same-origin
// (relative) requests so we never call the user's localhost. Override with
// VITE_API_BASE_URL at build time if the API lives on a different host.
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')

export async function getChampions() {
  const res = await fetch(`${BASE_URL}/api/champions`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  return data.champions
}

export async function getRecommendations(role, allies, enemies, patch, tier, pool = []) {
  const res = await fetch(`${BASE_URL}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, allies, enemies, patch, tier, pool })
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function getDraftOverview(ally, enemy, patch, tier, you = null, computeOpen = false) {
  const res = await fetch(`${BASE_URL}/api/draft-overview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ally, enemy, patch, tier, you, compute_open: computeOpen }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export async function getPatches() {
  const res = await fetch(`${BASE_URL}/api/patches`)
  if (!res.ok) return ['16.11']
  const data = await res.json()
  return data.patches
}
