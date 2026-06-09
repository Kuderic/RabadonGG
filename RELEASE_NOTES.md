## What's new in 1.0.17

### More champion recommendations
- Fixed a bug where only champions whose *primary* role matched the requested lane were included in the pool — off-meta picks (e.g. Seraphine, Swain, Heimerdinger bot) were silently excluded
- All roles now return the full set of champions lolalytics tracks for that lane (~2× more candidates for some roles)

### Show more persistence
- Expanding the recommendation list to 20 or 30 picks now persists when the draft is updated — previously clicking "Show more" would reset back to 10 on every re-fetch

## What's new in 1.0.16

### More recommendations
- The backend now ranks up to **30 champions** instead of 10
- Results are shown 10 at a time — click **Show more** at the bottom to load picks 11–20, then 21–30

### Improved sample size penalty
- The penalty weighting is now a **square root curve** instead of linear — better reflects how statistical confidence actually scales with sample size (√n)
- A matchup at half the threshold (e.g. 500 games at the default 1000) now carries ~71% weight instead of 50%
- The Configuration panel explains the formula and reasoning inline

### Configuration panel improvements
- Role Weighting section now includes a recommendation to leave weights at 1.0, with a note on when to reduce other-role weights
- "Bot" replaces "ADC" in all role labels across the UI for consistency with in-game terminology

## What's new in 1.0.15

### Version display and changelog
- The titlebar now shows the current version (`v1.0.15`) in muted text — click it to open the **What's new** panel
- The **What's new** panel shows the full release history (bundled at build time from `RELEASE_NOTES.md`) with a minimal hextech-styled renderer
- Escape or clicking the backdrop closes the panel

### Update checking
- The app now re-checks for updates every **30 minutes** in the background, not just once on launch — the update banner will appear as soon as a new version is available

## What's new in 1.0.14

### Download page
- Added an **in-game overlay showcase** section to the Download page — a two-column band with marketing copy and a live static render of the overlay floating on a faux champion-select backdrop

### Overlay improvements (desktop only)
- The overlay now uses the **main app as the source of truth** for the draft — enemy role assignments and manual corrections made in the main window are reflected in the overlay immediately via a shared localStorage channel, instead of the overlay re-deriving them independently from the LCU

### Testing
- Added unit tests for overlay pure functions: `hasLowSample` (9 cases including the `n=0` no-data guard and n=1000 boundary), `readDraft` localStorage parsing (4 cases), `fmt` formatter (7 cases), and `MatchupStrip` byRole construction logic (10 cases)
- Added `happy-dom` as a dev dependency to support localStorage in the Vitest environment

## What's new in 1.0.13

### Overlay redesign (desktop only)
- The overlay now shows a **matchup strip** — your role scored against the actual enemy draft, with ally synergy context
- Delta (Δ) is the headline figure; synergy and counter contributions are shown as an **S / C split** below it
- Low-sample matchups are flagged with a warning icon directly in the overlay
- Rank diamonds for positions 4–5 are dimmed gold so top 3 picks stand out at a glance
- Live patch indicator added to the overlay header
- Tier label and status dot added to the overlay footer

### Results improvements
- Column sort headers now work correctly across all sort modes
- Display polish in the recommendation list

### Infrastructure
- Release workflow now extracts only the current version's section from `RELEASE_NOTES.md` as the GitHub Release body

## What's new in 1.0.12

### Overlay improvements
- Fixed overlay staying in "Waiting for draft" state — it now polls the League client and scores champions independently without relying on the main window
- Fixed the close (✕) button not being clickable
- Added a global hotkey to show/hide the overlay from anywhere (default: **Ctrl+ArrowDown**)
- Hotkey is configurable under Settings → Display — click the box and press any key combination

## What's new in 1.0.11

### Champion-select overlay (desktop only)
- A compact floating overlay now appears automatically when you enter champion select, showing your top 5 recommended picks with win rate and adjusted delta — no alt-tab needed
- The overlay is always-on-top and transparent; clicking through the background still registers in the League client
- Drag the overlay to reposition it; position is saved across sessions
- Toggle the overlay on/off under Settings → Display → "Show overlay during champion select"

### Bug fixes
- Fixed counter matchup sample counts being inflated for off-role champions (e.g. Twisted Fate support showing 600+ games vs Nilah when only ~42 exist) — the scorer now uses only the role-specific matchup entry instead of falling back to the highest-n cross-role entry
- Fixed custom WR modifier being double-counted in the sorting score and breakdown panel total

## What's new in 1.0.10

### Redesigned navigation and layout
- Added a header nav bar with **About** and **Settings** tabs, replacing the old tab system
- **My Champions** pool now shows champions grouped by role first, making it easier to scan your pool at a glance
- Recommendation list headers are now sortable — click any column to re-rank by score, synergy, or counter contribution
- Added a drag handle for repositioning panels

### Bug fixes
- Fixed the external link icon next to each recommended champion — clicking it now correctly opens the champion's Lolalytics page in your browser
- Fixed the GitHub link in the header not opening on the desktop app
- Fixed a pool star display issue
