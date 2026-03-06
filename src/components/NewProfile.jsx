import React, { useState } from 'react'

const TIMEZONES = [
  'Auto (based on IP)',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Toronto','America/Sao_Paulo','America/Mexico_City','America/Argentina/Buenos_Aires',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Rome','Europe/Madrid',
  'Europe/Istanbul','Europe/Moscow','Europe/Warsaw','Europe/Amsterdam',
  'Asia/Tokyo','Asia/Shanghai','Asia/Seoul','Asia/Singapore','Asia/Dubai',
  'Asia/Kolkata','Asia/Bangkok','Asia/Jakarta','Asia/Manila',
  'Australia/Sydney','Australia/Melbourne','Pacific/Auckland',
  'Africa/Cairo','Africa/Lagos','Africa/Johannesburg'
]
const LANGUAGES = [
  'en-US','en-GB','fr-FR','de-DE','es-ES','it-IT','pt-BR','pt-PT','nl-NL',
  'ru-RU','ja-JP','ko-KR','zh-CN','zh-TW','ar-SA','hi-IN','tr-TR','sq-AL',
  'pl-PL','cs-CZ','sv-SE','da-DK','fi-FI','nb-NO','el-GR','th-TH','vi-VN','id-ID'
]
const RESOLUTIONS = [
  '1920x1080','1366x768','1536x864','1440x900','1280x720',
  '1600x900','2560x1440','3840x2160','1280x1024','1024x768'
]
const OS_OPTIONS = ['Windows','MacOS','Linux','Android','iOS']
const BROWSER_OPTIONS = ['Chrome','Brave','Opera','Edge','Yandex']
const TABS = ['Overview','Proxy','Extensions','Timezone','WebRTC','Geolocation','Advanced','Cookies','Bookmarks']

