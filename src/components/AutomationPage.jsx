import React, { useState, useEffect } from 'react'
import youtubeIcon from '../assets/brand-icons/youtube.webp'
import kickIcon from '../assets/brand-icons/kick.gif'

const PLATFORM_FILTERS = ['All', 'YouTube', 'Twitch', 'Kick', 'Amazon', 'eBay', 'Facebook', 'Google', 'Instagram', 'TikTok', 'X', 'Other']

function PlatformIcon({ platform, size = 32 }) {
  const s = size
  switch (platform) {
    case 'Amazon':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#FF9900"/>
          <path d="M15 28c0 0 4 5 10 5s9-3 9-3" stroke="#232F3E" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M30 28l2 3" stroke="#232F3E" strokeWidth="2.5" strokeLinecap="round"/>
          <text x="24" y="24" textAnchor="middle" fontWeight="800" fontSize="16" fill="#232F3E">a</text>
        </svg>
      )
    case 'eBay':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#fff"/>
          <text x="6" y="32" fontWeight="800" fontSize="18" fill="#E53238">e</text>
          <text x="15" y="32" fontWeight="800" fontSize="18" fill="#0064D2">b</text>
          <text x="25" y="32" fontWeight="800" fontSize="18" fill="#F5AF02">a</text>
          <text x="35" y="32" fontWeight="800" fontSize="18" fill="#86B817">y</text>
        </svg>
      )
    case 'Facebook':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#1877F2"/>
          <text x="24" y="36" textAnchor="middle" fontWeight="800" fontSize="28" fill="#fff">f</text>
        </svg>
      )
    case 'Google':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#fff"/>
          <text x="24" y="35" textAnchor="middle" fontWeight="800" fontSize="28" fill="#4285F4">G</text>
        </svg>
      )
    case 'Instagram':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <defs>
            <linearGradient id="ig" x1="0" y1="48" x2="48" y2="0">
              <stop offset="0%" stopColor="#FD5"/>
              <stop offset="50%" stopColor="#FF543E"/>
              <stop offset="100%" stopColor="#C837AB"/>
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="10" fill="url(#ig)"/>
          <rect x="12" y="12" width="24" height="24" rx="6" stroke="#fff" strokeWidth="2.5" fill="none"/>
          <circle cx="24" cy="24" r="6" stroke="#fff" strokeWidth="2.5" fill="none"/>
          <circle cx="32" cy="16" r="2" fill="#fff"/>
        </svg>
      )
    case 'TikTok':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#010101"/>
          <path d="M28 14v16a6 6 0 1 1-4-5.66" stroke="#25F4EE" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <path d="M28 14a8 8 0 0 0 6 4" stroke="#FE2C55" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      )
    case 'X':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#000"/>
          <text x="24" y="34" textAnchor="middle" fontWeight="800" fontSize="26" fill="#fff">𝕏</text>
        </svg>
      )
    case 'YouTube':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#FF0000"/>
          <path d="M19 16v16l14-8z" fill="#fff"/>
        </svg>
      )
    case 'Twitch':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#9146FF"/>
          <path d="M13 10v24h7v4l4-4h5l8-8V10H13zm20 14l-4 4h-5l-3.5 3.5V28H15V13h18v11z" fill="#fff"/>
          <rect x="24" y="17" width="3" height="7" rx="1" fill="#fff"/>
          <rect x="30" y="17" width="3" height="7" rx="1" fill="#fff"/>
        </svg>
      )
    case 'Kick':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#53FC18"/>
          <text x="24" y="34" textAnchor="middle" fontWeight="900" fontSize="22" fill="#000">K</text>
        </svg>
      )
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#4285f4"/>
          <path d="M16 32V20l8-6 8 6v12h-6v-6h-4v6z" fill="#fff"/>
        </svg>
      )
  }
}

