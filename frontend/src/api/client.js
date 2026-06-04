const BASE_URL = 'http://localhost:8000'

export async function getChampions() {
  const res = await fetch(`${BASE_URL}/api/champions`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  return data.champions
}

export async function getRecommendations(role, allies, enemies, patch, tier) {
  const res = await fetch(`${BASE_URL}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, allies, enemies, patch, tier })
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function getPatches() {
  const res = await fetch(`${BASE_URL}/api/patches`)
  if (!res.ok) return ['16.11']
  const data = await res.json()
  return data.patches
}
