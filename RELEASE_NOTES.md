## What's new in 1.2.9

### Changes
- **Overlay closes when champion select ends** — the overlay now automatically hides itself when champion select ends, rather than staying open until manually dismissed.
- **Champion blacklist** — new Settings section lets you blacklist champions per role so they never appear in recommendations. Add champions by searching, remove with ✕. Works in both the main app and overlay.
- **Remove overlay hotkey** — the overlay hotkey field in Settings now has a ✕ button to clear the hotkey entirely.
- **Overlay stays closed mid-session** — closing the overlay with ✕ during champion select now keeps it hidden for the rest of that session; it re-opens automatically on the next champion select.

## What's new in 1.2.8

### Changes
- **Clear button** — new ✕ Clear button in the draft header clears all ally and enemy inputs and resets results in one click.
- **Lolalytics links include lane** — external links to lolalytics.com now include the correct lane parameter (e.g. `lane=bottom` for ADC), opening the right role page directly.
- **Overlay tier badge in header** — the population tier (Emerald+, Diamond+, etc.) now appears as a compact icon+label badge in the overlay header next to the patch, replacing the footer display.
- **Overlay no-flicker refresh** — existing picks stay visible while the overlay re-fetches on draft changes; the panel no longer collapses to a spinner on every update.
- **Overlay sort independence** — the overlay WR+Δ / Δ toggle persists separately from the main app and syncs the main app's sort when clicking through.
- **Sort buttons always correct** — fixed WR+Δ button never highlighting due to a stale internal value.
- **Your pick click-through** — clicking the "Your pick" row in the overlay opens the lookup only when your pick ranks outside the top 10.
- **Draft Overview sees your locked champion** — when you lock in your own champion during champion select, the Draft Overview now includes your slot with your pick instead of leaving it open.
- **Overlay rank recalculates on sort change** — your pick's rank in the overlay updates correctly when switching between WR+Δ and Δ sort.
- **"Show recommendations" rename** — "Open slot picks" label renamed to "Show recommendations" in Draft Overview and Settings for clarity.

## What's new in 1.2.7

### Changes
- **Sort buttons always highlighted correctly** — WR + Δ and Δ buttons in the recommender now reflect the active sort on first load and after overlay-triggered navigation; fixed a stale `'rating'` value that prevented the highlight from appearing.
- **Overlay sort is independent** — the overlay has its own WR + Δ / Δ toggle that persists separately from the main app. Clicking through from the overlay now syncs the main app to the overlay's current sort mode.
- **Overlay no longer redraws on every pick** — while re-fetching after a draft change the existing picks stay visible instead of collapsing to a loading spinner, eliminating the shrink-and-expand flicker on each champ-select update.
- **Pool "Add to…" inputs no longer overflow** — the search inputs in the My Pool lane columns now shrink to fit their column width at any panel size.

## What's new in 1.2.6

### Fixes
- **Backend lint** — fixed undefined `DraftSlot` import in `draft_overview.py` and removed unused variable in scraper tests.
- **Desktop compile** — fixed `shortcut.mods`/`shortcut.key` field access (not method calls) and removed unused `Emitter` import in Rust.

## What's new in 1.2.5

### Changes
- **Overlay precision** — removed excess padding on the right and bottom edges; overlay window now hugs the panel precisely.
- **Ctrl+Up Arrow** — new global shortcut to show and focus the main Rabadon.GG window from anywhere (including while the overlay is open).
- **Overlay click-through** — clicking a top-10 champion in the overlay now opens their full breakdown card in the main app and scrolls to the bottom. Champions outside the top 10 open the lookup instead.
- **Fresh slate on new champion select** — when a new champion select session starts, all stale recommendations, selected cards, and lookup state are cleared automatically in both the main app and the overlay.
- **Enemy role auto-fill rewrite** — primary and secondary roles for all champions rebuilt from pick-rate data. Jax, Talon, and Trundle corrected to their true primary lanes; Karma and Lux moved to support primary; secondary flex routes added for 20+ champions (Zac, Ivern, Ziggs, Yone, Aurora, Maokai, etc.).
- **Sort button order** — WR + Δ now appears before Δ only everywhere, matching the default.
- **My Champions overflow fix** — support lane column no longer overflows the right edge when all 5 roles have champions.

