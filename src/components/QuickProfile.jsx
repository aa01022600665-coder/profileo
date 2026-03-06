import React, { useState } from 'react'

const OS_OPTIONS = ['Windows','MacOS','Linux','Android','iOS']
const BROWSER_OPTIONS = ['Chrome','Brave','Opera','Edge','Yandex']
const RESOLUTIONS = ['1920x1080','1366x768','1536x864','1440x900','1280x720','1600x900','2560x1440','3840x2160']
const LANGUAGES = ['en-US','en-GB','fr-FR','de-DE','es-ES','it-IT','pt-BR','ru-RU','ja-JP','ko-KR','zh-CN','ar-SA','tr-TR','sq-AL']

function QuickProfile({ billingPlan, profileCount, onLaunch, onNavigateToBilling }) {
  const [os, setOs] = useState('Windows')
  const [browser, setBrowser] = useState('Chrome')
  const [language, setLanguage] = useState('en-US')
  const [resolution, setResolution] = useState('1920x1080')
  const [proxyText, setProxyText] = useState('')
  const [startUrl, setStartUrl] = useState('')
  const [count, setCount] = useState(1)
  const [launching, setLaunching] = useState(false)

  const handleLaunch = async () => {
    setLaunching(true)
    const [w, h] = resolution.split('x').map(Number)

    // Parse proxy lines
    const proxyLines = proxyText.split('\n').map(l => l.trim()).filter(Boolean)

    for (let i = 0; i < count; i++) {
      const proxyLine = proxyLines.length > 0 ? proxyLines[i % proxyLines.length] : ''
      let proxyType = 'Without Proxy'
      let proxy = ''

      if (proxyLine) {
        if (proxyLine.startsWith('http://')) { proxyType = 'HTTP'; proxy = proxyLine.replace('http://', '') }
        else if (proxyLine.startsWith('socks4://')) { proxyType = 'SOCKS4'; proxy = proxyLine.replace('socks4://', '') }
        else if (proxyLine.startsWith('socks5://')) { proxyType = 'SOCKS5'; proxy = proxyLine.replace('socks5://', '') }
        else { proxyType = 'HTTP'; proxy = proxyLine }
      }

      await onLaunch({
        name: `Quick Profile ${i + 1}`,
        os,
        browser,
        userAgent: '',
        screenWidth: w,
        screenHeight: h,
        language,
        proxyType,
        proxy,
        timezone: '',
        startUrl,
        notes: 'Quick profile - data not saved permanently',
        webrtc: 'Altered',
        geolocation: 'Prompt',
      })
    }
    setLaunching(false)
  }

  // Check plan limits
  const planActive = billingPlan && billingPlan.isActive
  const limitReached = planActive && profileCount >= billingPlan.profileLimit
  const noPlan = !planActive
  const remaining = planActive ? Math.max(0, billingPlan.profileLimit - profileCount) : 0
  const canCreate = planActive && !limitReached

  return (
    <div className="new-profile-page">
      <div className="np-header">
        <h1>QUICK PROFILE</h1>
        <div className="np-header-right">
          <div className="multi-count-box">
            <span className="count-label">Profiles:</span>
            <input type="number" className="np-count-input" min={1} max={remaining || 1} value={count} onChange={e => { const v = parseInt(e.target.value) || 1; setCount(Math.min(remaining || 1, Math.max(1, v))) }} />
          </div>
          <button className="btn btn-start" onClick={handleLaunch} disabled={launching || !canCreate}>
            {launching ? 'Launching...' : `Start ${count} Profile${count > 1 ? 's' : ''}`}
          </button>
          {noPlan && <span className="np-limit-warn">No active plan. <a onClick={onNavigateToBilling} style={{color:'var(--accent)',cursor:'pointer'}}>Subscribe</a></span>}
          {limitReached && <span className="np-limit-warn">Limit reached ({profileCount}/{billingPlan.profileLimit}). <a onClick={onNavigateToBilling} style={{color:'var(--accent)',cursor:'pointer'}}>Upgrade</a></span>}
        </div>
      </div>

      <div className="quick-warn-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Quick profile data will NOT be saved permanently. To keep profiles, use "New Profile" instead.
      </div>

      <div className="quick-body">
        <div className="quick-grid">
          {/* Left Column */}
          <div className="quick-col">
            <div className="quick-card">
              <h3>OPERATING SYSTEM</h3>
              <div className="chip-group">
                {OS_OPTIONS.map(o => (
                  <button key={o} className={`chip ${os === o ? 'chip-active' : ''}`} onClick={() => setOs(o)}>
                    {o} {os === o && <span className="chip-check">&#x2713;</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="quick-card">
              <h3>BROWSER</h3>
              <div className="chip-group">
                {BROWSER_OPTIONS.map(b => (
                  <button key={b} className={`chip ${browser === b ? 'chip-active chip-browser' : ''}`} onClick={() => setBrowser(b)}>
                    {b} {browser === b && <span className="chip-dot">&#x25CF;</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="quick-card">
              <h3>
                PROXY LIST
                <span className="proxy-mode-badge">Optional</span>
              </h3>
              <textarea
                className="np-textarea"
                placeholder={"Enter proxies (one per line)\nFormats supported:\nhttp://host:port:user:pass\nsocks5://host:port:user:pass\nhost:port:user:pass"}
                value={proxyText}
                onChange={e => setProxyText(e.target.value)}
                rows={5}
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="quick-col">
            <div className="quick-card">
              <h3>LANGUAGE</h3>
              <select className="np-select" value={language} onChange={e => setLanguage(e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="quick-card">
              <h3>SCREEN RESOLUTION</h3>
              <select className="np-select" value={resolution} onChange={e => setResolution(e.target.value)}>
                {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="quick-card">
              <h3>START URL</h3>
              <input type="text" className="np-input" placeholder="https://example.com" value={startUrl} onChange={e => setStartUrl(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickProfile
