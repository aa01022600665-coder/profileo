import React from 'react'
import { PLATFORMS } from './nodeConfigs'

function ScriptBuilderTopBar({ scriptMeta, onMetaChange, onSave, onClose, isSaving }) {
  return (
    <div className="sb-topbar">
      <button className="sb-topbar-close" onClick={onClose} title="Close" style={{ WebkitAppRegion: 'no-drag' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <input
        className="sb-topbar-name"
        type="text"
        placeholder="Script Name"
        value={scriptMeta.name}
        onChange={e => onMetaChange({ ...scriptMeta, name: e.target.value })}
        style={{ WebkitAppRegion: 'no-drag' }}
      />

      <div className="sb-topbar-tags" style={{ WebkitAppRegion: 'no-drag' }}>
        <span className="sb-topbar-tags-label">Tags</span>
        <input
          className="sb-topbar-tags-input"
          type="text"
          placeholder="Amazon, eBay..."
          value={scriptMeta.tags}
          onChange={e => onMetaChange({ ...scriptMeta, tags: e.target.value })}
          style={{ WebkitAppRegion: 'no-drag' }}
        />
      </div>

      <select
        className="sb-topbar-select"
        value={scriptMeta.platform}
        onChange={e => onMetaChange({ ...scriptMeta, platform: e.target.value })}
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <div className="sb-topbar-actions" style={{ WebkitAppRegion: 'no-drag' }}>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={isSaving}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: -1 }}>
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          {isSaving ? 'Saving...' : 'SAVE'}
        </button>
      </div>
    </div>
  )
}

export default ScriptBuilderTopBar
