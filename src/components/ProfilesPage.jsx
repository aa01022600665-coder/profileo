import React, { useState } from 'react'

const FOLDER_COLORS = ['#4285f4','#e94560','#ffab00','#2ecc71','#9b59b6','#e67e22','#1abc9c','#e74c3c']

function OsIcon({ os }) {
  const size = 16
  switch (os) {
    case 'Windows':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M3 12.5h8v8.2L3 19.5v-7zm0-9.2L11 2v8.2H3V3.3zm9.5-1.5L22 1v10.2h-9.5V1.8zm0 20.4V12.8H22V23l-9.5-0.8z" fill="#00adef"/>
        </svg>
      )
    case 'MacOS':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#a2aaad"/>
        </svg>
      )
    case 'Linux':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12.5 2C10 2 8.2 4.1 8.2 7c0 1.3.4 2.5 1 3.5L7 14c-.8 1-1.5 2.2-1.5 3.5 0 .8.3 1.5.8 2 .5.6 1.2 1 2 1.2.7.2 1.5.3 2.2.3h3c.7 0 1.5-.1 2.2-.3.8-.2 1.5-.6 2-1.2.5-.5.8-1.2.8-2 0-1.3-.7-2.5-1.5-3.5l-2.2-3.5c.6-1 1-2.2 1-3.5 0-2.9-1.8-5-4.3-5z" fill="#f0c040"/>
          <circle cx="10.5" cy="6.5" r="1" fill="#333"/>
          <circle cx="14.5" cy="6.5" r="1" fill="#333"/>
          <path d="M10.5 9c0 0 .7 1.2 2 1.2s2-1.2 2-1.2" stroke="#333" strokeWidth=".8" fill="none"/>
        </svg>
      )
    case 'Android':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" fill="#3ddc84"/>
        </svg>
      )
    case 'iOS':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#8e8e93"/>
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      )
  }
}

function DuplicateDialog({ profile, onDuplicate, onClose }) {
  const [count, setCount] = useState(1)
  const [options, setOptions] = useState({
    fingerprint: true,
    userAgents: true,
    webrtcGeo: true,
    proxy: true,
  })
  const toggle = k => setOptions(p => ({ ...p, [k]: !p[k] }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Duplicate Profile</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p className="modal-hint">Duplicating: <strong>{profile.name}</strong></p>
          <div className="form-group">
            <label>Number of copies</label>
            <input type="number" className="np-input" min={1} max={50} value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} />
          </div>
          <div className="form-group">
            <label>Include in duplicate:</label>
            <div className="dup-options">
              <label className="dup-check"><input type="checkbox" checked={options.fingerprint} onChange={() => toggle('fingerprint')} /> Fingerprint</label>
              <label className="dup-check"><input type="checkbox" checked={options.userAgents} onChange={() => toggle('userAgents')} /> User Agents</label>
              <label className="dup-check"><input type="checkbox" checked={options.webrtcGeo} onChange={() => toggle('webrtcGeo')} /> WebRTC & Geolocation</label>
              <label className="dup-check"><input type="checkbox" checked={options.proxy} onChange={() => toggle('proxy')} /> Proxy</label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onDuplicate(profile.id, count, options); onClose() }}>Create {count} copies</button>
        </div>
      </div>
    </div>
  )
}

