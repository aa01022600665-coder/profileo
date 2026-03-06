import React, { useState } from 'react'
import { auth } from '../firebase'
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'

function SettingsPage({ user, onLogout }) {
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [nameMsg, setNameMsg] = useState('')
  const [recentPassword, setRecentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSaveName = async () => {
    if (!displayName.trim()) return
    setSaving(true)
    setNameMsg('')
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() })
      setNameMsg('Name updated successfully')
    } catch (e) {
      setNameMsg('Failed to update name')
    }
    setSaving(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwMsg('')
    setPwError('')
    if (!recentPassword || !newPassword || !confirmPassword) { setPwError('Please fill in all fields'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    if (newPassword.length < 6) { setPwError('New password must be at least 6 characters'); return }
    setSaving(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, recentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPassword)
      setPwMsg('Password changed successfully')
      setRecentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setPwError('Recent password is incorrect')
      } else {
        setPwError(e.message || 'Failed to change password')
      }
    }
    setSaving(false)
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginRight: 8, verticalAlign: -3 }}>
          <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
          <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
        </svg>
        SETTINGS
      </div>
      <div className="settings-content">
        <div className="settings-account">
          <div className="np-section">
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="np-input" value={user?.email || ''} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label>Name</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" className="np-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Enter your name" style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={handleSaveName} disabled={saving} style={{ whiteSpace: 'nowrap' }}>
                  {saving ? '...' : 'Save'}
                </button>
              </div>
              {nameMsg && <span style={{ fontSize: 11, color: 'var(--success)', marginTop: 4, display: 'block' }}>{nameMsg}</span>}
            </div>
            <div className="form-group">
              <label>Plan</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Base - Monthly</span>
                <button className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 11 }}>
                  Upgrade plan <span style={{ marginLeft: 4 }}>{'\u2197'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="np-section" style={{ marginTop: 20 }}>
            <h3>CHANGE PASSWORD</h3>
            <p className="np-hint">Enter all the fields below if you want to change your password</p>
            {pwError && <div className="auth-error" style={{ marginBottom: 10 }}>{pwError}</div>}
            {pwMsg && <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '8px 12px', borderRadius: 6, marginBottom: 10, fontSize: 12 }}>{pwMsg}</div>}
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Recent password</label>
                <input type="password" className="np-input" placeholder="Enter your recent password here" value={recentPassword} onChange={e => setRecentPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label>New password</label>
                <input type="password" className="np-input" placeholder="Enter new password here" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Confirm new password</label>
                <input type="password" className="np-input" placeholder="Re-enter new password here" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 8 }}>
                {saving ? 'Changing...' : 'Change'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
