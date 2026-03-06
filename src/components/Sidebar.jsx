import React from 'react'

const NAV_ITEMS = [
  { id: 'newProfile', label: 'New Profile', className: 'nav-new', icon: 'plus' },
  { id: 'createMulti', label: 'Create Multi Profiles', className: 'nav-multi', icon: 'plus-plus' },
  { id: 'quick', label: 'Quick Profile', className: 'nav-quick', icon: 'bolt' },
  { id: 'profiles', label: 'Profiles', className: 'nav-profiles', icon: 'list' },
  { id: 'proxyManager', label: 'Proxy Manager', className: 'nav-proxy', icon: 'globe' },
  { id: 'automation', label: 'Automation', className: 'nav-automation', icon: 'robot' },
  { id: 'billing', label: 'Billing', className: 'nav-billing', icon: 'billing' },
]

function SideIcon({ type }) {
  switch (type) {
    case 'plus':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      )
    case 'plus-plus':
      return (
        <svg width="20" height="16" viewBox="0 0 28 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="7" y1="2" x2="7" y2="14"/><line x1="1" y1="8" x2="13" y2="8"/>
          <line x1="21" y1="2" x2="21" y2="14"/><line x1="15" y1="8" x2="27" y2="8"/>
        </svg>
      )
    case 'bolt':
      return (
        <svg width="16" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
      )
    case 'list':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      )
    case 'globe':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
        </svg>
      )
    case 'robot':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="8" width="16" height="12" rx="2"/>
          <circle cx="9" cy="14" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="14" r="1.5" fill="currentColor"/>
          <line x1="12" y1="4" x2="12" y2="8"/>
          <circle cx="12" cy="3" r="1.5"/>
        </svg>
      )
    case 'billing':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <line x1="2" y1="10" x2="22" y2="10"/>
          <line x1="6" y1="15" x2="10" y2="15"/>
          <line x1="6" y1="18" x2="8" y2="18"/>
        </svg>
      )
    case 'settings':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      )
    default: return null
  }
}

function Sidebar({ currentView, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="30" height="30" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="5" fill="#61dafb"/>
            <ellipse cx="32" cy="32" rx="28" ry="11" stroke="#61dafb" strokeWidth="2.5" fill="none"/>
            <ellipse cx="32" cy="32" rx="28" ry="11" stroke="#61dafb" strokeWidth="2.5" fill="none" transform="rotate(60 32 32)"/>
            <ellipse cx="32" cy="32" rx="28" ry="11" stroke="#61dafb" strokeWidth="2.5" fill="none" transform="rotate(120 32 32)"/>
          </svg>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-icon-btn ${item.className} ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            title={item.label}
          >
            <SideIcon type={item.icon} />
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className={`nav-icon-btn ${currentView === 'settings' ? 'active' : ''}`} title="Settings" onClick={() => onNavigate('settings')}>
          <SideIcon type="settings" />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
