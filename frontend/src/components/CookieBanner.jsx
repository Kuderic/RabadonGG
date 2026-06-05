import { useState, useEffect } from 'react'
import { grantConsent, denyConsent } from '../utils/analytics'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('ga_consent')
    if (!stored) {
      setVisible(true)
    } else if (stored === 'granted') {
      grantConsent()
    }
  }, [])

  if (!visible) return null

  const accept = () => {
    localStorage.setItem('ga_consent', 'granted')
    grantConsent()
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem('ga_consent', 'denied')
    denyConsent()
    setVisible(false)
  }

  return (
    <div className="cookie-banner">
      <span className="cookie-banner-text">
        We use Google Analytics to understand how the tool is used — no ads, no personal data.
      </span>
      <div className="cookie-banner-actions">
        <button className="cookie-btn cookie-btn--accept" onClick={accept}>Accept</button>
        <button className="cookie-btn cookie-btn--decline" onClick={decline}>Decline</button>
      </div>
    </div>
  )
}
