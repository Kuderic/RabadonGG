import ReactGA from 'react-ga4'

const MEASUREMENT_ID = 'G-S4EY2NEKRG'

export function initGA() {
  if (import.meta.env.PROD) {
    ReactGA.initialize(MEASUREMENT_ID, { send_page_view: false })
  }
}

export function trackEvent(action, params = {}) {
  if (import.meta.env.PROD) {
    ReactGA.event({ action, ...params })
  }
}

export function grantConsent() {
  window.gtag?.('consent', 'update', { analytics_storage: 'granted' })
}

export function denyConsent() {
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' })
}
