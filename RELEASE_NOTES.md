## What's new in 1.1.8

### New
- **Overlay size setting**: a new slider in Settings → Display lets you scale the overlay from 70% to 150% — the overlay window resizes automatically to match
- **Transparent overlay**: the overlay panel is now semi-transparent by default so it blends into the League client; toggle it off in Settings → Display for a fully opaque background

### Bug fixes
- Overlay header now shows "30d" instead of "30" when the 30-day data window is selected
- Fixed a scroll bug when zoomed in (Ctrl +): clicking a recommendation could push the titlebar off-screen with no way to scroll back; the desktop root element now uses `overflow: clip` which prevents CSS zoom from making the document accidentally scrollable

### Changes
- Overlay is slightly larger by default (360 × 510 px, up from 320 × 460)

## What's new in 1.1.7

### New
- **Overlay → main app**: click any pick row in the overlay to open the full breakdown panel for that champion in the main window
- **Quick pool add**: each recommendation card now shows a faint star outline — click it to add that champion to your pool for the role you're currently viewing; the star fills gold once they're in your pool

### Changes
- Sample size penalty reverted to linear weighting (`n / threshold`) — the square-root curve was producing too much noise at the high end of the rankings

## What's new in 1.1.6

### Bug fixes
- Fixed manually typed enemy (and ally) champions persisting into the next champion select — all manual entries are now cleared when a new champion select session starts

## What's new in 1.1.5

### Bug fixes
- Champion name inputs now auto-correct capitalization when an exact match is typed — "jax" becomes "Jax", "kaisa" becomes "Kai'Sa", etc.
- Fixed Senna being assigned to a random lane slot when the support slot is already filled — she now correctly lands in the bot slot as her second-most-played role
- Recommended Picks role picker now snaps to your assigned role when champion select opens (desktop) instead of staying on the previously stored role

## What's new in 1.1.4

### Bug fixes
- Overlay no longer shows recommendations from your previous game when entering a new champion select with no champions picked yet

## What's new in 1.1.3

### Bug fixes & improvements
- Champion lookup now shows the full stats breakdown immediately — no click to expand
- Population settings (patch window and tier) are saved and restored when you reopen the app
- Desktop app defaults to 30-day data instead of the latest specific patch

## What's new in 1.1.2

### Bug fixes
- Fixed a missing ally slot on first load when your last role was saved as something other than Bot — the allied team would silently drop one row (e.g. loading as Support showed no Bot slot)
- Patch selector no longer shows patches that Riot has tagged in Data Dragon but haven't gone live on lolalytics yet (e.g. 16.12 appearing before it launched)

## What's new in 1.1.1

### Champion lookup
- New **Look up a champion** search bar in the recommendations panel — type any champion name to see their synergy and counter breakdown against your current draft, even if they don't appear in the top 30
- Useful for checking off-meta picks or champions not ranked in your role
- The lookup card appears above the main list with a distinct blue accent and magnifying glass badge
- Click the card to expand the full breakdown panel; clear with ✕

## What's new in 1.1.0

### My Pool tab in the overlay (desktop)
- The overlay now has a **My Pool** tab alongside Top Picks — switch between the overall best picks and picks from your personal champion pool without leaving the overlay
- The tab only appears when you have pool champions that match your current role

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
