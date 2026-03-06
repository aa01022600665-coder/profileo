import React, { useState } from 'react'

function AddProxyDialog({ onSave, onClose }) {
  const [type, setType] = useState('HTTP')
  const [list, setList] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [expiration, setExpiration] = useState('')

  const handleAdd = () => {
    const lines = list.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    onSave({ type, list: lines, tags, notes, expiration })
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
              <th>Proxy Address</th>
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
                <td><span className="proxy-addr">{proxy.address}</span></td>
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
                <td colSpan={9} className="table-empty">
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
