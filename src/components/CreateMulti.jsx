import React, { useState } from 'react'

const OS_OPTIONS = ['Windows','MacOS','Linux','Android','iOS']
const BROWSER_OPTIONS = ['Chrome','Brave','Opera','Edge','Yandex']
const TIMEZONES = [
  'Auto (based on IP)',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Toronto','America/Sao_Paulo','Europe/London','Europe/Paris',
  'Europe/Berlin','Europe/Rome','Europe/Madrid','Europe/Istanbul',
  'Asia/Tokyo','Asia/Shanghai','Asia/Seoul','Asia/Singapore','Asia/Dubai',
  'Asia/Kolkata','Australia/Sydney','Pacific/Auckland','Africa/Cairo'
]
const RESOLUTIONS = [
  '1920x1080','1366x768','1536x864','1440x900','1280x720',
  '1600x900','2560x1440','3840x2160'
]
const TABS = ['Overview','Proxy','Timezone','WebRTC','Geolocation','Advanced']

function CreateMulti({ folders, proxies, billingPlan, profileCount, onCreateBatch, onDone, onNavigateToBilling }) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [count, setCount] = useState(5)
  const [nameMode, setNameMode] = useState('single') // single, multi, random
  const [baseName, setBaseName] = useState('Profile')
  const [multiNames, setMultiNames] = useState('')
  const [folder, setFolder] = useState('')
  const [creating, setCreating] = useState(false)

  // Overview
  const [os, setOs] = useState('Windows')
  const [browser, setBrowser] = useState('Chrome')
  const [uaMode, setUaMode] = useState('General') // General, Custom, Random
  const [customUAs, setCustomUAs] = useState('')
  const [randomOSes, setRandomOSes] = useState(['Windows'])
  const [randomBrowsers, setRandomBrowsers] = useState(['Chrome'])

  // Proxy
  const [proxyType, setProxyType] = useState('Without Proxy')
  const [proxyList, setProxyList] = useState('')

  // Timezone
  const [timezone, setTimezone] = useState('Auto (based on IP)')

  // WebRTC
  const [webrtc, setWebrtc] = useState('Altered')

  // Geolocation
  const [geolocation, setGeolocation] = useState('Prompt')

  // Advanced
  const [language, setLanguage] = useState('en-US')
  const [resolution, setResolution] = useState('1920x1080')
  const [clearCache, setClearCache] = useState(true)
  const [restoreSession, setRestoreSession] = useState(true)
  const [startUrl, setStartUrl] = useState('')

  const toggleRandomOS = (os) => {
    setRandomOSes(prev => prev.includes(os) ? prev.filter(o => o !== os) : [...prev, os])
  }
  const toggleRandomBrowser = (br) => {
    setRandomBrowsers(prev => prev.includes(br) ? prev.filter(b => b !== br) : [...prev, br])
  }

  const getNames = () => {
    if (nameMode === 'multi') {
      return multiNames.split('\n').filter(n => n.trim()).slice(0, count)
    }
    if (nameMode === 'random') {
      return Array.from({ length: count }, (_, i) => `Profile ${Date.now()}_${i + 1}`)
    }
    return Array.from({ length: count }, (_, i) => `${baseName} ${i + 1}`)
  }

  const handleCreate = async () => {
    const maxAllowed = planActive ? remaining : 0
    const safeCount = Math.min(maxAllowed, Math.min(2500, Math.max(1, count)))
    if (safeCount < 1) return
    setCreating(true)
    const names = getNames()
    const proxyLines = proxyList.split('\n').map(l => l.trim()).filter(Boolean)
    const customUALines = customUAs.split('\n').map(l => l.trim()).filter(Boolean)
    const [w, h] = resolution.split('x').map(Number)

    const batch = []
    for (let i = 0; i < safeCount; i++) {
      const proxy = proxyLines.length > 0 ? proxyLines[i % proxyLines.length] : ''
      let userAgent = ''
      if (uaMode === 'Custom' && customUALines.length > 0) {
        userAgent = customUALines[i % customUALines.length]
      }

      const profileOs = uaMode === 'Random' && randomOSes.length > 0
        ? randomOSes[Math.floor(Math.random() * randomOSes.length)]
        : os
      const profileBrowser = uaMode === 'Random' && randomBrowsers.length > 0
        ? randomBrowsers[Math.floor(Math.random() * randomBrowsers.length)]
        : browser

      batch.push({
        name: names[i] || `Profile ${i + 1}`,
        folder,
        os: profileOs,
        browser: profileBrowser,
        userAgent,
        screenWidth: w || 1920,
        screenHeight: h || 1080,
        timezone: timezone === 'Auto (based on IP)' ? '' : timezone,
        language,
        proxyType,
        proxy: proxyType !== 'Without Proxy' ? proxy : '',
        notes: '',
        startUrl,
        webrtc,
        geolocation,
        clearCache,
        restoreSession,
      })
    }

    try {
      await onCreateBatch(batch)
    } catch (e) {
      console.error('Batch create failed:', e)
    }
    setCreating(false)
    if (onDone) onDone()
  }

  // Check plan limits
  const planActive = billingPlan && billingPlan.isActive
  const limitReached = planActive && profileCount >= billingPlan.profileLimit
  const remaining = planActive ? Math.max(0, billingPlan.profileLimit - profileCount) : 0
  const noPlan = !planActive
  const canCreate = planActive && !limitReached

  return (
    <div className="new-profile-page">
      <div className="np-header">
        <h1>CREATE MULTI PROFILES</h1>
        <div className="np-header-right">
          <div className="multi-count-box">
            <span className="count-label">Profiles:</span>
            <input type="number" className="np-count-input" min={1} max={remaining || 1} value={count} onChange={e => { const v = parseInt(e.target.value) || 1; setCount(Math.min(remaining || 1, Math.max(1, v))) }} />
          </div>
          <select className="np-folder-select" value={folder} onChange={e => setFolder(e.target.value)}>
            <option value="">Choose folder</option>
            {folders.filter(f => f.id !== 'all').map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button className="btn btn-create" onClick={handleCreate} disabled={creating || !canCreate}>
            {creating ? `Creating ${count} profiles...` : `++ Create ${count} Profiles`}
          </button>
          {noPlan && <span className="np-limit-warn">No active plan. <a onClick={onNavigateToBilling} style={{color:'var(--accent)',cursor:'pointer'}}>Subscribe</a></span>}
          {limitReached && <span className="np-limit-warn">Limit reached ({profileCount}/{billingPlan.profileLimit}). <a onClick={onNavigateToBilling} style={{color:'var(--accent)',cursor:'pointer'}}>Upgrade</a></span>}
        </div>
      </div>

      <div className="np-content">
        <div className="np-tabs">
          {TABS.map(tab => (
            <button key={tab} className={`np-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        <div className="np-body">
          {/* ─── OVERVIEW ─── */}
          {activeTab === 'Overview' && (
            <div className="tab-overview">
              {/* Profile Naming */}
              <section className="np-section">
                <h3>PROFILE NAMING</h3>
                <div className="ua-tabs" style={{ marginBottom: 12 }}>
                  {[
                    { id: 'single', label: 'Single Name' },
                    { id: 'multi', label: 'Multiple Names' },
                    { id: 'random', label: 'Random' }
                  ].map(mode => (
                    <button key={mode.id} className={`ua-tab ${nameMode === mode.id ? 'active' : ''}`} onClick={() => setNameMode(mode.id)}>
                      {mode.label}
                    </button>
                  ))}
                </div>
                {nameMode === 'single' && (
                  <>
                    <input type="text" className="np-input" placeholder="Base name (e.g., Profile)" value={baseName} onChange={e => setBaseName(e.target.value)} />
                    <p className="np-hint-sm">Profiles will be named: {baseName} 1, {baseName} 2, {baseName} 3...</p>
                  </>
                )}
                {nameMode === 'multi' && (
                  <>
                    <textarea className="np-textarea" placeholder={"Enter one name per line\n(must match the number of profiles)"} value={multiNames} onChange={e => setMultiNames(e.target.value)} rows={5} />
                    <p className="np-hint-sm">Enter exactly {count} names, one per line.</p>
                  </>
                )}
                {nameMode === 'random' && (
                  <p className="np-hint-sm">Profile names will be automatically generated with random identifiers.</p>
                )}
              </section>

              {/* OS & Browser */}
              <section className="np-section">
                <h3>USER AGENT MODE</h3>
                <div className="ua-tabs">
                  {['General','Custom','Random'].map(mode => (
                    <button key={mode} className={`ua-tab ${uaMode === mode ? 'active' : ''}`} onClick={() => setUaMode(mode)}>
                      {mode}
                    </button>
                  ))}
                </div>
              </section>

              {uaMode === 'General' && (
                <>
                  <section className="np-section">
                    <h3>OPERATING SYSTEM</h3>
                    <div className="chip-group">
                      {OS_OPTIONS.map(o => (
                        <button key={o} className={`chip ${os === o ? 'chip-active' : ''}`} onClick={() => setOs(o)}>
                          {o} {os === o && <span className="chip-check">&#x2713;</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="np-section">
                    <h3>BROWSER</h3>
                    <div className="chip-group">
                      {BROWSER_OPTIONS.map(b => (
                        <button key={b} className={`chip ${browser === b ? 'chip-active chip-browser' : ''}`} onClick={() => setBrowser(b)}>
                          {b} {browser === b && <span className="chip-dot">&#x25CF;</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {uaMode === 'Custom' && (
                <section className="np-section">
                  <h3>CUSTOM USER AGENTS</h3>
                  <textarea className="np-textarea" placeholder={"Enter one user agent per line\n(must match the number of profiles)"} value={customUAs} onChange={e => setCustomUAs(e.target.value)} rows={6} />
                  <p className="np-hint-sm">Enter {count} user agent strings, one per line. If fewer are provided, they will cycle.</p>
                </section>
              )}

              {uaMode === 'Random' && (
                <>
                  <section className="np-section">
                    <h3>SELECT OS PARAMETERS</h3>
                    <div className="chip-group">
                      {OS_OPTIONS.map(o => (
                        <button key={o} className={`chip ${randomOSes.includes(o) ? 'chip-active' : ''}`} onClick={() => toggleRandomOS(o)}>
                          {o} {randomOSes.includes(o) && <span className="chip-check">&#x2713;</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="np-section">
                    <h3>SELECT BROWSER PARAMETERS</h3>
                    <div className="chip-group">
                      {BROWSER_OPTIONS.map(b => (
                        <button key={b} className={`chip ${randomBrowsers.includes(b) ? 'chip-active chip-browser' : ''}`} onClick={() => toggleRandomBrowser(b)}>
                          {b} {randomBrowsers.includes(b) && <span className="chip-check">&#x2713;</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                  <p className="np-hint-sm">User agents will be randomly generated from the selected OS and browser combinations.</p>
                </>
              )}
            </div>
          )}

          {/* ─── PROXY ─── */}
          {activeTab === 'Proxy' && (
            <div className="tab-proxy">
              <section className="np-section">
                <h3>CONNECTION TYPE</h3>
                <div className="chip-group">
                  {['Without Proxy','HTTP','SOCKS4','SOCKS5'].map(type => (
                    <button key={type} className={`chip ${proxyType === type ? 'chip-active' : ''}`} onClick={() => setProxyType(type)}>
                      {type} {proxyType === type && <span className="chip-check">&#x2713;</span>}
                    </button>
                  ))}
                </div>
              </section>
              {proxyType !== 'Without Proxy' && (
                <section className="np-section">
                  <h3>PROXY LIST</h3>
                  <p className="np-hint">Enter proxies (one per line). Profiles will be assigned proxies in order, cycling if fewer proxies than profiles.</p>
                  <textarea className="np-textarea" placeholder={"host:port:username:password\nhost:port:username:password\n..."} value={proxyList} onChange={e => setProxyList(e.target.value)} rows={6} />
                </section>
              )}
            </div>
          )}

          {/* ─── TIMEZONE ─── */}
          {activeTab === 'Timezone' && (
            <div className="tab-timezone">
              <section className="np-section">
                <h3>TIMEZONE</h3>
                <p className="np-hint">All created profiles will use this timezone.</p>
                <select className="np-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </section>
            </div>
          )}

          {/* ─── WEBRTC ─── */}
          {activeTab === 'WebRTC' && (
            <div className="tab-webrtc">
              <section className="np-section">
                <h3>WEBRTC MODE</h3>
                <div className="chip-group">
                  {['Altered','Disabled','Real'].map(opt => (
                    <button key={opt} className={`chip ${webrtc === opt ? 'chip-active' : ''}`} onClick={() => setWebrtc(opt)}>
                      {opt} {webrtc === opt && <span className="chip-check">&#x2713;</span>}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ─── GEOLOCATION ─── */}
          {activeTab === 'Geolocation' && (
            <div className="tab-geo">
              <section className="np-section">
                <h3>GEOLOCATION PERMISSION</h3>
                <div className="chip-group">
                  {['Prompt','Allow','Block'].map(opt => (
                    <button key={opt} className={`chip ${geolocation === opt ? 'chip-active' : ''}`} onClick={() => setGeolocation(opt)}>
                      {opt} {geolocation === opt && <span className="chip-check">&#x2713;</span>}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ─── ADVANCED ─── */}
          {activeTab === 'Advanced' && (
            <div className="tab-advanced">
              <div className="adv-grid">
                <div className="adv-card">
                  <h4>NAVIGATOR</h4>
                  <div className="form-group">
                    <label>Language</label>
                    <select className="np-select" value={language} onChange={e => setLanguage(e.target.value)}>
                      {['en-US','en-GB','fr-FR','de-DE','es-ES','it-IT','pt-BR','ru-RU','ja-JP','ko-KR','zh-CN','ar-SA','tr-TR','sq-AL'].map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Screen Resolution</label>
                    <select className="np-select" value={resolution} onChange={e => setResolution(e.target.value)}>
                      {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="adv-card">
                  <h4>OTHERS</h4>
                  <label className="toggle-row"><span className={`toggle ${clearCache ? 'on' : ''}`} onClick={() => setClearCache(!clearCache)} /><span>Clear Cache after shutdown</span></label>
                  <label className="toggle-row"><span className={`toggle ${restoreSession ? 'on' : ''}`} onClick={() => setRestoreSession(!restoreSession)} /><span>Restore last session</span></label>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label>Start URL</label>
                    <input type="text" className="np-input" placeholder="https://example.com" value={startUrl} onChange={e => setStartUrl(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateMulti
