import React, { useState } from 'react'

const PROXY_NETWORK_TYPES = ['', 'Residential', 'Datacenter', 'Mobile', 'ISP']
const COUNTRY_OPTIONS = [
  ['', 'Auto detect'],
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['CA', 'Canada'],
  ['JP', 'Japan'],
  ['NL', 'Netherlands'],
  ['IT', 'Italy'],
  ['ES', 'Spain'],
  ['BR', 'Brazil'],
  ['MX', 'Mexico'],
  ['TR', 'Turkey'],
  ['RU', 'Russia'],
  ['PL', 'Poland'],
  ['CN', 'China'],
  ['KR', 'South Korea'],
  ['SG', 'Singapore'],
  ['AE', 'United Arab Emirates'],
  ['IN', 'India'],
  ['AU', 'Australia'],
  ['AL', 'Albania'],
  ['XK', 'Kosovo']
]

function countryFlag(countryCode) {
  const code = String(countryCode || '').toUpperCase()
  if (code === 'XK') return String.fromCodePoint(0x1f1fd, 0x1f1f0)
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return code
    .split('')
    .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join('')
}

function AlbaniaFlagIcon() {
  return (
    <svg className="flag-svg flag-albania" width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
      <rect width="22" height="16" rx="3" fill="#e41e20"/>
      <path d="M11 3.1c-.55.92-.95 1.53-1.86 1.92-.6.25-1.34.2-2.05.05.36.53.83.9 1.42 1.08-.78.22-1.49.1-2.16-.24.2.66.7 1.15 1.48 1.45-.82.32-1.43.9-1.85 1.74.86-.28 1.65-.29 2.38-.02-.45.42-.76.98-.91 1.66.73-.45 1.47-.6 2.22-.45-.13.53-.08 1.08.16 1.65.43-.49.82-.84 1.17-1.04.35.2.74.55 1.17 1.04.24-.57.29-1.12.16-1.65.75-.15 1.49 0 2.22.45-.15-.68-.46-1.24-.91-1.66.73-.27 1.52-.26 2.38.02-.42-.84-1.03-1.42-1.85-1.74.78-.3 1.28-.79 1.48-1.45-.67.34-1.38.46-2.16.24.59-.18 1.06-.55 1.42-1.08-.71.15-1.45.2-2.05-.05-.91-.39-1.31-1-1.86-1.92z" fill="#111827"/>
      <path d="M11 4.25l.52 1.42 1.46.15-1.13.96.33 1.48L11 7.48l-1.18.78.33-1.48-1.13-.96 1.46-.15L11 4.25z" fill="#111827"/>
    </svg>
  )
}

function CountryFlagIcon({ countryCode }) {
  const code = String(countryCode || '').toUpperCase()
  if (code === 'AL') return <AlbaniaFlagIcon />
  return <span className="flag-emoji" aria-hidden="true">{countryFlag(code)}</span>
}

