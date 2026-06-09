# Features

Current shipped features, roughly in order of user-facing importance.

---

## Core: Champion Recommendations

- Input: user's role + partial draft (up to 4 allies, 5 enemies with roles)
- Output: top 10 ranked champion picks for the user's role, scored against that exact draft
- Score = `Base WR + Counter Δ + Synergy Δ` — all real match data, no tier-list opinion
- Each delta is sample-size-penalized: `delta × min(sqrt(n / 1000), 1.0)` so 50-game matchups don't outrank 10,000-game ones
- Full per-champion matchup breakdown: every ally and enemy contribution shown individually with sample count

---

## Draft Input

- Champion autocomplete for all ally and enemy slots
- Role selector for the user's role (Top / Jungle / Mid / Bot / Support)
- Role selection persists across sessions via localStorage
- Enemy role assignment: auto-detected from LCU in the desktop app; manually assignable on web
- Manual enemy slot overrides are preserved even as LCU auto-fill updates other slots

---

## Configuration

- **Patch & tier**: select which patch and rank band (Emerald+, Diamond+, etc.) to pull data from
- **Sample size penalty**: toggle on/off; configurable threshold (default 1000 games)
- **Role weights**: per-role multipliers for how much each enemy/ally lane contributes to the score (e.g. weight Bot vs Bot counter higher than Bot vs Top)
- **Score multipliers**: separate blend multipliers for counter and synergy contributions
- Configuration is applied live on the frontend without re-fetching — scores update instantly

---

## Champion Pool

- Add up to 20 champions to your personal pool, with per-champion role assignments
- Pool champions are always scored alongside the general recommendation pool
- Per-champion win-rate modifiers: add a manual +/- adjustment to any champion's base win rate
- Pool variant display: grouped by role or flat list

---

## Desktop App (Windows)

Built with Tauri 2 (Rust shell, WebView frontend).

- **LCU integration**: reads the League client lockfile to detect champion select; auto-fills ally and enemy champions, and the user's assigned role
- **Overlay window**: compact always-on-top panel (320×460px, transparent background) showing top 5 picks with win rate, adjusted delta, and S/C split
  - Appears automatically when champion select starts
  - Uses the main window as the source of truth for draft state (shared via localStorage) — enemy role corrections made in the main app appear in the overlay immediately
  - Draggable; position saved across sessions
  - Global hotkey to show/hide (default: Ctrl+↓, configurable under Settings → Display)
- **Auto-update**: checks for updates every 30 minutes; shows a banner with "Update now" when available; passive install (no UAC prompt during session)
- **Version display**: current version shown as muted text in the titlebar; clicking it opens a "What's new" changelog panel with the full release history
- **System tray**: app minimizes to tray; left-click or "Open Rabadon.GG" menu item restores the window
- **Custom titlebar**: frameless window with drag region, minimize/maximize/close controls, and zoom (Ctrl+/−/0)

---

## Web App

- Full feature parity with the desktop app except LCU auto-fill and overlay
- Shareable URLs: draft state (role, ally/enemy champions, patch, tier) encoded as query params
- Champion icons served via `/api/icon/{name}` proxy (resized 80×80 WebP, 7-day cache)
- Google Analytics 4 integration (see `docs/analytics.md`)

---

## Not implemented

- Build and rune recommendations (planned; no timeline)
- User accounts or server-side saved sessions
- LLM-based analysis or commentary
