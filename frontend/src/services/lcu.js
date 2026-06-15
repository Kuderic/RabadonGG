/**
 * LCU (League Client) integration for the desktop build.
 *
 * useLCUSession() polls for live champion-select state every 2s and returns
 * { connected, session }.
 *
 * Three modes:
 *   1. Tauri context (window.__TAURI__ present): invoke the Rust command
 *      'get_lcu_session' directly — no HTTP involved.
 *   2. VITE_DESKTOP=true but no Tauri: poll the local sidecar HTTP endpoint
 *      /api/lcu/session (local dev with a running backend).
 *   3. Web build: no-op, always returns { connected: false, session: null }.
 */

import { useState, useEffect } from 'react'

const POLL_MS = 2000
const IS_TAURI = typeof window !== 'undefined' && window.__TAURI__ != null
const IS_DESKTOP = import.meta.env.VITE_DESKTOP === 'true'

/**
 * @typedef {Object} LCUSession
 * @property {string}        phase       - "PLANNING" | "BAN_PICK" | "FINALIZATION" | ...
 * @property {string|null}   my_role     - "top" | "jungle" | "mid" | "adc" | "support" | null
 * @property {boolean}       spectating  - true when watching someone else's champion select
 * @property {Array<{champion: string, role: string|null}>} allies  - in spectate, all 5 myTeam members
 * @property {Array<{champion: string}>}                    enemies
 */

/**
 * Poll for live champion-select state.
 *
 * @returns {{ connected: boolean, session: LCUSession|null }}
 */
export function useLCUSession() {
  const [connected, setConnected] = useState(false)
  const [session, setSession] = useState(null)

  useEffect(() => {
    // Web build: no-op
    if (!IS_TAURI && !IS_DESKTOP) return

    let active = true

    async function poll() {
      try {
        let data
        if (IS_TAURI) {
          data = await window.__TAURI__.core.invoke('get_lcu_session')
        } else {
          const resp = await fetch('/api/lcu/session')
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          data = await resp.json()
        }
        if (!active) return
        setConnected(data.connected)
        setSession(prev => {
          const next = data.session
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev
          return next
        })
      } catch {
        if (active) setConnected(false)
      }
    }

    poll()
    const id = setInterval(poll, POLL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  return { connected, session }
}
