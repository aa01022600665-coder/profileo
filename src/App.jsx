import React, { useState, useEffect, useCallback, useRef } from 'react'
import { auth, getBillingFromCloud, saveBillingToCloud } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import AuthPage from './components/AuthPage'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import ProfilesPage from './components/ProfilesPage'
import NewProfile from './components/NewProfile'
import CreateMulti from './components/CreateMulti'
import QuickProfile from './components/QuickProfile'
import ProxyManager from './components/ProxyManager'
import AutomationPage from './components/AutomationPage'
import ScriptBuilderPage from './components/ScriptBuilder/ScriptBuilderPage'
import BillingPage from './components/BillingPage'
import SettingsPage from './components/SettingsPage'
import './styles/app.css'

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [currentView, setCurrentView] = useState('profiles')
  const [profiles, setProfiles] = useState([])
  const [folders, setFolders] = useState([])
  const [proxies, setProxies] = useState([])
  const [activeFolder, setActiveFolder] = useState('all')
  const [editingProfile, setEditingProfile] = useState(null)
  const [editingScriptId, setEditingScriptId] = useState(null)
  const [autoTab, setAutoTab] = useState(null)
  const [billingPlan, setBillingPlan] = useState(null)

  // Ref to block auto-login during registration verification
  const pendingVerifyRef = useRef(false)

  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (pendingVerifyRef.current) {
        // During registration verification, ignore auth state changes
        setAuthLoading(false)
        return
      }
      setUser(firebaseUser)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setUser(null)
      setCurrentView('profiles')
    } catch (e) {
      console.error('Logout failed:', e)
    }
  }

  const loadProfiles = useCallback(async () => {
    const data = await window.electronAPI.getProfiles()
    setProfiles(data)
  }, [])

  const loadFolders = useCallback(async () => {
    const data = await window.electronAPI.getFolders()
    setFolders(data)
  }, [])

  const loadProxies = useCallback(async () => {
    const data = await window.electronAPI.getProxies()
    setProxies(data)
  }, [])

  const loadBillingPlan = useCallback(async () => {
    try {
      if (!user) { setBillingPlan(null); return }
      // 1. Check local plan first
      const localPlan = await window.electronAPI.getBillingPlan(user.email)
      if (localPlan) {
        const now = new Date()
        const exp = new Date(localPlan.expirationDate)
        localPlan.isActive = now < exp
        if (localPlan.isActive) {
          setBillingPlan(localPlan)
          // Sync to cloud in background (in case it wasn't synced before)
          saveBillingToCloud(user.email, localPlan).catch(() => {})
          return
        }
      }
      // 2. No local plan — fetch from Firestore cloud
      try {
        const cloudPlan = await getBillingFromCloud(user.email)
        if (cloudPlan) {
          const now = new Date()
          const exp = new Date(cloudPlan.expirationDate)
          cloudPlan.isActive = now < exp
          if (cloudPlan.isActive) {
            // Save to local storage so it works offline next time
            await window.electronAPI.saveBillingPlan(user.email, cloudPlan)
            setBillingPlan(cloudPlan)
            console.log('[Billing] Plan synced from cloud:', cloudPlan.planId)
            return
          }
        }
      } catch (cloudErr) {
        console.log('[Billing] Cloud sync failed:', cloudErr.message)
      }
      setBillingPlan(localPlan || null)
    } catch (e) { setBillingPlan(null) }
  }, [user])

  useEffect(() => {
    if (user) {
      loadProfiles()
      loadFolders()
      loadProxies()
      loadBillingPlan()
    }
  }, [user, loadProfiles, loadFolders, loadProxies, loadBillingPlan])

  // Listen for browser closed externally (user closes Chrome window)
  useEffect(() => {
    const cleanup = window.electronAPI.onProfileStopped(() => {
      loadProfiles()
    })
    return cleanup
  }, [loadProfiles])

  // Plan check helper
  const isPlanActive = () => billingPlan && billingPlan.isActive
  const getRemainingProfiles = () => {
    if (!billingPlan || !billingPlan.isActive) return 0
    return Math.max(0, billingPlan.profileLimit - profiles.length)
  }

  // Profile actions
  const handleCreate = async (profileData) => {
    if (!isPlanActive() || getRemainingProfiles() < 1) return
    try {
      await window.electronAPI.createProfile(profileData)
      await loadProfiles()
      setCurrentView('profiles')
    } catch (e) { console.error('Create failed:', e) }
  }

  const handleCreateBatch = async (profilesArray) => {
    if (!isPlanActive() || getRemainingProfiles() < profilesArray.length) return
    try {
      await window.electronAPI.createProfilesBatch(profilesArray)
      await loadProfiles()
    } catch (e) { console.error('Batch create failed:', e) }
  }

  const handleUpdate = async (id, profileData) => {
    try {
      await window.electronAPI.updateProfile(id, profileData)
      await loadProfiles()
      setCurrentView('profiles')
      setEditingProfile(null)
    } catch (e) { console.error('Update failed:', e) }
  }

  const handleDelete = async (id) => {
    try {
      await window.electronAPI.deleteProfile(id)
      await loadProfiles()
    } catch (e) { console.error('Delete failed:', e) }
  }

  const handleDeleteMultiple = async (ids) => {
    try {
      await window.electronAPI.deleteMultipleProfiles(ids)
      await loadProfiles()
    } catch (e) { console.error('Delete multiple failed:', e) }
  }

  const handleDuplicate = async (id, count, options) => {
    if (!isPlanActive() || getRemainingProfiles() < count) return
    try {
      await window.electronAPI.duplicateProfile(id, count, options)
      await loadProfiles()
    } catch (e) { console.error('Duplicate failed:', e) }
  }

  const handleLaunch = async (id) => {
    try {
      await window.electronAPI.launchProfile(id)
    } catch (e) { console.error('Launch failed:', e) }
    await loadProfiles()
  }

  const handleStop = async (id) => {
    try {
      await window.electronAPI.stopProfile(id)
    } catch (e) { console.error('Stop failed:', e) }
    await loadProfiles()
  }

  const handleQuickLaunch = async (profileData) => {
    if (!isPlanActive() || getRemainingProfiles() < 1) return
    try {
      const created = await window.electronAPI.createProfile(profileData)
      await window.electronAPI.launchProfile(created.id)
      await loadProfiles()
    } catch (e) { console.error('Quick launch failed:', e) }
  }

  const handleEdit = (profile) => {
    setEditingProfile(profile)
    setCurrentView('newProfile')
  }

  // Folder actions
  const handleCreateFolder = async (data) => {
    await window.electronAPI.createFolder(data)
    await loadFolders()
  }

  const handleDeleteFolder = async (id) => {
    await window.electronAPI.deleteFolder(id)
    await loadFolders()
    if (activeFolder === id) setActiveFolder('all')
  }

  // Proxy actions
  const handleAddProxies = async (data) => {
    await window.electronAPI.addProxies(data)
    await loadProxies()
  }

  const handleDeleteProxy = async (id) => {
    await window.electronAPI.deleteProxy(id)
    await loadProxies()
  }

  const handleDeleteProxies = async (ids) => {
    await window.electronAPI.deleteMultipleProxies(ids)
    await loadProxies()
  }

  const filteredProfiles = activeFolder === 'all'
    ? profiles
    : profiles.filter(p => p.folder === activeFolder)

  // Loading state
  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-loading">
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="auth-spinner">
            <circle cx="32" cy="32" r="5" fill="#61dafb"/>
            <ellipse cx="32" cy="32" rx="28" ry="11" stroke="#61dafb" strokeWidth="2.5" fill="none"/>
            <ellipse cx="32" cy="32" rx="28" ry="11" stroke="#61dafb" strokeWidth="2.5" fill="none" transform="rotate(60 32 32)"/>
            <ellipse cx="32" cy="32" rx="28" ry="11" stroke="#61dafb" strokeWidth="2.5" fill="none" transform="rotate(120 32 32)"/>
          </svg>
        </div>
      </div>
    )
  }

  // Not logged in → show auth page
  if (!user) {
    return <AuthPage onAuth={setUser} onPendingVerify={(val) => { pendingVerifyRef.current = val }} />
  }

  // Script Builder (full screen overlay)
  if (currentView === 'scriptBuilder') {
    return (
      <ScriptBuilderPage
        scriptId={editingScriptId}
        onClose={() => { setCurrentView('automation'); setEditingScriptId(null); setAutoTab('user') }}
      />
    )
  }

  // Logged in → show app
  return (
    <div className="app-container">
      <Sidebar currentView={currentView} onNavigate={(view) => { setCurrentView(view); setEditingProfile(null) }} />
      <div className="main-area">
        <TopBar user={user} onNavigate={(view) => { setCurrentView(view); setEditingProfile(null) }} onLogout={handleLogout} />
        <div className="content-area">
          {currentView === 'profiles' && (
            <ProfilesPage
              profiles={filteredProfiles}
              allProfiles={profiles}
              folders={folders}
              activeFolder={activeFolder}
              billingPlan={billingPlan}
              onFolderSelect={setActiveFolder}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDeleteMultiple={handleDeleteMultiple}
              onDuplicate={handleDuplicate}
              onLaunch={handleLaunch}
              onStop={handleStop}
              onCreateNew={() => { setEditingProfile(null); setCurrentView('newProfile') }}
              onCreateMulti={() => { setEditingProfile(null); setCurrentView('createMulti') }}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          )}
          {currentView === 'newProfile' && (
            <NewProfile
              profile={editingProfile}
              folders={folders}
              proxies={proxies}
              billingPlan={billingPlan}
              profileCount={profiles.length}
              onSave={editingProfile ? (data) => handleUpdate(editingProfile.id, data) : handleCreate}
              onCancel={() => { setCurrentView('profiles'); setEditingProfile(null) }}
              onNavigateToBilling={() => setCurrentView('billing')}
            />
          )}
          {currentView === 'createMulti' && (
            <CreateMulti
              folders={folders}
              proxies={proxies}
              billingPlan={billingPlan}
              profileCount={profiles.length}
              onCreateBatch={handleCreateBatch}
              onDone={() => setCurrentView('profiles')}
              onNavigateToBilling={() => setCurrentView('billing')}
            />
          )}
          {currentView === 'quick' && (
            <QuickProfile
              billingPlan={billingPlan}
              profileCount={profiles.length}
              onLaunch={handleQuickLaunch}
              onNavigateToBilling={() => setCurrentView('billing')}
            />
          )}
          {currentView === 'proxyManager' && (
            <ProxyManager
              proxies={proxies}
              profiles={profiles}
              onAddProxies={handleAddProxies}
              onDeleteProxy={handleDeleteProxy}
              onDeleteProxies={handleDeleteProxies}
            />
          )}
          {currentView === 'automation' && (
            <AutomationPage
              profiles={profiles}
              initialTab={autoTab}
              onCreateScript={() => { setEditingScriptId(null); setCurrentView('scriptBuilder') }}
              onEditScript={(id) => { setEditingScriptId(id); setCurrentView('scriptBuilder') }}
            />
          )}
          {currentView === 'billing' && (
            <BillingPage user={user} onPlanUpdated={loadBillingPlan} />
          )}
          {currentView === 'settings' && (
            <SettingsPage user={user} onLogout={handleLogout} />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