## What's new in 1.2.4

### Changes
- **WR + Δ is now the default sort** — recommender, overlay, and Draft Overview all default to WR + Δ instead of Δ only.
- **Sample size penalty threshold raised to 2000** — matchups need at least 2000 games for full weight (up from 1000), producing more conservative scoring on lower-volume data.

## What's new in 1.2.3

### Changes
- **Draft Overview sort moved to Settings** — the Δ only / WR + Δ sort toggle for open slot picks now lives in Settings → Draft Overview, where it persists across sessions. Previously reset on every page load.
- **Inline open slot toggle** — the Draft tab now has a compact "Open slot picks" checkbox directly on the board so you can enable/disable scoring without leaving the tab. An info tag signals the 5–20s cost on a cold cache.

## What's new in 1.2.2

### Changes
- **Rate-limited lolalytics client** — all backend data fetches now route through a centralized client capped at 10 concurrent connections and 30 requests per second, with a 30-second graceful timeout. Prevents server IP blacklisting under load.
- **Faster recommendations** — route-level semaphore tuned from 5 → 15 concurrent scoring coroutines, reducing warm-cache latency by ~3×.

## What's new in 1.2.1

### Changes
- **Draft Overview — lazy by default** — the Draft tab now loads instantly; open slot recommendations are opt-in. Enable "Compute open slot recommendations" in Settings → Draft Overview to score the full champion pool for every open slot.
- **WR + Δ sort option** — the Draft Overview header now has a toggle to sort open-slot picks by delta only or win rate + delta.
- **Renamed tabs** — "Draft" → "Recommend", "Overview" → "Draft" for clearer labelling.
- **Accurate top-3 picks** — open slots now score the full role pool (same as the Recommend tab) and sort by rating; previously showed champions in arbitrary order.

## What's new in 1.2.0

### New
- **Draft Overview tab** — a champion-select style board showing both team compositions side by side. Locked champions display their synergy/counter contribution and a delta bar. Every open slot shows the top 3 recommended picks inline. A scoreline at the top tracks summed allied vs enemy deltas and a center-diverging advantage bar.
- **Breakdown modal in Overview** — click any locked champion or any recommended pick card to open the full breakdown panel without leaving the Overview tab.

## What's new in 1.1.17

### Changes
- **Overlay mirrors main app sort** — the overlay now tracks whichever sort mode (Δ only or WR + Δ) is active in the main window. Switching modes in Settings instantly re-orders the overlay picks without a re-fetch.

## What's new in 1.1.16

### Changes
- **Overlay now sorts by Δ only** — top picks list, My Pool tab, and "Your pick" rank all use draft-specific delta as the sort key, matching the main app's default. Previously the overlay used WR + Δ (backend order).

## What's new in 1.1.15

### Bug fixes
- **Overlay transparent setting now works** — toggling "Transparent background" in Settings now clearly changes the overlay between a frosted semi-transparent panel (default, 65% opacity + blur) and a near-solid opaque panel (96% opacity, no blur). Fixed by switching from a fragile CSS variable inside `rgba()` to a reliable class toggle.

### Changes
- **Titlebar version chip label** — now reads "v1.1.15 · Patch notes" so users know it's clickable.
- Removed the duplicate "What's New" button from the header (the titlebar chip is the canonical entry point).

## What's new in 1.1.14

### New
- **No pool size limit** — your champion pool can now hold as many champions as you want (was capped at 20 in the backend).

### Bug fixes
- **Desktop titlebar version chip clickable** — the "v1.1.14" chip is back in the titlebar and now properly receives clicks (fixed pointer-events on the drag region).
- **What's New respects Ctrl+/− zoom** — the changelog modal now lives inside the zoom wrapper so it scales correctly with the rest of the app.

### Changes
- **Recommended Picks default sort is now Δ only** — the draft-specific delta is the most useful first signal; WR + Δ is still a click away.
- "Δ only" sort button moved to first position.

