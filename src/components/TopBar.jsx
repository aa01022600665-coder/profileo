import React from 'react'
import UserMenu from './UserMenu'

function TopBar({ user, onNavigate, onLogout }) {
  return (
    <div className="topbar">
      <div className="topbar-drag" />
      <div className="topbar-actions">
        {user && <UserMenu user={user} onNavigate={onNavigate} onLogout={onLogout} />}
        <div className="window-controls">
          <button className="win-btn" onClick={() => window.electronAPI.minimizeWindow()} title="Minimize">{'\u2500'}</button>
          <button className="win-btn" onClick={() => window.electronAPI.maximizeWindow()} title="Maximize">{'\u25A1'}</button>
          <button className="win-btn win-close" onClick={() => window.electronAPI.closeWindow()} title="Close">{'\u2715'}</button>
        </div>
      </div>
    </div>
  )
}

export default TopBar
