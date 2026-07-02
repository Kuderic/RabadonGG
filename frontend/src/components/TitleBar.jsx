import { useState, useEffect } from 'react'

export default function TitleBar({ lcuConnected, lcuSession, version, onShowChangelog }) {
  const appWindow = window.__TAURI__?.window?.getCurrentWindow?.() ?? null
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-desktop', '')

    // Relay wheel events from the side gutters (outside .app-container) to the
    // scroll container. In fullscreen the centered .app-container is narrower
    // than the window, so wheel events over the gutter hit #root (overflow:
    // hidden) and never reach the scrollable child.
    const root = document.getElementById('root')
    const handleGutterWheel = (e) => {
      const container = root?.querySelector('.app-container')
      if (!container || container.contains(e.target)) return
      container.scrollTop += e.deltaY
    }
    root?.addEventListener('wheel', handleGutterWheel, { passive: true })

    if (!appWindow) return () => {
      root?.removeEventListener('wheel', handleGutterWheel)
    }

    let unlisten
    appWindow.isMaximized().then(setMaximized)
    appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized)
    }).then(fn => { unlisten = fn })

    return () => {
      root?.removeEventListener('wheel', handleGutterWheel)
      unlisten?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  let statusCls = ''
  let statusText = 'Waiting for League client'
  if (lcuConnected && lcuSession) {
    statusCls = 'live'
    statusText = 'In champion select'
  } else if (lcuConnected) {
    statusCls = 'connected'
    statusText = 'League client connected'
  }

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="tb-brand">
        <span className="tb-logo" />
        <span className="tb-word">Rabadon.GG</span>
        <span className={'tb-status ' + statusCls}>
          <span className="tb-dot" />
          {statusText}
        </span>
      </div>
      <div className="tb-spacer" />
      {version && (
        <button className="tb-whats-new" onClick={onShowChangelog} title="What's new in this version">
          v{version} · Patch notes
        </button>
      )}
      <div className="tb-controls">
        <button className="tb-btn" title="Minimize to tray" onClick={() => appWindow?.hide()}>
          <svg viewBox="0 0 12 12"><rect x="1" y="5.4" width="10" height="1.2" fill="currentColor"/></svg>
        </button>
        <button className="tb-btn" title={maximized ? 'Restore' : 'Maximize'} onClick={() => appWindow?.toggleMaximize()}>
          {maximized ? (
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="2.5" y="3.5" width="7" height="7"/>
              <path d="M4.5 3.5V1.5h7v7h-2"/>
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1.5" y="1.5" width="9" height="9"/>
            </svg>
          )}
        </button>
        <button className="tb-btn close" title="Close" onClick={() => appWindow?.close()}>
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