function PremiumPlatformIcon({ platform, size = 42 }) {
  const key = String(platform || 'Other').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'other'
  const iconSize = Math.max(18, Math.round(size * 0.62))
  const imageIcons = {
    youtube: youtubeIcon,
    kick: kickIcon
  }

  const glyphs = {
    youtube: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M41.5 15.1a5.2 5.2 0 0 0-3.7-3.7C34.5 10.5 24 10.5 24 10.5s-10.5 0-13.8.9a5.2 5.2 0 0 0-3.7 3.7c-.9 3.3-.9 8.9-.9 8.9s0 5.6.9 8.9a5.2 5.2 0 0 0 3.7 3.7c3.3.9 13.8.9 13.8.9s10.5 0 13.8-.9a5.2 5.2 0 0 0 3.7-3.7c.9-3.3.9-8.9.9-8.9s0-5.6-.9-8.9z" fill="currentColor"/>
        <path d="M20.4 30.1V17.9L31 24l-10.6 6.1z" fill="#fff"/>
      </svg>
    ),
    twitch: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M12 9h28v19l-8 8h-7l-5 5v-5h-8V9zm5 5v17h7v4l4-4h5l4-4V14H17z" fill="currentColor"/>
        <rect x="25" y="18" width="3" height="8" rx="1" fill="#fff"/>
        <rect x="32" y="18" width="3" height="8" rx="1" fill="#fff"/>
      </svg>
    ),
    kick: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M9 9h13v11h3.7L34 9h12L34.8 23.2 46 39H33.4l-7.6-10.7H22V39H9V9z" fill="currentColor"/>
        <path d="M17 16h4.2v8.8h4.1l6.7-8.8h3.2l-7.9 10 7.7 10h-3.5l-6.3-8.5h-4V36H17V16z" fill="rgba(255,255,255,0.32)"/>
      </svg>
    ),
    amazon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <text x="24" y="24" textAnchor="middle" fontWeight="900" fontSize="19" fill="currentColor">a</text>
        <path d="M15 30c3.2 3 7.1 4.5 11.6 4.5 3.5 0 6.2-.8 8.4-2.4" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        <path d="M32 31l3.5.9-.9 3.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    ebay: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <text x="7" y="31" fontWeight="900" fontSize="17" fill="#E53238">e</text>
        <text x="16" y="31" fontWeight="900" fontSize="17" fill="#0064D2">b</text>
        <text x="26" y="31" fontWeight="900" fontSize="17" fill="#F5AF02">a</text>
        <text x="36" y="31" fontWeight="900" fontSize="17" fill="#86B817">y</text>
      </svg>
    ),
    facebook: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M28.5 15.5h4V9.2c-.7-.1-3.1-.3-5.9-.3-5.8 0-9.8 3.6-9.8 10.2v5.8h-6.6V32h6.6v16h8V32h6.5l1-7.1h-7.5v-5.1c0-2.1.6-4.3 3.7-4.3z" fill="currentColor"/>
      </svg>
    ),
    google: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M43 24.5c0-1.4-.1-2.5-.3-3.7H24v7.1h10.9c-.2 1.8-1.4 4.6-4.1 6.5l-.1.5 5.9 4.5.4.1c3.8-3.5 6-8.7 6-15z" fill="#4285F4"/>
        <path d="M24 44c5.4 0 10-1.8 13.3-4.8l-6.3-4.9c-1.7 1.2-4 2-7 2-5.3 0-9.8-3.5-11.4-8.2l-.5.1-6.1 4.7-.1.5C9.2 39.7 16 44 24 44z" fill="#34A853"/>
        <path d="M12.6 28.1c-.4-1.2-.7-2.6-.7-4.1s.2-2.9.7-4.1l-.1-.5-6.2-4.8-.4.2C4.7 17.6 4 20.7 4 24s.7 6.4 1.9 9.2l6.7-5.1z" fill="#FBBC05"/>
        <path d="M24 11.7c3.8 0 6.4 1.6 7.9 3l5.8-5.7C34.1 5.7 29.4 4 24 4 16 4 9.2 8.3 5.9 14.8l6.7 5.1c1.7-4.8 6.2-8.2 11.4-8.2z" fill="#EA4335"/>
      </svg>
    ),
    instagram: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="10" y="10" width="28" height="28" rx="8" stroke="currentColor" strokeWidth="3"/>
        <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="3"/>
        <circle cx="32.5" cy="15.5" r="2.2" fill="currentColor"/>
      </svg>
    ),
    tiktok: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M29 12v17.2a7.2 7.2 0 1 1-5-6.8" stroke="#25F4EE" strokeWidth="3.3" strokeLinecap="round" fill="none"/>
        <path d="M31 12.5c1.5 3.8 4.2 6 8 6.6" stroke="#FE2C55" strokeWidth="3.3" strokeLinecap="round"/>
        <path d="M27 12v17.2a7.2 7.2 0 1 1-5-6.8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" fill="none"/>
      </svg>
    ),
    x: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M12 11h7.8l6 8.3 7.3-8.3h4.1L27.7 22l10.6 15H30l-6.7-9.5-8.2 9.5H11l10.3-12L12 11zm6.1 3 13.5 19h2L20.2 14h-2.1z" fill="currentColor"/>
      </svg>
    )
  }

  return (
    <span
      className={`platform-icon-shell platform-${key}`}
      style={{ width: size, height: size, borderRadius: Math.max(12, Math.round(size * 0.3)) }}
      aria-label={platform || 'Other'}
    >
      <span className="platform-icon-shine" />
      {imageIcons[key] ? (
        <img className="platform-icon-img" src={imageIcons[key]} alt="" draggable="false" />
      ) : glyphs[key] || (
        <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 8l13 7.5v17L24 40 11 32.5v-17L24 8z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
          <path d="M24 18v12M18 24h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      )}
    </span>
  )
}

function ScriptCard({ script, onRun, onEdit, onDelete }) {
  const isUser = script.type === 'user'

  const handleDelete = (e) => {
    e.stopPropagation()
    if (confirm(`Delete "${script.name}"?`)) {
      onDelete(script.id)
    }
  }

  return (
    <div className="auto-card">
      <div className="auto-card-header">
        <div className="auto-card-icon">
          <PremiumPlatformIcon platform={script.platform} size={46} />
        </div>
      </div>
      <p className="auto-card-desc">{script.description || script.name}</p>
      <div className="auto-card-footer">
        <span className="auto-card-badge">{script.price}</span>
        <button className="btn btn-success btn-sm" onClick={() => onRun(script)}>Run</button>
      </div>
      {isUser && (
        <div className="auto-card-actions">
          <button className="btn-edit" onClick={() => onEdit(script.id)}>Edit</button>
          <button className="btn-del" onClick={handleDelete}>Delete</button>
        </div>
      )}
    </div>
  )
}

function RunDialog({ script, profiles, onRun, onClose }) {
  const [selectedProfiles, setSelectedProfiles] = useState([])
  const [profileParamFiles, setProfileParamFiles] = useState({})
  const [params, setParams] = useState(() => {
    const defaults = {}
    ;(script.params || []).forEach(p => {
      defaults[p.key] = p.default !== undefined ? p.default : ''
    })
    return defaults
  })
  const normalParams = (script.params || []).filter(p => p.type !== 'profileFile')
  const profileFileParams = (script.params || []).filter(p => p.type === 'profileFile')

  const toggleProfile = (id) => {
    setSelectedProfiles(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const selectAll = () => {
    if (selectedProfiles.length === profiles.length) {
      setSelectedProfiles([])
    } else {
      setSelectedProfiles(profiles.map(p => p.id))
    }
  }

  useEffect(() => {
    if (!profileFileParams.length || !selectedProfiles.length) return
    let cancelled = false
    ;(async () => {
      const updates = {}
      for (const profileId of selectedProfiles) {
        const state = await window.electronAPI.getAutomationProfileState(script.id, profileId).catch(() => ({}))
        for (const param of profileFileParams) {
          if (state?.[param.key]) {
            updates[profileId] = { ...(updates[profileId] || {}), [param.key]: state[param.key] }
          }
        }
      }
      if (!cancelled && Object.keys(updates).length) {
        setProfileParamFiles(prev => ({ ...prev, ...updates }))
      }
    })()
    return () => { cancelled = true }
  }, [script.id, selectedProfiles.join('|')])

  const chooseProfileFile = async (profileId, paramKey) => {
    const filePath = await window.electronAPI.selectAutomationTextFile().catch(() => '')
    if (!filePath) return
    setProfileParamFiles(prev => ({
      ...prev,
      [profileId]: {
        ...(prev[profileId] || {}),
        [paramKey]: filePath
      }
    }))
    await window.electronAPI.saveAutomationProfileState(script.id, profileId, { [paramKey]: filePath }).catch(() => {})
  }

  const handleRun = async () => {
    if (selectedProfiles.length === 0) return
    const missingParam = normalParams.find(p => p.required && !String(params[p.key] ?? '').trim())
    if (missingParam) {
      alert(`${missingParam.label} is required`)
      return
    }
    if (profileFileParams.length) {
      const missingProfileId = selectedProfiles.find(profileId => {
        return profileFileParams.some(param => {
          if (param.key === 'keywordFile' || param.key === 'commentFile') return false
          return param.required && !String(profileParamFiles[profileId]?.[param.key] || '').trim()
        })
      })
      if (missingProfileId) {
        const profileName = profiles.find(profile => profile.id === missingProfileId)?.name || 'selected profile'
        alert(`Required .txt file is missing for ${profileName}`)
        return
      }
    }
    onRun(script, selectedProfiles, {
      ...params,
      __profileFileParams: profileParamFiles
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 520 }}>
        <div className="modal-header">
          <h3>Run: {script.name}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Select Profiles</label>
            <div style={{ marginBottom: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>
                {selectedProfiles.length === profiles.length ? 'Deselect All' : 'Select All'}
              </button>
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>{selectedProfiles.length} selected</span>
            </div>
            <div className="auto-profile-list">
              {profiles.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No profiles found. Create a profile first.
                </div>
              )}
              {profiles.map(p => (
                <div key={p.id} className={`auto-profile-item ${selectedProfiles.includes(p.id) ? 'selected' : ''}`} onClick={() => toggleProfile(p.id)}>
                  <input type="checkbox" checked={selectedProfiles.includes(p.id)} readOnly style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span className={`status-tag ${p.status === 'active' ? 'tag-active' : 'tag-ready'}`} style={{ fontSize: 9, padding: '2px 6px' }}>{p.status || 'Ready'}</span>
                </div>
              ))}
            </div>
          </div>

          {normalParams.length > 0 && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Parameters</label>
              {normalParams.map(p => (
                <div key={p.key} style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' }}>{p.label}{p.required && ' *'}</label>
                  {p.type === 'select' ? (
                    <select
                      className="np-input"
                      value={params[p.key] || p.default || ''}
                      onChange={e => setParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                    >
                      {(p.options || []).map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={p.type === 'number' ? 'number' : 'text'}
                      className="np-input"
                      placeholder={p.placeholder || ''}
                      value={params[p.key] || ''}
                      min={p.min}
                      max={p.max}
                      onChange={e => setParams(prev => ({ ...prev, [p.key]: p.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {profileFileParams.length > 0 && selectedProfiles.length > 0 && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Profile Text Files</label>
              <div className="auto-profile-list" style={{ maxHeight: 180 }}>
                {selectedProfiles.map(profileId => {
                  const profile = profiles.find(item => item.id === profileId)
                  return (
                    <div key={profileId} className="auto-profile-item selected">
                      <span style={{ flex: 1 }}>{profile?.name || profileId}</span>
                      {profileFileParams.map(param => {
                        const value = profileParamFiles[profileId]?.[param.key] || ''
                        return (
                          <button
                            key={param.key}
                            className="btn btn-ghost btn-sm"
                            onClick={() => chooseProfileFile(profileId, param.key)}
                            title={value || param.label}
                            style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {value ? `${param.label.replace('Profile .txt ', '').replace(' File', '')}: ${value.split(/[\\/]/).pop()}` : param.key === 'keywordFile' ? 'Search .txt' : 'Comments .txt'}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginTop: 12 }}>
            <label style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3, display: 'block' }}>TARGET URL (Optional)</label>
            <input
              type="text"
              className="np-input"
              placeholder="Paste a URL to override default destination (leave empty for default)"
              value={params.targetUrl || ''}
              onChange={e => setParams(prev => ({ ...prev, targetUrl: e.target.value }))}
              style={{ fontSize: 12 }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={handleRun} disabled={selectedProfiles.length === 0}>
            Run on {selectedProfiles.length} profile{selectedProfiles.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusPanel({ statuses, scripts, onStop }) {
  const entries = Object.entries(statuses).filter(([, s]) => s.status === 'running' || s.status === 'error' || s.status === 'completed')
  if (entries.length === 0) return null

  return (
    <div className="auto-status-panel">
      {entries.map(([profileId, info]) => {
        const script = scripts.find(s => s.id === info.scriptId)
        const pct = info.totalSteps > 0 ? Math.round((info.currentStep / info.totalSteps) * 100) : 0
        return (
          <div key={profileId} className="auto-status-row">
            <span style={{ minWidth: 100, fontWeight: 600, color: 'var(--text-primary)' }}>{script?.name || info.scriptId}</span>
            <div className="auto-status-progress">
              <div className="auto-status-bar" style={{
                width: `${pct}%`,
                background: info.status === 'error' ? 'var(--danger)' : info.status === 'completed' ? 'var(--success)' : 'var(--accent)'
              }} />
            </div>
            <span className="auto-status-label" style={{
              color: info.status === 'error' ? 'var(--danger)' : info.status === 'completed' ? 'var(--success)' : 'var(--text-muted)'
            }}>
              {info.status === 'error' ? 'Error' : info.status === 'completed' ? 'Done' : `${info.currentStep}/${info.totalSteps}`}
            </span>
            {info.status === 'running' && (
              <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => onStop(profileId)}>Stop</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function UserScriptsTable({ scripts, onRun, onEdit, onDelete }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${h}:${m}`
  }

  return (
    <div className="us-table-wrapper">
      <table className="us-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Tag</th>
            <th>Description</th>
            <th>Platform</th>
            <th>Last Update</th>
            <th style={{ width: 160, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {scripts.map(script => (
            <tr key={script.id}>
              <td className="us-name">
                <PremiumPlatformIcon platform={script.platform} size={28} />
                <span>{script.name || 'Untitled'}</span>
              </td>
              <td className="us-tag">{script.tags || '—'}</td>
              <td className="us-desc">{script.description || '—'}</td>
              <td className="us-platform">{script.platform || 'Other'}</td>
              <td className="us-date">{formatDate(script.updatedAt)}</td>
              <td className="us-actions">
                <button className="btn btn-success btn-sm" onClick={() => onRun(script)} style={{ padding: '4px 12px', fontSize: 11 }}>Run</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(script.id)} style={{ padding: '4px 10px', fontSize: 11 }}>Edit</button>
                <button className="btn btn-ghost btn-sm us-del" onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`Delete "${script.name}"?`)) onDelete(script.id)
                }} style={{ padding: '4px 10px', fontSize: 11 }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AutomationPage({ profiles, automationStatuses, onCreateScript, onEditScript, initialTab }) {
  const [scripts, setScripts] = useState([])
  const [userScripts, setUserScripts] = useState([])
  const [activeTab, setActiveTab] = useState(initialTab || 'system')
  const [activePlatform, setActivePlatform] = useState('All')
  const [search, setSearch] = useState('')
  const [runDialogScript, setRunDialogScript] = useState(null)
  const [statuses, setStatuses] = useState(automationStatuses || {})

  const loadUserScripts = () => {
    window.electronAPI.getUserScripts().then(list => {
      setUserScripts(list || [])
    }).catch(() => {})
  }

  // Switch to user tab when coming back from script builder
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    window.electronAPI.getAutomationScripts().then(setScripts).catch(() => {})
    loadUserScripts()
    const unsub = window.electronAPI.onAutomationProgress((data) => {
      setStatuses(prev => ({ ...prev, [data.profileId]: data }))
    })
    return unsub
  }, [])

  useEffect(() => {
    setStatuses(automationStatuses || {})
  }, [automationStatuses])

  const allScripts = activeTab === 'user' ? userScripts : scripts
  const filtered = allScripts
    .filter(s => activeTab === 'system' ? s.type === 'system' : true)
    .filter(s => activePlatform === 'All' || s.platform === activePlatform)
    .filter(s => !search || (s.description || '').toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))

  const handleRun = async (script, profileIds, params) => {
    setRunDialogScript(null)
    const launchDelaySec = Math.max(1, Math.min(120, Number(params.launchDelaySec) || 3))
    for (let i = 0; i < profileIds.length; i++) {
      try {
        const profileParams = {
          ...params,
          ...(params.__profileFileParams?.[profileIds[i]] || {})
        }
        delete profileParams.__profileFileParams
        await window.electronAPI.runAutomationScript(profileIds[i], script.id, profileParams)
      } catch (e) {
        console.error('Run script failed:', e)
      }
      if (i < profileIds.length - 1) await new Promise(r => setTimeout(r, launchDelaySec * 1000))
    }
  }

  const handleStop = async (profileId) => {
    try {
      await window.electronAPI.stopAutomationScript(profileId)
    } catch (e) {
      console.error('Stop script failed:', e)
    }
  }

  const handleDeleteUserScript = async (id) => {
    try {
      await window.electronAPI.deleteUserScript(id)
      loadUserScripts()
    } catch (e) {
      console.error('Delete user script error:', e)
    }
  }

  const refreshScripts = () => {
    window.electronAPI.getAutomationScripts().then(setScripts).catch(() => {})
    loadUserScripts()
    window.electronAPI.getAutomationStatuses().then(setStatuses).catch(() => {})
  }

  return (
    <div className="automation-page">
      <div className="automation-page-header">
        <h1>AUTOMATION</h1>
        <div className="automation-header-actions">
          <button className="btn btn-primary btn-sm" onClick={onCreateScript} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', fontWeight: 600 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Script
          </button>
          <button className="btn btn-ghost btn-sm" onClick={refreshScripts} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <div className="search-wrapper">
            <span className="search-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input type="text" className="search-bar" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="auto-tabs">
        <button className={`auto-tab ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginRight: 6, verticalAlign: -2 }}>
            <rect x="4" y="8" width="16" height="12" rx="2"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/><line x1="12" y1="4" x2="12" y2="8"/><circle cx="12" cy="3" r="1.5"/>
          </svg>
          System's Scripts
        </button>
        <button className={`auto-tab ${activeTab === 'user' ? 'active' : ''}`} onClick={() => setActiveTab('user')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginRight: 6, verticalAlign: -2 }}>
            <circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
          </svg>
          Your Scripts
        </button>
      </div>

      <div className="auto-filters">
        {PLATFORM_FILTERS.map(p => (
          <button key={p} className={`chip ${activePlatform === p ? 'chip-active' : ''}`} onClick={() => setActivePlatform(p)}>
            {p}
          </button>
        ))}
      </div>

      <div className="auto-grid-wrapper">
        {activeTab === 'user' ? (
          filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" style={{ marginBottom: 12, opacity: 0.4 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                <p style={{ marginBottom: 12, fontSize: 13 }}>No custom scripts yet.</p>
                <button className="btn btn-primary btn-sm" onClick={onCreateScript} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', fontWeight: 600 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Create Your First Script
                </button>
              </div>
            </div>
          ) : (
            <UserScriptsTable scripts={filtered} onRun={setRunDialogScript} onEdit={onEditScript} onDelete={handleDeleteUserScript} />
          )
        ) : (
          filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No scripts found.</div>
          ) : (
            <div className="auto-grid">
              {filtered.map(script => (
                <ScriptCard key={script.id} script={script} onRun={setRunDialogScript} onEdit={onEditScript} onDelete={handleDeleteUserScript} />
              ))}
            </div>
          )
        )}
      </div>

      <StatusPanel statuses={statuses} scripts={scripts} onStop={handleStop} />

      {runDialogScript && (
        <RunDialog
          script={runDialogScript}
          profiles={profiles}
          onRun={handleRun}
          onClose={() => setRunDialogScript(null)}
        />
      )}
    </div>
  )
}

export default AutomationPage