function AddProxyDialog({ onSave, onClose }) {
  const [type, setType] = useState('HTTP')
  const [networkType, setNetworkType] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [list, setList] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [expiration, setExpiration] = useState('')

  const handleAdd = () => {
    const lines = list.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    const selectedCountry = COUNTRY_OPTIONS.find(([code]) => code === countryCode)
    onSave({
      type,
      networkType,
      countryCode,
      countryName: selectedCountry && countryCode ? selectedCountry[1] : '',
      list: lines,
      tags,
      notes,
      expiration
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Proxies</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Proxy Connection Type</label>
            <select className="np-select" value={type} onChange={e => setType(e.target.value)}>
              <option>HTTP</option>
              <option>SOCKS4</option>
              <option>SOCKS5</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Proxy Network</label>
              <select className="np-select" value={networkType} onChange={e => setNetworkType(e.target.value)}>
                {PROXY_NETWORK_TYPES.map(option => (
                  <option key={option || 'auto'} value={option}>{option || 'Auto detect'}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Location</label>
              <select className="np-select" value={countryCode} onChange={e => setCountryCode(e.target.value)}>
                {COUNTRY_OPTIONS.map(([code, name]) => (
                  <option key={code || 'auto'} value={code}>{code ? `${countryFlag(code)} ${name}` : name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Proxy List</label>
            <textarea className="np-textarea" placeholder={"IP:Port:Username:Password\n(one proxy per line)"} value={list} onChange={e => setList(e.target.value)} rows={6} />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Tags</label>
              <input type="text" className="np-input" placeholder="e.g., US, Premium" value={tags} onChange={e => setTags(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Expiration Date</label>
              <input type="date" className="np-input" value={expiration} onChange={e => setExpiration(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input type="text" className="np-input" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd}>Add Proxies</button>
        </div>
      </div>
    </div>
  )
}

function ProxyManager({ proxies, profiles, onAddProxies, onDeleteProxy, onDeleteProxies }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filtered = proxies.filter(p =>
    p.address.toLowerCase().includes(search.toLowerCase()) ||
    (p.tags || '').toLowerCase().includes(search.toLowerCase())
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
    if (!window.confirm(`Delete ${selected.size} selected proxy(ies)?`)) return
    onDeleteProxies([...selected])
    setSelected(new Set())
  }

  const getProxyProfileCount = (address) => {
    return profiles.filter(p => p.proxy === address).length
  }

  return (
    <div className="proxy-page">
      <div className="proxy-page-header">
        <h1>PROXY MANAGER</h1>
        <div className="proxy-header-actions">
          <button className="btn btn-primary" onClick={() => setShowAddDialog(true)}>+ Add Proxy</button>
          {selected.size > 0 && (
            <button className="btn btn-sm btn-danger" onClick={handleBulkDelete}>Delete ({selected.size})</button>
          )}
        </div>
      </div>

      <div className="proxy-toolbar">
        <div className="proxy-toolbar-left">
          <span className="toolbar-label">{filtered.length} prox{filtered.length !== 1 ? 'ies' : 'y'}</span>
        </div>
        <div className="proxy-toolbar-right">
          <div className="search-wrapper">
            <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" className="search-bar" placeholder="Search proxies..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="proxy-table-wrapper">
        <table className="profile-table proxy-table">
          <thead>
            <tr>
              <th className="col-check"><input type="checkbox" onChange={selectAll} checked={selected.size === filtered.length && filtered.length > 0} /></th>
              <th className="col-num">#</th>
              <th>Type</th>
              <th>Network</th>
              <th>Proxy Address</th>
              <th>Location</th>
              <th>Profiles</th>
              <th>Status</th>
              <th>Tags</th>
              <th>Expiration</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((proxy, i) => (
              <tr key={proxy.id} className={selected.has(proxy.id) ? 'row-selected' : ''}>
                <td className="col-check"><input type="checkbox" checked={selected.has(proxy.id)} onChange={() => toggleSelect(proxy.id)} /></td>
                <td className="col-num">{i + 1}</td>
                <td><span className="proxy-type-badge">{proxy.type}</span></td>
                <td>{proxy.networkType ? <span className="proxy-type-badge">{proxy.networkType}</span> : '-'}</td>
                <td><span className="proxy-addr">{proxy.address}</span></td>
                <td>{proxy.countryCode ? <span className="location-cell"><span className="location-flag"><CountryFlagIcon countryCode={proxy.countryCode} /></span><span className="location-name">{proxy.countryName || proxy.countryCode}</span></span> : '-'}</td>
                <td><span className="proxy-profile-count">{getProxyProfileCount(proxy.address)}</span></td>
                <td><span className={`proxy-status-dot status-${proxy.status}`}>{proxy.status}</span></td>
                <td>{proxy.tags ? <span className="proxy-tag">{proxy.tags}</span> : '-'}</td>
                <td className="proxy-exp">{proxy.expiration || '-'}</td>
                <td>
                  <button className="more-btn more-delete" onClick={() => { if (window.confirm('Delete this proxy?')) onDeleteProxy(proxy.id) }} title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="table-empty">
                  <div className="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                    <p>No proxies added</p>
                    <button className="btn btn-primary" onClick={() => setShowAddDialog(true)}>+ Add Proxy</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddDialog && <AddProxyDialog onSave={onAddProxies} onClose={() => setShowAddDialog(false)} />}
    </div>
  )
}

export default ProxyManager