function NewProfile({ profile, folders, proxies, billingPlan, profileCount, onSave, onCancel, onNavigateToBilling }) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [form, setForm] = useState({
    name: profile?.name || '',
    folder: profile?.folder || '',
    os: profile?.os || 'Windows',
    browser: profile?.browser || 'Chrome',
    userAgentMode: 'General',
    userAgent: profile?.userAgent || '',
    // Proxy
    proxyType: profile?.proxyType || 'Without Proxy',
    proxy: profile?.proxy || '',
    // Timezone
    timezone: profile?.timezone || 'Auto (based on IP)',
    // WebRTC
    webrtc: profile?.webrtc || 'Altered',
    webrtcCustomIp: '',
    // Geolocation
    geolocation: profile?.geolocation || 'Prompt',
    geoLat: profile?.geoLat || '',
    geoLng: profile?.geoLng || '',
    geoAccuracy: profile?.geoAccuracy || '100',
    // Advanced - Security
    browserDataSync: profile?.browserDataSync !== false,
    // Advanced - Hardware
    fakeCanvas: profile?.fakeCanvas || false,
    fakeAudio: profile?.fakeAudio !== false,
    fakeWebGLImage: profile?.fakeWebGLImage || false,
    fakeWebGLMetadata: profile?.fakeWebGLMetadata !== false,
    fakeClientRects: profile?.fakeClientRects || false,
    // Advanced - Others
    clearCache: profile?.clearCache !== false,
    restoreSession: profile?.restoreSession !== false,
    dontShowImages: profile?.dontShowImages || false,
    muteAudio: profile?.muteAudio || false,
    // Advanced - Navigator
    language: profile?.language || 'en-US',
    screenResolution: profile ? `${profile.screenWidth}x${profile.screenHeight}` : '1920x1080',
    // Advanced - Media Devices
    maskMediaDevices: profile?.maskMediaDevices !== false,
    mediaVideoInputs: profile?.mediaVideoInputs || 1,
    mediaAudioInputs: profile?.mediaAudioInputs || 1,
    mediaAudioOutputs: profile?.mediaAudioOutputs || 1,
    // Advanced - Notes, Tags, Start URL
    notes: profile?.notes || '',
    tags: profile?.tags || '',
    startUrl: profile?.startUrl || '',
    startUrls: profile?.startUrl ? profile.startUrl.split('\n') : [''],
    // Cookies & Bookmarks
    cookies: profile?.cookies || '',
    bookmarks: profile?.bookmarks || ''
  })

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = () => {
    const name = form.name.trim() || 'Untitled Profile'
    const [w, h] = form.screenResolution.split('x').map(Number)
    const startUrl = form.startUrls.filter(u => u.trim()).join('\n')
    onSave({
      name,
      folder: form.folder,
      os: form.os,
      browser: form.browser,
      userAgent: form.userAgentMode === 'Custom' ? form.userAgent : '',
      screenWidth: w || 1920,
      screenHeight: h || 1080,
      timezone: form.timezone === 'Auto (based on IP)' ? '' : form.timezone,
      language: form.language,
      proxyType: form.proxyType,
      proxy: form.proxyType !== 'Without Proxy' ? form.proxy : '',
      notes: form.notes,
      tags: form.tags,
      startUrl,
      webrtc: form.webrtc,
      geolocation: form.geolocation,
      geoLat: form.geoLat,
      geoLng: form.geoLng,
      geoAccuracy: form.geoAccuracy,
      browserDataSync: form.browserDataSync,
      fakeCanvas: form.fakeCanvas,
      fakeAudio: form.fakeAudio,
      fakeWebGLImage: form.fakeWebGLImage,
      fakeWebGLMetadata: form.fakeWebGLMetadata,
      fakeClientRects: form.fakeClientRects,
      maskMediaDevices: form.maskMediaDevices,
      mediaVideoInputs: form.mediaVideoInputs,
      mediaAudioInputs: form.mediaAudioInputs,
      mediaAudioOutputs: form.mediaAudioOutputs,
      clearCache: form.clearCache,
      restoreSession: form.restoreSession,
      dontShowImages: form.dontShowImages,
      muteAudio: form.muteAudio,
      cookies: form.cookies,
      bookmarks: form.bookmarks,
    })
  }

  const addStartUrl = () => set('startUrls', [...form.startUrls, ''])
  const removeStartUrl = (i) => set('startUrls', form.startUrls.filter((_, idx) => idx !== i))
  const updateStartUrl = (i, val) => set('startUrls', form.startUrls.map((u, idx) => idx === i ? val : u))

  // Check plan limits (allow editing existing profiles always)
  const planActive = billingPlan && billingPlan.isActive
  const limitReached = !profile && planActive && profileCount >= billingPlan.profileLimit
  const noPlan = !profile && !planActive
  const canCreate = !profile ? (planActive && !limitReached) : true

  return (
    <div className="new-profile-page">
      {/* Header */}
      <div className="np-header">
        <h1>{profile ? 'EDIT PROFILE' : 'NEW PROFILE'}</h1>
        <div className="np-header-right">
          <input
            type="text"
            className="np-name-input"
            placeholder="Enter profile name here..."
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
          <select className="np-folder-select" value={form.folder} onChange={e => set('folder', e.target.value)}>
            <option value="">Choose folder</option>
            {folders.filter(f => f.id !== 'all').map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button className="btn btn-create" onClick={handleSave} disabled={!canCreate}>
            {profile ? 'Save Changes' : '+ Create'}
          </button>
          {onCancel && <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
          {noPlan && <span className="np-limit-warn">No active plan. <a onClick={onNavigateToBilling} style={{color:'var(--accent)',cursor:'pointer'}}>Subscribe</a></span>}
          {limitReached && <span className="np-limit-warn">Limit reached ({profileCount}/{billingPlan.profileLimit}). <a onClick={onNavigateToBilling} style={{color:'var(--accent)',cursor:'pointer'}}>Upgrade</a></span>}
        </div>
      </div>

      <div className="np-content">
        {/* Tab Sidebar */}
        <div className="np-tabs">
          {TABS.map(tab => (
            <button key={tab} className={`np-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="np-body">
          {/* ─── OVERVIEW ─── */}
          {activeTab === 'Overview' && (
            <div className="tab-overview">
              <section className="np-section">
                <h3>OPERATING SYSTEM (OS)</h3>
                <p className="np-hint">It is recommended to use the same operating system of the machine for the best performance.</p>
                <div className="chip-group">
                  {OS_OPTIONS.map(os => (
                    <button key={os} className={`chip ${form.os === os ? 'chip-active' : ''}`} onClick={() => set('os', os)}>
                      {os} {form.os === os && <span className="chip-check">&#x2713;</span>}
                    </button>
                  ))}
                </div>
              </section>

              <section className="np-section">
                <h3>BROWSER</h3>
                <div className="chip-group">
                  {BROWSER_OPTIONS.map(br => (
                    <button key={br} className={`chip ${form.browser === br ? 'chip-active chip-browser' : ''}`} onClick={() => set('browser', br)}>
                      {br} {form.browser === br && <span className="chip-dot">&#x25CF;</span>}
                    </button>
                  ))}
                </div>
              </section>

              <section className="np-section">
                <h3>USER AGENTS</h3>
                <div className="ua-tabs">
                  {['General','Custom','Random'].map(mode => (
                    <button key={mode} className={`ua-tab ${form.userAgentMode === mode ? 'active' : ''}`} onClick={() => set('userAgentMode', mode)}>
                      {mode}
                    </button>
                  ))}
                </div>
                {form.userAgentMode === 'General' && (
                  <p className="np-hint-sm">A user agent will be automatically generated based on your OS and browser selection.</p>
                )}
                {form.userAgentMode === 'Custom' && (
                  <textarea className="np-textarea" placeholder="Enter custom user agent string" value={form.userAgent} onChange={e => set('userAgent', e.target.value)} rows={4} />
                )}
                {form.userAgentMode === 'Random' && (
                  <p className="np-hint-sm">A random user agent will be generated based on your selected OS and browser parameters.</p>
                )}
              </section>
            </div>
          )}

          {/* ─── PROXY ─── */}
          {activeTab === 'Proxy' && (
            <div className="tab-proxy">
              <section className="np-section">
                <h3>CONNECTION TYPE</h3>
                <div className="proxy-type-grid">
                  {['Without Proxy','HTTP','SOCKS4','SOCKS5'].map(type => (
                    <button key={type} className={`chip ${form.proxyType === type ? 'chip-active' : ''}`} onClick={() => set('proxyType', type)}>
                      {type} {form.proxyType === type && <span className="chip-check">&#x2713;</span>}
                    </button>
                  ))}
                </div>
              </section>
              {form.proxyType !== 'Without Proxy' && (
                <section className="np-section">
                  <h3>PROXY ADDRESS</h3>
                  <input
                    type="text"
                    className="np-input"
                    placeholder="host:port:username:password"
                    value={form.proxy}
                    onChange={e => set('proxy', e.target.value)}
                  />
                  <p className="np-hint-sm">Format: host:port or host:port:username:password</p>

                  {proxies && proxies.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h3>OR SELECT FROM PROXY MANAGER</h3>
                      <select className="np-select" value={form.proxy} onChange={e => set('proxy', e.target.value)}>
                        <option value="">Select a proxy...</option>
                        {proxies.map(p => (
                          <option key={p.id} value={p.address}>[{p.type}] {p.address}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </section>
              )}
              {form.proxyType === 'Without Proxy' && (
                <p className="np-hint" style={{ marginTop: 12 }}>Your device's real IP address will be used.</p>
              )}
            </div>
          )}

          {/* ─── EXTENSIONS ─── */}
          {activeTab === 'Extensions' && (
            <div className="tab-extensions">
              <section className="np-section">
                <h3>EXTENSIONS</h3>
                <p className="np-hint">Upload browser extensions in CRX or ZIP format.</p>
                <div className="drop-zone">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p style={{ marginTop: 8 }}>Drag and drop .crx / .zip files or click to upload</p>
                </div>
              </section>
              <section className="np-section">
                <h3>ADD FROM CHROME WEB STORE</h3>
                <div className="input-with-btn">
                  <input type="text" className="np-input" placeholder="Paste Chrome Web Store extension URL..." />
                  <button className="btn btn-primary">Add</button>
                </div>
              </section>
            </div>
          )}

          {/* ─── TIMEZONE ─── */}
          {activeTab === 'Timezone' && (
            <div className="tab-timezone">
              <section className="np-section">
                <h3>TIMEZONE</h3>
                <p className="np-hint">By default, timezone auto-adjusts based on the proxy location. Override manually if needed.</p>
                <select className="np-select" value={form.timezone} onChange={e => set('timezone', e.target.value)}>
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
                  {[
                    { id: 'Altered', desc: 'Adjusts WebRTC IP to match the proxy IP' },
                    { id: 'Disabled', desc: 'Recommended for rotating proxies' },
                    { id: 'Real', desc: 'Uses your actual current IP' }
                  ].map(opt => (
                    <button key={opt.id} className={`chip chip-lg ${form.webrtc === opt.id ? 'chip-active' : ''}`} onClick={() => set('webrtc', opt.id)}>
                      <div>
                        <strong>{opt.id}</strong> {form.webrtc === opt.id && <span className="chip-check">&#x2713;</span>}
                        <p className="chip-desc">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              {form.webrtc === 'Altered' && (
                <section className="np-section">
                  <h3>CUSTOM IP (OPTIONAL)</h3>
                  <input type="text" className="np-input" placeholder="Leave empty to use proxy IP automatically" value={form.webrtcCustomIp} onChange={e => set('webrtcCustomIp', e.target.value)} />
                </section>
              )}
            </div>
          )}

          {/* ─── GEOLOCATION ─── */}
          {activeTab === 'Geolocation' && (
            <div className="tab-geo">
              <section className="np-section">
                <h3>GEOLOCATION PERMISSION</h3>
                <div className="chip-group">
                  {[
                    { id: 'Prompt', desc: 'Requires manual consent each visit' },
                    { id: 'Allow', desc: 'Automatically grants geolocation to all sites' },
                    { id: 'Block', desc: 'Automatically denies all geolocation requests' }
                  ].map(opt => (
                    <button key={opt.id} className={`chip chip-lg ${form.geolocation === opt.id ? 'chip-active' : ''}`} onClick={() => set('geolocation', opt.id)}>
                      <div>
                        <strong>{opt.id}</strong> {form.geolocation === opt.id && <span className="chip-check">&#x2713;</span>}
                        <p className="chip-desc">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              {form.geolocation === 'Allow' && (
                <section className="np-section">
                  <h3>COORDINATES</h3>
                  <div className="geo-grid">
                    <div className="form-group">
                      <label>Latitude</label>
                      <input type="text" className="np-input" placeholder="e.g. 40.7128" value={form.geoLat} onChange={e => set('geoLat', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Longitude</label>
                      <input type="text" className="np-input" placeholder="e.g. -74.0060" value={form.geoLng} onChange={e => set('geoLng', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Accuracy (meters)</label>
                      <input type="text" className="np-input" placeholder="100" value={form.geoAccuracy} onChange={e => set('geoAccuracy', e.target.value)} />
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ─── ADVANCED ─── */}
          {activeTab === 'Advanced' && (
            <div className="tab-advanced">
              <div className="adv-grid">
                {/* Security */}
                <div className="adv-card">
                  <h4>SECURITY</h4>
                  <label className="toggle-row">
                    <span className={`toggle ${form.browserDataSync ? 'on' : ''}`} onClick={() => set('browserDataSync', !form.browserDataSync)} />
                    <span>Browser Data Synchronization to the Cloud</span>
                  </label>
                </div>

                {/* Navigator */}
                <div className="adv-card">
                  <h4>NAVIGATOR</h4>
                  <div className="form-group">
                    <label>Language</label>
                    <select className="np-select" value={form.language} onChange={e => set('language', e.target.value)}>
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Screen Resolution</label>
                    <select className="np-select" value={form.screenResolution} onChange={e => set('screenResolution', e.target.value)}>
                      {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                {/* Hardware */}
                <div className="adv-card">
                  <h4>HARDWARE</h4>
                  <label className="toggle-row"><span className={`toggle ${form.fakeCanvas ? 'on' : ''}`} onClick={() => set('fakeCanvas', !form.fakeCanvas)} /><span>Mask Canvas</span></label>
                  <label className="toggle-row"><span className={`toggle ${form.fakeAudio ? 'on' : ''}`} onClick={() => set('fakeAudio', !form.fakeAudio)} /><span>Audio Context</span></label>
                  <label className="toggle-row"><span className={`toggle ${form.fakeWebGLImage ? 'on' : ''}`} onClick={() => set('fakeWebGLImage', !form.fakeWebGLImage)} /><span>WebGL Image</span></label>
                  <label className="toggle-row"><span className={`toggle ${form.fakeWebGLMetadata ? 'on' : ''}`} onClick={() => set('fakeWebGLMetadata', !form.fakeWebGLMetadata)} /><span>WebGL Metadata</span></label>
                  <label className="toggle-row"><span className={`toggle ${form.fakeClientRects ? 'on' : ''}`} onClick={() => set('fakeClientRects', !form.fakeClientRects)} /><span>Client Rects</span></label>
                </div>

                {/* Others */}
                <div className="adv-card">
                  <h4>OTHERS</h4>
                  <label className="toggle-row"><span className={`toggle ${form.clearCache ? 'on' : ''}`} onClick={() => set('clearCache', !form.clearCache)} /><span>Clear Cache after browser shutdown</span></label>
                  <label className="toggle-row"><span className={`toggle ${form.restoreSession ? 'on' : ''}`} onClick={() => set('restoreSession', !form.restoreSession)} /><span>Restore last Browser session</span></label>
                  <label className="toggle-row"><span className={`toggle ${form.dontShowImages ? 'on' : ''}`} onClick={() => set('dontShowImages', !form.dontShowImages)} /><span>Don't allow sites to show images</span></label>
                  <label className="toggle-row"><span className={`toggle ${form.muteAudio ? 'on' : ''}`} onClick={() => set('muteAudio', !form.muteAudio)} /><span>Mute Audio</span></label>
                </div>

                {/* Notes */}
                <div className="adv-card">
                  <h4>NOTES</h4>
                  <textarea className="np-textarea" placeholder="Enter profile notes..." value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
                  <div className="form-group" style={{ marginTop: 10 }}>
                    <label>Tags</label>
                    <input type="text" className="np-input" placeholder="Add tags (comma separated)" value={form.tags} onChange={e => set('tags', e.target.value)} />
                  </div>
                </div>

                {/* Start URL */}
                <div className="adv-card">
                  <h4>START URL</h4>
                  {form.startUrls.map((url, i) => (
                    <div key={i} className="start-url-row">
                      <input type="text" className="np-input" placeholder="https://example.com" value={url} onChange={e => updateStartUrl(i, e.target.value)} />
                      {form.startUrls.length > 1 && (
                        <button className="btn-icon-sm btn-danger-icon" onClick={() => removeStartUrl(i)}>&times;</button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-sm btn-ghost" onClick={addStartUrl} style={{ marginTop: 6 }}>+ Add URL</button>
                </div>

                {/* Mask Media Devices */}
                <div className="adv-card">
                  <h4>MASK MEDIA DEVICES</h4>
                  <label className="toggle-row"><span className={`toggle ${form.maskMediaDevices ? 'on' : ''}`} onClick={() => set('maskMediaDevices', !form.maskMediaDevices)} /><span>Enable Device Masking</span></label>
                  {form.maskMediaDevices && (
                    <div className="media-sliders">
                      <div className="form-group">
                        <label>Video Inputs (Cameras): {form.mediaVideoInputs}</label>
                        <input type="range" min="0" max="5" value={form.mediaVideoInputs} onChange={e => set('mediaVideoInputs', parseInt(e.target.value))} className="slider" />
                      </div>
                      <div className="form-group">
                        <label>Audio Inputs (Microphones): {form.mediaAudioInputs}</label>
                        <input type="range" min="0" max="5" value={form.mediaAudioInputs} onChange={e => set('mediaAudioInputs', parseInt(e.target.value))} className="slider" />
                      </div>
                      <div className="form-group">
                        <label>Audio Outputs (Speakers): {form.mediaAudioOutputs}</label>
                        <input type="range" min="0" max="5" value={form.mediaAudioOutputs} onChange={e => set('mediaAudioOutputs', parseInt(e.target.value))} className="slider" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── COOKIES ─── */}
          {activeTab === 'Cookies' && (
            <div className="tab-cookies">
              <section className="np-section">
                <h3>IMPORT COOKIES</h3>
                <p className="np-hint">Cookies are supported in JSON format. Drag and drop a file or paste directly.</p>
                <div className="drop-zone">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p style={{ marginTop: 8 }}>Drag and drop cookie file from computer</p>
                </div>
              </section>
              <section className="np-section">
                <h3>OR PASTE COOKIES JSON</h3>
                <textarea className="np-textarea" placeholder='[{"name":"session","value":"abc123","domain":".example.com"}]' value={form.cookies} onChange={e => set('cookies', e.target.value)} rows={8} />
              </section>
            </div>
          )}

          {/* ─── BOOKMARKS ─── */}
          {activeTab === 'Bookmarks' && (
            <div className="tab-bookmarks">
              <section className="np-section">
                <h3>IMPORT BOOKMARKS</h3>
                <p className="np-hint">Bookmarks are supported in HTML format.</p>
                <div className="drop-zone">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p style={{ marginTop: 8 }}>Drag and drop HTML bookmark file</p>
                </div>
              </section>
              <section className="np-section">
                <h3>OR ENTER BOOKMARKS</h3>
                <p className="np-hint-sm">Supported formats: Folder::Name::URL | Name::URL | URL (one per line)</p>
                <textarea className="np-textarea" placeholder={"Folder::Name::URL\nName::URL\nhttps://example.com"} value={form.bookmarks} onChange={e => set('bookmarks', e.target.value)} rows={8} />
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NewProfile