function NewFolderDialog({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#4285f4')
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Folder</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Folder Name</label>
            <input type="text" className="np-input" placeholder="Enter folder name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-picks">
              {FOLDER_COLORS.map(c => (
                <button key={c} className={`color-dot ${color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if (name.trim()) { onSave({ name, color }); onClose() } }}>Create</button>
        </div>
      </div>
    </div>
  )
}

function ProfilesPage({
  profiles, allProfiles, folders, activeFolder, billingPlan,
  onFolderSelect, onEdit, onDelete, onDeleteMultiple, onDuplicate,
  onLaunch, onStop, onCreateNew, onCreateMulti,
  onCreateFolder, onDeleteFolder
}) {
  const planActive = billingPlan && billingPlan.isActive
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [dupProfile, setDupProfile] = useState(null)
  const [showNewFolder, setShowNewFolder] = useState(false)

  const filtered = profiles.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.notes || '').toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => p.id)))
  }

  const handleBulkDelete = () => {
    if (selected.size === 0) return
    if (!window.confirm(`Delete ${selected.size} selected profile(s)? This cannot be undone.`)) return
    onDeleteMultiple([...selected])
    setSelected(new Set())
  }

  const handleBulkRun = () => {
    for (const id of selected) onLaunch(id)
    setSelected(new Set())
  }

  const getFolderCount = (fId) => {
    if (fId === 'all') return allProfiles.length
    return allProfiles.filter(p => p.folder === fId).length
  }

  return (
    <div className="profiles-page">
      <div className="profiles-layout">
        {/* Folder Panel */}
        <div className="folder-panel">
          <div className="folder-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            <span className="folder-title">FOLDERS</span>
            <button className="folder-add-btn" onClick={() => setShowNewFolder(true)} title="New Folder">+</button>
          </div>
          <div className="folder-list">
            {folders.map(f => (
              <button
                key={f.id}
                className={`folder-item ${activeFolder === f.id ? 'active' : ''}`}
                onClick={() => onFolderSelect(f.id)}
              >
                <span className="folder-dot" style={{ background: f.color }} />
                <span className="folder-name">{f.name}</span>
                <span className="folder-count">{getFolderCount(f.id)}</span>
                {f.id !== 'all' && (
                  <button className="folder-del" onClick={e => { e.stopPropagation(); if (window.confirm(`Delete folder "${f.name}"? Profiles will be moved to All.`)) onDeleteFolder(f.id) }} title="Delete folder">&times;</button>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Table */}
        <div className="profiles-main">
          <div className="profiles-toolbar">
            <div className="profiles-toolbar-left">
              {selected.size > 0 ? (
                <>
                  <button className="btn btn-sm btn-success" onClick={handleBulkRun} disabled={!planActive}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    Run ({selected.size})
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={handleBulkDelete}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg>
                    Delete ({selected.size})
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
                </>
              ) : (
                <span className="toolbar-label">{filtered.length} profile{filtered.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="profiles-toolbar-right">
              <div className="search-wrapper">
                <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" className="search-bar" placeholder="Search profiles..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {!planActive && profiles.length > 0 && (
            <div className="plan-expired-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>Your plan has expired. Renew to launch profiles.</span>
            </div>
          )}

          <div className="profile-table-wrapper">
            <table className="profile-table">
              <thead>
                <tr>
                  <th className="col-check"><input type="checkbox" onChange={selectAll} checked={selected.size === filtered.length && filtered.length > 0} /></th>
                  <th className="col-num">#</th>
                  <th className="col-name">Profile Name</th>
                  <th className="col-browser">Browser</th>
                  <th className="col-status">Status</th>
                  <th className="col-proxy">Proxy</th>
                  <th className="col-action"></th>
                  <th className="col-more"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((profile, i) => (
                  <tr key={profile.id} className={selected.has(profile.id) ? 'row-selected' : ''}>
                    <td className="col-check"><input type="checkbox" checked={selected.has(profile.id)} onChange={() => toggleSelect(profile.id)} /></td>
                    <td className="col-num">{i + 1}</td>
                    <td className="col-name">
                      <span className="profile-name-text">{profile.name}</span>
                      <OsIcon os={profile.os} />
                      {profile.status === 'active' && <span className="name-dot dot-active" />}
                    </td>
                    <td className="col-browser">{profile.browser || 'Chrome'}</td>
                    <td className="col-status">
                      <span className={`status-tag ${profile.status === 'active' ? 'tag-active' : 'tag-ready'}`}>
                        {profile.status === 'active' ? 'Running' : 'Ready'}
                      </span>
                    </td>
                    <td className="col-proxy"><span className="proxy-type-text">{profile.proxyType || 'None'}</span></td>
                    <td className="col-action">
                      {profile.status === 'active'
                        ? <button className="run-btn run-stop" onClick={() => onStop(profile.id)}>Stop</button>
                        : <button className="run-btn" onClick={() => onLaunch(profile.id)} disabled={!planActive}>Run</button>
                      }
                    </td>
                    <td className="col-more">
                      <div className="more-menu">
                        <button className="more-btn" title="Edit" onClick={() => onEdit(profile)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="more-btn" title="Duplicate" onClick={() => setDupProfile(profile)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                        <button className="more-btn more-delete" title="Delete" onClick={() => { if (window.confirm(`Delete "${profile.name}"?`)) onDelete(profile.id) }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      <div className="empty-state">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                        <p>No profiles found</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary" onClick={onCreateNew}>+ New Profile</button>
                          <button className="btn btn-success" onClick={onCreateMulti}>++ Multi Profiles</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {dupProfile && <DuplicateDialog profile={dupProfile} onDuplicate={onDuplicate} onClose={() => setDupProfile(null)} />}
      {showNewFolder && <NewFolderDialog onSave={onCreateFolder} onClose={() => setShowNewFolder(false)} />}
    </div>
  )
}

export default ProfilesPage
