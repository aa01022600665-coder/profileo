import React, { useEffect, useState } from 'react'
import UserMenu from './UserMenu'

function getUpdateLabel(state) {
  const status = state?.status || 'idle'
  if (status === 'checking') return 'Checking...'
  if (status === 'available') return 'Download Update'
  if (status === 'downloading') return `${state?.progress || 0}%`
  if (status === 'downloaded') return 'Install Update'
  if (status === 'installing') return 'Installing...'
  if (status === 'not-available') return 'Up to date'
  return 'Update'
}

function UpdateButton() {
  const [updateState, setUpdateState] = useState({ status: 'idle', message: '' })

  useEffect(() => {
    let cleanup = null
    window.electronAPI.getUpdateState?.().then(state => {
      if (state) setUpdateState(state)
    }).catch(() => {})

    cleanup = window.electronAPI.onUpdateStatus?.(state => {
      if (state) setUpdateState(state)
    })

    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [])

  const status = updateState?.status || 'idle'
  const busy = status === 'checking' || status === 'downloading' || status === 'installing'

  const handleClick = async () => {
    if (busy) return

    try {
      if (status === 'available') {
        await window.electronAPI.downloadUpdate()
        return
      }

      if (status === 'downloaded') {
        await window.electronAPI.installUpdate()
        return
      }

      await window.electronAPI.checkForUpdates()
    } catch (error) {
      setUpdateState({
        status: 'error',
        message: error?.message || 'Update failed'
      })
    }
  }

  const title = updateState?.message || 'Check for Profileo updates'

  return (
    <button
      className={`update-btn update-${status}`}
      onClick={handleClick}
      disabled={busy}
      title={title}
      aria-label={getUpdateLabel(updateState)}
    >
      <svg className="update-btn-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 12a8 8 0 11-2.34-5.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>{getUpdateLabel(updateState)}</span>
    </button>
  )
}

function TopBar({ user, onNavigate, onLogout }) {
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <div className="topbar-brand-mark">
          <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="5" fill="currentColor"/>
            <ellipse cx="32" cy="32" rx="28" ry="11" stroke="currentColor" strokeWidth="3" fill="none"/>
            <ellipse cx="32" cy="32" rx="28" ry="11" stroke="currentColor" strokeWidth="3" fill="none" transform="rotate(60 32 32)"/>
            <ellipse cx="32" cy="32" rx="28" ry="11" stroke="currentColor" strokeWidth="3" fill="none" transform="rotate(120 32 32)"/>
          </svg>
        </div>
        <span className="topbar-title">Profileo</span>
      </div>
      <div className="topbar-drag" />
      <div className="topbar-actions">
        <UpdateButton />
        {user && <UserMenu user={user} onNavigate={onNavigate} onLogout={onLogout} />}
        <div className="window-controls">
          <button className="win-btn" onClick={() => window.electronAPI.minimizeWindow()} title="Minimize" aria-label="Minimize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M7 12h10" />
            </svg>
          </button>
          <button className="win-btn" onClick={() => window.electronAPI.maximizeWindow()} title="Maximize" aria-label="Maximize">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="7" y="7" width="10" height="10" rx="1.5" />
            </svg>
          </button>
          <button className="win-btn win-close" onClick={() => window.electronAPI.closeWindow()} title="Close" aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default TopBar
