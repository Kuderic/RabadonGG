import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import OverlayApp from './components/OverlayApp.jsx'
import './App.css'
import { initGA } from './utils/analytics'

initGA()

const IS_TAURI = typeof window !== 'undefined' && window.__TAURI__ != null
const isOverlay = IS_TAURI && new URLSearchParams(window.location.search).get('mode') === 'overlay'
// Lets App.css strip the opaque body background in the overlay window (see
// the "Overlay window" section) so the Tauri transparent window shows through.
if (isOverlay) document.documentElement.setAttribute('data-overlay', '')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isOverlay ? <OverlayApp /> : <App />}
  </React.StrictMode>,
)
