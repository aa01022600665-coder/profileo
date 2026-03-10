import React, { useState, useEffect, useCallback, useRef } from 'react'
import { auth, getBillingFromCloud, saveBillingToCloud, saveProfilesToCloud, getProfilesFromCloud, saveFoldersToCloud, getFoldersFromCloud, saveProxiesToCloud, getProxiesFromCloud, saveSessionToCloud, getSessionFromCloud } from './firebase'
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
  const [syncError, setSyncError] = useState(false)

  // Ref to block auto-login during registration verification
  const pendingVerifyRef = useRef(false)

  // Single-session enforcement
  const sessionIdRef = useRef(crypto.randomUUID())
  const sessionCheckRef = useRef(null)

  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (pendingVerifyRef.current) {
        // During registration verification, ignore auth state changes
        setAuthLoading(false)
        return
      }
      setUser(firebaseUser)
      // Notify main process about current user for server-side billing checks
      if (firebaseUser?.email) {
        window.electronAPI.setAuthUser(firebaseUser.email)
      } else {
        window.electronAPI.setAuthUser(null)
      }
      setAuthLoading(false)
    })
    return unsub
  }, [])

  // Register session on login + check every 15s if another device took over
  useEffect(() => {
    if (!user) {
      if (sessionCheckRef.current) clearInterval(sessionCheckRef.current)
      return
    }

    // Register this device's session
    saveSessionToCloud(user.email, sessionIdRef.current)

    // Check every 15 seconds if our session is still active
    sessionCheckRef.current = setInterval(async () => {
      try {
        const cloudSession = await getSessionFromCloud(user.email)
        if (cloudSession && cloudSession.sessionId !== sessionIdRef.current) {
          // Another device logged in — force logout
          console.log('[Session] Another device logged in, forcing logout')
          clearInterval(sessionCheckRef.current)
          await signOut(auth)
          setUser(null)
          setCurrentView('profiles')
          alert('Llogaria u hap në një pajisje tjetër. Ju jeni çkyçur automatikisht.')
        }
      } catch (e) {
        console.log('[Session] Check failed:', e.message)
      }
    }, 15000)

    return () => {
      if (sessionCheckRef.current) clearInterval(sessionCheckRef.current)
    }
  }, [user])

  const handleLogout = async () => {
    try {
      if (sessionCheckRef.current) clearInterval(sessionCheckRef.current)
      await signOut(auth)
      setUser(null)
      setCurrentView('profiles')
    } catch (e) {
      console.error('Logout failed:', e)
    }
  }

  // Cloud sync helper — awaits and tracks failures
  const syncProfilesToCloud = useCallback(async (profilesList) => {
    if (!user) return
    try {
      const ok = await saveProfilesToCloud(user.email, profilesList)
      if (!ok) setSyncError(true)
      else setSyncError(false)
    } catch {
      setSyncError(true)
    }
  }, [user])

  const syncFoldersToCloud = useCallback(async (foldersList) => {
    if (!user) return
    try { await saveFoldersToCloud(user.email, foldersList) } catch {}
  }, [user])

  const syncProxiesToCloudFn = useCallback(async (proxiesList) => {
    if (!user) return
    try { await saveProxiesToCloud(user.email, proxiesList) } catch {}
  }, [user])

  const loadProfiles = useCallback(async () => {
    const localProfiles = await window.electronAPI.getProfiles()

    if (user) {
      try {
        const cloudProfiles = await getProfilesFromCloud(user.email)

        if (localProfiles.length === 0 && cloudProfiles && cloudProfiles.length > 0) {
          // Local is empty, restore from cloud
          await window.electronAPI.replaceAllFromCloud(cloudProfiles)
          const restored = await window.electronAPI.getProfiles()
          setProfiles(restored)
          await syncProfilesToCloud(restored)
          return
        }

        if (cloudProfiles && cloudProfiles.length > 0 && localProfiles.length > 0) {
          // Both have data — compare timestamps to pick the newer one
          const cloudLatest = Math.max(...cloudProfiles.map(p => new Date(p.updatedAt || 0).getTime()))
          const localLatest = Math.max(...localProfiles.map(p => new Date(p.updatedAt || 0).getTime()))

          if (cloudLatest > localLatest) {
            // Cloud is newer (changed on another device) — restore from cloud
            await window.electronAPI.replaceAllFromCloud(cloudProfiles)
            const restored = await window.electronAPI.getProfiles()
            setProfiles(restored)
            return
          }
        }

        if (localProfiles.length > 0) {
          // Local is newer or same — sync to cloud
          await syncProfilesToCloud(localProfiles)
        }
      } catch (e) {
        console.log('[Sync] Profile sync failed:', e.message)
      }
    }

    setProfiles(localProfiles)
  }, [user, syncProfilesToCloud])

  const loadFolders = useCallback(async () => {
    const localFolders = await window.electronAPI.getFolders()
    if (user) {
      try {
        const cloudFolders = await getFoldersFromCloud(user.email)
        if (localFolders.length === 0 && cloudFolders && cloudFolders.length > 0) {
          for (const f of cloudFolders) {
            await window.electronAPI.createFolder(f)
          }
          const restored = await window.electronAPI.getFolders()
          setFolders(restored)
          await syncFoldersToCloud(restored)
          return
        }
        if (localFolders.length > 0) {
          await syncFoldersToCloud(localFolders)
        }
      } catch (e) {
        console.log('[Sync] Folder sync failed:', e.message)
      }
    }
    setFolders(localFolders)
  }, [user, syncFoldersToCloud])

  const loadProxies = useCallback(async () => {
    const localProxies = await window.electronAPI.getProxies()
    if (user) {
      try {
        const cloudProxies = await getProxiesFromCloud(user.email)
        if (localProxies.length === 0 && cloudProxies && cloudProxies.length > 0) {
          await window.electronAPI.addProxies(cloudProxies)
          const restored = await window.electronAPI.getProxies()
          setProxies(restored)
          await syncProxiesToCloudFn(restored)
          return
        }
        if (localProxies.length > 0) {
          await syncProxiesToCloudFn(localProxies)
        }
      } catch (e) {
        console.log('[Sync] Proxy sync failed:', e.message)
      }
    }
    setProxies(localProxies)
  }, [user, syncProxiesToCloudFn])

  const loadBillingPlan = useCallback(async () => {
    try {
      if (!user) { setBillingPlan(null); return }
      // 1. Load local and cloud plans
      const localPlan = await window.electronAPI.getBillingPlan(user.email)
      let cloudPlan = null
      try {
        cloudPlan = await getBillingFromCloud(user.email)
      } catch (cloudErr) {
        console.log('[Billing] Cloud fetch failed:', cloudErr.message)
      }

      // 2. Merge — always use the HIGHER profileLimit (admin may have increased it)
      let plan = localPlan || cloudPlan
      if (localPlan && cloudPlan) {
        plan = { ...localPlan }
        if ((cloudPlan.profileLimit || 0) > (localPlan.profileLimit || 0)) {
          plan.profileLimit = cloudPlan.profileLimit
        }
        // Use the latest expiration date
        if (new Date(cloudPlan.expirationDate || 0) > new Date(localPlan.expirationDate || 0)) {
          plan.expirationDate = cloudPlan.expirationDate
        }
      }

      if (plan) {
        const now = new Date()
        const exp = new Date(plan.expirationDate)
        plan.isActive = now < exp
        setBillingPlan(plan)
        // Save merged plan locally and to cloud
        await window.electronAPI.saveBillingPlan(user.email, plan).catch(() => {})
        saveBillingToCloud(user.email, plan).catch(() => {})
        return
      }
      setBillingPlan(null)
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

  // Re-check billing plan every 60s to catch expiration while app is open
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      if (billingPlan && billingPlan.expirationDate) {
        const now = new Date()
        const exp = new Date(billingPlan.expirationDate)
        if (now >= exp && billingPlan.isActive) {
          console.log('[Billing] Plan expired during session')
          setBillingPlan(prev => prev ? { ...prev, isActive: false } : null)
        }
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [user, billingPlan])

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
      const updated = await window.electronAPI.getProfiles()
      setProfiles(updated)
      await syncProfilesToCloud(updated)
      setCurrentView('profiles')
    } catch (e) { console.error('Create failed:', e) }
  }

  const handleCreateBatch = async (profilesArray) => {
    if (!isPlanActive() || getRemainingProfiles() < profilesArray.length) return
    try {
      await window.electronAPI.createProfilesBatch(profilesArray)
      const updated = await window.electronAPI.getProfiles()
      setProfiles(updated)
      await syncProfilesToCloud(updated)
    } catch (e) { console.error('Batch create failed:', e) }
  }

  const handleUpdate = async (id, profileData) => {
    try {
      await window.electronAPI.updateProfile(id, profileData)
      const updated = await window.electronAPI.getProfiles()
      setProfiles(updated)
      await syncProfilesToCloud(updated)
      setCurrentView('profiles')
      setEditingProfile(null)
    } catch (e) { console.error('Update failed:', e) }
  }

  const handleDelete = async (id) => {
    try {
      await window.electronAPI.deleteProfile(id)
      const updated = await window.electronAPI.getProfiles()
      setProfiles(updated)
      await syncProfilesToCloud(updated)
    } catch (e) { console.error('Delete failed:', e) }
  }

  const handleDeleteMultiple = async (ids) => {
    try {
      await window.electronAPI.deleteMultipleProfiles(ids)
      const updated = await window.electronAPI.getProfiles()
      setProfiles(updated)
      await syncProfilesToCloud(updated)
    } catch (e) { console.error('Delete multiple failed:', e) }
  }

  const handleDuplicate = async (id, count, options) => {
    if (!isPlanActive() || getRemainingProfiles() < count) return
    try {
      await window.electronAPI.duplicateProfile(id, count, options)
      const updated = await window.electronAPI.getProfiles()
      setProfiles(updated)
      await syncProfilesToCloud(updated)
    } catch (e) { console.error('Duplicate failed:', e) }
  }

  const handleLaunch = async (id) => {
    if (!isPlanActive()) return
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
      const updated = await window.electronAPI.getProfiles()
      setProfiles(updated)
      await syncProfilesToCloud(updated)
    } catch (e) { console.error('Quick launch failed:', e) }
  }

  const handleEdit = (profile) => {
    setEditingProfile(profile)
    setCurrentView('newProfile')
  }

  // Folder actions
  const handleCreateFolder = async (data) => {
    await window.electronAPI.createFolder(data)
    const updated = await window.electronAPI.getFolders()
    setFolders(updated)
    await syncFoldersToCloud(updated)
  }

  const handleDeleteFolder = async (id) => {
    await window.electronAPI.deleteFolder(id)
    const updated = await window.electronAPI.getFolders()
    setFolders(updated)
    await syncFoldersToCloud(updated)
    if (activeFolder === id) setActiveFolder('all')
  }

  // Proxy actions
  const handleAddProxies = async (data) => {
    await window.electronAPI.addProxies(data)
    const updated = await window.electronAPI.getProxies()
    setProxies(updated)
    await syncProxiesToCloudFn(updated)
  }

  const handleDeleteProxy = async (id) => {
    await window.electronAPI.deleteProxy(id)
    const updated = await window.electronAPI.getProxies()
    setProxies(updated)
    await syncProxiesToCloudFn(updated)
  }

  const handleDeleteProxies = async (ids) => {
    await window.electronAPI.deleteMultipleProxies(ids)
    const updated = await window.electronAPI.getProxies()
    setProxies(updated)
    await syncProxiesToCloudFn(updated)
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
