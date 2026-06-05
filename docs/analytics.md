# Google Analytics 4 Integration Guide

Practical guide for integrating GA4 into rabadon.gg (React + Vite SPA).

---

## 1. Setup: react-ga4 vs. gtag.js

**Recommended: `react-ga4` npm package**

```bash
npm install react-ga4
```

- React-native API: `initialize()`, `event()`, `send()`
- Works naturally with Vite's module system
- Avoid the older `react-ga` package — it targets deprecated Universal Analytics

**Alternative:** raw `gtag.js` via script tag if you want zero dependencies. Acceptable, but more verbose in components.

---

## 2. SPA Page-View Tracking

React Router changes routes without page reloads, so GA4 won't auto-detect navigation without one of these:

### Option A: Enhanced Measurement (recommended, zero code)

In GA4 Admin → Data Streams → your stream → Enhanced Measurement, enable **"Page changes based on browser history events"**. GA4 listens to the History API that React Router uses — no code needed.

### Option B: Manual tracking with `useLocation` (if Option A is insufficient)

```typescript
// src/hooks/usePageTracking.ts
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';

export const usePageTracking = () => {
  const location = useLocation();
  useEffect(() => {
    ReactGA.send({ hitType: 'pageview', page_path: location.pathname });
  }, [location]);
};
```

**Critical:** pass `send_page_view: false` in `initialize()` to avoid double-counting the initial load. Hook must be placed inside `<BrowserRouter>`.

---

## 3. Initialization

```typescript
// src/main.tsx (or App.jsx top-level)
import ReactGA from 'react-ga4';

ReactGA.initialize('G-XXXXXXXX', {
  send_page_view: false,    // Required for SPA manual tracking
  debug: import.meta.env.DEV,
});
```

For performance, defer initialization until after first paint:

```typescript
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => ReactGA.initialize('G-XXXXXXXX', { send_page_view: false }));
} else {
  setTimeout(() => ReactGA.initialize('G-XXXXXXXX', { send_page_view: false }), 2000);
}
```

---

## 4. Key Events to Track

### Core interactions

```typescript
// "Get Recommendations" submit
ReactGA.event({ action: 'get_recommendations', category: 'engagement' });

// Role selected
ReactGA.event({ action: 'select_role', category: 'engagement', label: role });

// Champion input (ally/enemy)
ReactGA.event({ action: 'select_champion', category: 'engagement', label: championName });

// Breakdown panel opened
ReactGA.event({ action: 'view_breakdown', category: 'engagement', label: championName });
```

### Error tracking

```typescript
ReactGA.event({ action: 'api_error', category: 'errors', label: `status_${statusCode}` });
```

### Mark as Key Events in GA4 Admin

Go to GA4 Admin → Events, mark these as Key Events (the GA4 rename of "Conversions"):
- `get_recommendations` — user completed core action
- `select_role` — entered the funnel
- `api_error` — quality signal

### Naming conventions

- Use `snake_case` for all event names and labels
- Never include PII (usernames, IPs, etc.) in labels

---

## 5. Privacy & Consent

### IP anonymization

GA4 anonymizes IP addresses automatically — no configuration needed. IPs are used only for geo-detection and never stored.

### GDPR / Google Consent Mode v2 (required for EU traffic since March 2024)

Add this **before** the GA4 script in `index.html`:

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'analytics_storage': 'denied',
    'ad_storage': 'denied',
  });
</script>
```

Update after user responds to cookie banner:

```typescript
// User accepts
gtag('consent', 'update', { 'analytics_storage': 'granted' });

// User declines
gtag('consent', 'update', { 'analytics_storage': 'denied' });
```

### Cookie banner

Use `react-cookie-consent` for a lightweight banner. Requirements:
- Equal-prominence Accept / Decline buttons
- No pre-checked consent
- Link to privacy policy

**Minimum privacy policy statement:** "We use Google Analytics 4 to understand how users interact with our tool. We do not share data with advertisers."

### CCPA (US)

Less strict — opt-out is sufficient rather than opt-in. A simple "Analytics Preferences" link in the footer satisfies most state requirements.

---

## 6. Performance

GA4 adds ~100KB of network payload and minor CPU cost at initialization.

### Load with `defer` (not `async`)

```html
<!-- index.html -->
<script defer src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX"></script>
```

`defer` executes after HTML parsing; `async` can compete with first render.

### Skip GA4 in development

```typescript
if (import.meta.env.PROD) {
  ReactGA.initialize('G-XXXXXXXX', { send_page_view: false });
}
```

### Acceptable impact thresholds

| Metric | Target |
|--------|--------|
| GA4 script load | < 200ms |
| LCP increase | < 50ms |
| Per-event send | < 50ms |

Run Lighthouse before/after adding GA4 to confirm no regression.

---

## 7. Debugging

### Chrome Extension

Install **"Debugger for Google Analytics 4"** from the Chrome Web Store. Click the icon → ON (turns blue) while on your app.

### GA4 DebugView

GA4 Admin → DebugView — shows a real-time stream of events from your device when the extension is active.

### Common issues

| Symptom | Fix |
|---------|-----|
| DebugView empty | Check extension is ON (blue); check ad-blocker isn't blocking `googletagmanager.com` |
| Double page_view events | Set `send_page_view: false` in initialize() |
| Events missing in production | Verify `import.meta.env.PROD` guard isn't blocking init |
| Wrong page titles in reports | Set `document.title` before calling `ReactGA.send()` |

**Remember to turn the extension OFF after testing** — it sends debug data for every site you visit while active.

---

## 8. Most Useful GA4 Reports

### For a utility SPA like rabadon.gg

| Report | Location | What to look for |
|--------|----------|-----------------|
| **Engagement overview** | Reports → Engagement | Session duration, engagement rate — are users getting value? |
| **Events** | Reports → Engagement → Events | Which events fire most; champion/role selection trends |
| **Funnel Exploration** | Explore → Funnel | Drop-off between role selection → submit → viewing results |
| **Retention** | Reports → Retention | % of users returning after first visit — measures stickiness |
| **User Acquisition** | Reports → Acquisition | Traffic sources — how users find the tool |

### Recommended funnel to create

Steps:
1. `page_view` on `/` (session start)
2. `select_role` event
3. `get_recommendations` event
4. `view_breakdown` event (champion selected)

This reveals where users abandon the workflow.

### Avoid vanity metrics

- Raw page views alone don't indicate usefulness
- High bounce is expected for utility apps (user gets answer, leaves) — look at engagement rate instead
- Time on page is misleading for fast tools; focus on workflow completion rate

---

## Implementation Checklist

- [ ] GA4 property created; Measurement ID (G-XXXXXXXX) noted
- [ ] `npm install react-ga4`
- [ ] `ReactGA.initialize()` in main entry point with `send_page_view: false`
- [ ] Enhanced Measurement "Page changes based on browser history" enabled in GA4 Admin
- [ ] Core events wired: `get_recommendations`, `select_role`, `select_champion`, `api_error`
- [ ] Key Events marked in GA4 Admin
- [ ] Google Consent Mode v2 block added to `index.html` before GA4 script
- [ ] Cookie consent banner implemented (accept/decline)
- [ ] GA4 Chrome Debugger extension installed; events verified in DebugView
- [ ] GA4 skipped in `import.meta.env.DEV` (or debug mode enabled)
- [ ] Lighthouse run to verify < 50ms LCP regression
- [ ] Funnel Exploration report created in GA4
