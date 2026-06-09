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