## What's new in 1.1.13

### New
- **My Champions: rank numbers** — the "My Champions" tab now shows each champion's rank position (1, 2, 3…) instead of a star badge on the left, matching the Overall tab layout.
- **Click gold star to remove from pool** — in the Overall tab, clicking the glowing gold star next to a champion you've pooled now removes them from your pool. The star dims on hover to signal the action.
- **What's New button in header** — patch notes are now accessible from a "What's New" button in the top-right of the header. Works on both the web and desktop app.

### Changes
- Removed the version chip from the desktop titlebar (it was unclickable due to the drag region swallowing pointer events). The What's New button in the header replaces it and works reliably.

## What's new in 1.1.12

### New
- **Recommendation count badge** — a pill badge next to the "Recommended Picks" heading now shows the total number of champions scored for the current draft (e.g. "30"), so you always know the full field size.
- **Lookup rank line** — when you look up a champion by name, a "Ranked **#N** of M for this draft" line now appears above the breakdown panel. Works for both pool champions and off-meta picks (the off-meta pick is counted as +1 to the field).
- **Overlay: "Your pick" is now clickable** — clicking the pinned Your Pick row in the overlay opens the main window and pre-fills the champion lookup, so you can jump straight to the full breakdown.

### Bug fixes
- **Overlay: "#31 of 30" rank overflow fixed** — the intent champion is in `pool_picks`, not `recommendations`, so the field is now correctly set to `allRecs.length + 1` instead of `allRecs.length`.
- **Lookup rank field size corrected** — when a looked-up champion is not in the regular recommendations pool, the field is now `recommendations.length + 1` (not capped at `recommendations.length`), preventing "#31 of 30"-style display bugs.
- **Removed 30-champion cap** — the backend now returns all scored champions instead of capping at 30, ensuring the overlay rank and recommendation count reflect the full pool.

## What's new in 1.1.11

### New
- **Overlay: "Your pick" pinned row** — the champion you're hovering in champ select now appears pinned below the picks list with its S / C / Δ scores and a rank chip (`#8 of 41`). Recomputes when your intent changes.
- **Per-tab sort defaults** — Overall tab stays sorted by WR + Δ; My Champions tab now defaults to Δ only, which better surfaces draft-specific swing when your baseline viability is already a given.

### Bug fixes
- **Settings → Display layout** — fixed two bugs in the Overlay sub-panel: the `--text-muted` CSS token was undefined (heading and changelog link fell back to the brightest ink); Hotkey and Size rows were stretched edge-to-edge with `justify-content: space-between` — controls now sit tightly beside their labels.

### Changes
- **Overlay: S / C metrics** — synergy and counter contributions are now larger (11.5px, stacked column) and positioned to the left of the Δ value instead of below it. The column header hint updates to `S · C · Δ`.
- **Overlay window sizing** — the overlay window now tracks the panel's actual rendered height via `ResizeObserver` instead of a fixed 510 px constant. Eliminates up to ~300 px of empty transparent space below the panel in the "Waiting" and small-pool states.

## What's new in 1.1.10

### Bug fixes
- Fixed zoom scroll bug (for real this time): CSS zoom is now applied to a wrapper div inside `.app-container` instead of the document root — `scrollIntoView` can only scroll `.app-container` and can no longer push the titlebar off-screen
- Fixed the What's New panel not opening when clicking the version number in the titlebar — `overflow: clip` on `body` and `#root` was clipping `position: fixed` modals; reverted those two elements back to `overflow: hidden`

## What's new in 1.1.9

### Bug fixes
- Fixed the zoom scroll bug (Ctrl +/−): `overflow: clip` is now applied to `body` and `#root` in addition to the root `html` element — `overflow: hidden` still allowed `scrollIntoView` to scroll those ancestors and push the titlebar off-screen

### New
- **GitHub releases link**: the What's New panel (click the version number in the titlebar) now has a "View all releases on GitHub ↗" link at the bottom

### Changes
- Display → Overlay settings are now grouped in a labelled sub-panel for cleaner layout; hotkey, transparency, and size controls have consistent alignment

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
