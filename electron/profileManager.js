import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import puppeteer from 'puppeteer-core'

export class ProfileManager {
  constructor({ dataDir, profilesDir }) {
    this.dataDir = dataDir
    this.profilesDir = profilesDir
    this.dataFile = path.join(this.dataDir, 'profiles.json')
    this.foldersFile = path.join(this.dataDir, 'folders.json')
    this.proxiesFile = path.join(this.dataDir, 'proxies.json')
    this.runningBrowsers = new Map()

    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true })
    if (!fs.existsSync(this.profilesDir)) fs.mkdirSync(this.profilesDir, { recursive: true })
    if (!fs.existsSync(this.dataFile)) fs.writeFileSync(this.dataFile, '[]')
    if (!fs.existsSync(this.foldersFile)) fs.writeFileSync(this.foldersFile, JSON.stringify([
      { id: 'all', name: 'All Profiles', color: '#ffffff', isDefault: true }
    ]))
    if (!fs.existsSync(this.proxiesFile)) fs.writeFileSync(this.proxiesFile, '[]')
  }

  // ─── Profiles ───
  _readProfiles() {
    try { return JSON.parse(fs.readFileSync(this.dataFile, 'utf8')) }
    catch { return [] }
  }
  _writeProfiles(profiles) {
    fs.writeFileSync(this.dataFile, JSON.stringify(profiles, null, 2))
  }

  getAll() {
    const profiles = this._readProfiles()
    return profiles.map(p => ({
      ...p,
      status: this.runningBrowsers.has(p.id) ? 'active' : 'ready'
    }))
  }

  create(data) {
    const profiles = this._readProfiles()
    // Sanitize name: strip HTML tags, limit length
    const safeName = (data.name || 'Untitled Profile').replace(/<[^>]*>/g, '').substring(0, 100)
    const newProfile = {
      id: uuidv4(),
      name: safeName,
      folder: data.folder || '',
      os: data.os || 'Windows',
      browser: data.browser || 'Chrome',
      userAgent: data.userAgent || '',
      screenWidth: parseInt(data.screenWidth) || 1920,
      screenHeight: parseInt(data.screenHeight) || 1080,
      timezone: data.timezone || 'America/New_York',
      language: data.language || 'en-US',
      proxy: data.proxy || '',
      proxyType: data.proxyType || 'Without Proxy',
      notes: data.notes || '',
      tags: data.tags || '',
      startUrl: data.startUrl || '',
      webrtc: data.webrtc || 'Altered',
      geolocation: data.geolocation || 'Prompt',
      geoLat: data.geoLat || '',
      geoLng: data.geoLng || '',
      geoAccuracy: data.geoAccuracy || '',
      browserDataSync: data.browserDataSync !== false,
      fakeCanvas: data.fakeCanvas || false,
      fakeAudio: data.fakeAudio !== false,
      fakeWebGLImage: data.fakeWebGLImage || false,
      fakeWebGLMetadata: data.fakeWebGLMetadata !== false,
      fakeClientRects: data.fakeClientRects || false,
      maskMediaDevices: data.maskMediaDevices !== false,
      mediaVideoInputs: parseInt(data.mediaVideoInputs) || 1,
      mediaAudioInputs: parseInt(data.mediaAudioInputs) || 1,
      mediaAudioOutputs: parseInt(data.mediaAudioOutputs) || 1,
      clearCache: data.clearCache !== false,
      restoreSession: data.restoreSession !== false,
      dontShowImages: data.dontShowImages || false,
      muteAudio: data.muteAudio || false,
      cookies: data.cookies || '',
      bookmarks: data.bookmarks || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    profiles.push(newProfile)
    this._writeProfiles(profiles)
    return newProfile
  }

  update(id, data) {
    const profiles = this._readProfiles()
    const index = profiles.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Profile not found')
    profiles[index] = {
      ...profiles[index],
      ...data,
      id: profiles[index].id,
      createdAt: profiles[index].createdAt,
      screenWidth: parseInt(data.screenWidth) || profiles[index].screenWidth,
      screenHeight: parseInt(data.screenHeight) || profiles[index].screenHeight,
      updatedAt: new Date().toISOString()
    }
    this._writeProfiles(profiles)
    return profiles[index]
  }

  async delete(id) {
    // Safety: ensure id doesn't escape profilesDir
    if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) throw new Error('Invalid ID')
    await this.stopBrowser(id)
    let profiles = this._readProfiles()
    profiles = profiles.filter(p => p.id !== id)
    this._writeProfiles(profiles)
    const profileDir = path.join(this.profilesDir, id)
    // Double check the resolved path is inside profilesDir
    if (profileDir.startsWith(this.profilesDir) && fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true })
    }
    return { success: true }
  }

  async deleteMultiple(ids) {
    for (const id of ids) {
      await this.delete(id)
    }
    return { success: true }
  }

  createBatch(dataArray) {
    const profiles = this._readProfiles()
    const created = []
    for (const data of dataArray) {
      const newProfile = {
        id: uuidv4(),
        name: data.name || 'Untitled Profile',
        folder: data.folder || '',
        os: data.os || 'Windows',
        browser: data.browser || 'Chrome',
        userAgent: data.userAgent || '',
        screenWidth: parseInt(data.screenWidth) || 1920,
        screenHeight: parseInt(data.screenHeight) || 1080,
        timezone: data.timezone || 'America/New_York',
        language: data.language || 'en-US',
        proxy: data.proxy || '',
        proxyType: data.proxyType || 'Without Proxy',
        notes: data.notes || '',
        tags: data.tags || '',
        startUrl: data.startUrl || '',
        webrtc: data.webrtc || 'Altered',
        geolocation: data.geolocation || 'Prompt',
        geoLat: data.geoLat || '',
        geoLng: data.geoLng || '',
        geoAccuracy: data.geoAccuracy || '',
        browserDataSync: data.browserDataSync !== false,
        fakeCanvas: data.fakeCanvas || false,
        fakeAudio: data.fakeAudio !== false,
        fakeWebGLImage: data.fakeWebGLImage || false,
        fakeWebGLMetadata: data.fakeWebGLMetadata !== false,
        fakeClientRects: data.fakeClientRects || false,
        maskMediaDevices: data.maskMediaDevices !== false,
        mediaVideoInputs: parseInt(data.mediaVideoInputs) || 1,
        mediaAudioInputs: parseInt(data.mediaAudioInputs) || 1,
        mediaAudioOutputs: parseInt(data.mediaAudioOutputs) || 1,
        clearCache: data.clearCache !== false,
        restoreSession: data.restoreSession !== false,
        dontShowImages: data.dontShowImages || false,
        muteAudio: data.muteAudio || false,
        cookies: data.cookies || '',
        bookmarks: data.bookmarks || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      profiles.push(newProfile)
      created.push(newProfile)
    }
    this._writeProfiles(profiles)
    return created
  }

  duplicate(id, count, options) {
    const profiles = this._readProfiles()
    const source = profiles.find(p => p.id === id)
    if (!source) throw new Error('Profile not found')

    const created = []
    for (let i = 0; i < count; i++) {
      const dup = {
        id: uuidv4(),
        name: `${source.name} (${i + 1})`,
        folder: source.folder || '',
        os: options.userAgents ? source.os : 'Windows',
        browser: options.userAgents ? source.browser : 'Chrome',
        userAgent: options.userAgents ? source.userAgent : '',
        screenWidth: options.fingerprint ? source.screenWidth : 1920,
        screenHeight: options.fingerprint ? source.screenHeight : 1080,
        timezone: source.timezone,
        language: source.language,
        proxy: options.proxy ? source.proxy : '',
        proxyType: options.proxy ? source.proxyType : 'Without Proxy',
        notes: source.notes,
        tags: source.tags,
        startUrl: source.startUrl,
        webrtc: options.webrtcGeo ? source.webrtc : 'Altered',
        geolocation: options.webrtcGeo ? source.geolocation : 'Prompt',
        geoLat: options.webrtcGeo ? source.geoLat : '',
        geoLng: options.webrtcGeo ? source.geoLng : '',
        geoAccuracy: options.webrtcGeo ? source.geoAccuracy : '',
        browserDataSync: source.browserDataSync,
        fakeCanvas: options.fingerprint ? source.fakeCanvas : false,
        fakeAudio: options.fingerprint ? source.fakeAudio : true,
        fakeWebGLImage: options.fingerprint ? source.fakeWebGLImage : false,
        fakeWebGLMetadata: options.fingerprint ? source.fakeWebGLMetadata : true,
        fakeClientRects: options.fingerprint ? source.fakeClientRects : false,
        maskMediaDevices: source.maskMediaDevices,
        mediaVideoInputs: source.mediaVideoInputs,
        mediaAudioInputs: source.mediaAudioInputs,
        mediaAudioOutputs: source.mediaAudioOutputs,
        clearCache: source.clearCache,
        restoreSession: source.restoreSession,
        dontShowImages: source.dontShowImages,
        muteAudio: source.muteAudio,
        cookies: '',
        bookmarks: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      profiles.push(dup)
      created.push(dup)
    }
    this._writeProfiles(profiles)
    return created
  }

  // ─── Folders ───
  _readFolders() {
    try { return JSON.parse(fs.readFileSync(this.foldersFile, 'utf8')) }
    catch { return [{ id: 'all', name: 'All Profiles', color: '#ffffff', isDefault: true }] }
  }
  _writeFolders(folders) {
    fs.writeFileSync(this.foldersFile, JSON.stringify(folders, null, 2))
  }

  getFolders() {
    return this._readFolders()
  }

  createFolder(data) {
    const folders = this._readFolders()
    const folder = {
      id: uuidv4(),
      name: data.name || 'New Folder',
      color: data.color || '#4285f4',
      isDefault: false
    }
    folders.push(folder)
    this._writeFolders(folders)
    return folder
  }

  updateFolder(id, data) {
    const folders = this._readFolders()
    const idx = folders.findIndex(f => f.id === id)
    if (idx === -1) throw new Error('Folder not found')
    folders[idx] = { ...folders[idx], ...data }
    this._writeFolders(folders)
    return folders[idx]
  }

  deleteFolder(id) {
    if (id === 'all') return { success: false, error: 'Cannot delete default folder' }
    let folders = this._readFolders()
    folders = folders.filter(f => f.id !== id)
    this._writeFolders(folders)
    // Remove folder reference from profiles
    const profiles = this._readProfiles()
    profiles.forEach(p => { if (p.folder === id) p.folder = '' })
    this._writeProfiles(profiles)
    return { success: true }
  }

  // ─── Proxies ───
  _readProxies() {
    try { return JSON.parse(fs.readFileSync(this.proxiesFile, 'utf8')) }
    catch { return [] }
  }
  _writeProxies(proxies) {
    fs.writeFileSync(this.proxiesFile, JSON.stringify(proxies, null, 2))
  }

  getProxies() {
    return this._readProxies()
  }

  addProxies(data) {
    const proxies = this._readProxies()
    const newProxies = data.list.map(addr => ({
      id: uuidv4(),
      type: data.type || 'HTTP',
      address: addr.trim(),
      tags: data.tags || '',
      notes: data.notes || '',
      expiration: data.expiration || '',
      status: 'unchecked',
      addedAt: new Date().toISOString()
    }))
    proxies.push(...newProxies)
    this._writeProxies(proxies)
    return newProxies
  }

  deleteProxy(id) {
    let proxies = this._readProxies()
    proxies = proxies.filter(p => p.id !== id)
    this._writeProxies(proxies)
    return { success: true }
  }

  deleteProxies(ids) {
    let proxies = this._readProxies()
    proxies = proxies.filter(p => !ids.includes(p.id))
    this._writeProxies(proxies)
    return { success: true }
  }

  // ─── User Agent Generator ───
  _generateUserAgent(os, browser) {
    const chromeVer = `${110 + Math.floor(Math.random() * 20)}.0.${Math.floor(Math.random() * 9999)}.${Math.floor(Math.random() * 200)}`

    const osPlatforms = {
      'Windows': [
        'Windows NT 10.0; Win64; x64',
        'Windows NT 10.0; WOW64'
      ],
      'MacOS': [
        `Macintosh; Intel Mac OS X 10_15_${Math.floor(Math.random() * 8)}`,
        `Macintosh; Intel Mac OS X 11_${Math.floor(Math.random() * 7)}_${Math.floor(Math.random() * 5)}`,
        `Macintosh; Intel Mac OS X 12_${Math.floor(Math.random() * 6)}_${Math.floor(Math.random() * 3)}`,
        `Macintosh; Intel Mac OS X 13_${Math.floor(Math.random() * 5)}`,
        `Macintosh; Intel Mac OS X 14_${Math.floor(Math.random() * 4)}`
      ],
      'Linux': [
        'X11; Linux x86_64',
        'X11; Ubuntu; Linux x86_64',
        'X11; Fedora; Linux x86_64'
      ],
      'Android': [
        `Linux; Android ${11 + Math.floor(Math.random() * 4)}; SM-G99${Math.floor(Math.random() * 10)}B`,
        `Linux; Android ${11 + Math.floor(Math.random() * 4)}; Pixel ${5 + Math.floor(Math.random() * 4)}`,
        `Linux; Android ${11 + Math.floor(Math.random() * 4)}; SM-A52${Math.floor(Math.random() * 5)}F`,
        `Linux; Android ${11 + Math.floor(Math.random() * 4)}; Redmi Note ${9 + Math.floor(Math.random() * 4)}`
      ],
      'iOS': [
        `iPhone; CPU iPhone OS ${15 + Math.floor(Math.random() * 3)}_${Math.floor(Math.random() * 6)} like Mac OS X`,
        `iPad; CPU OS ${15 + Math.floor(Math.random() * 3)}_${Math.floor(Math.random() * 6)} like Mac OS X`
      ]
    }

    const platformList = osPlatforms[os] || osPlatforms['Windows']
    const platform = platformList[Math.floor(Math.random() * platformList.length)]

    // Mobile check
    const isMobile = os === 'Android' || os === 'iOS'
    const mobileSuffix = isMobile ? ' Mobile' : ''

    switch (browser) {
      case 'Chrome':
        if (os === 'iOS') {
          return `Mozilla/5.0 (${platform}) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/${chromeVer} Mobile/15E148 Safari/604.1`
        }
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}${mobileSuffix} Safari/537.36`

      case 'Brave':
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}${mobileSuffix} Safari/537.36`

      case 'Edge':
        const edgeVer = `${110 + Math.floor(Math.random() * 20)}.0.${Math.floor(Math.random() * 2000)}.${Math.floor(Math.random() * 100)}`
        if (os === 'iOS') {
          return `Mozilla/5.0 (${platform}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/${edgeVer} Mobile/15E148 Safari/604.1`
        }
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}${mobileSuffix} Safari/537.36 Edg/${edgeVer}`

      case 'Opera':
        const operaVer = `${90 + Math.floor(Math.random() * 15)}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)}`
        if (os === 'Android') {
          return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Mobile Safari/537.36 OPR/${operaVer}`
        }
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36 OPR/${operaVer}`

      case 'Yandex':
        const yVer = `${23 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 12)}.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 500)}`
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}${mobileSuffix} YaBrowser/${yVer} Safari/537.36`

      default:
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}${mobileSuffix} Safari/537.36`
    }
  }

  // ─── Browser Launch ───
  // All profiles use a Chromium-based browser as the engine.
  // The selected "browser" in the profile controls the user-agent string,
  // not necessarily which .exe runs. If the exact browser is installed, we use it.
  // Otherwise we fallback to Chrome or Edge (always available on Windows).
  _findBrowserPath(browser) {
    const env = process.env
    const pf = env['ProgramFiles'] || ''
    const pf86 = env['ProgramFiles(x86)'] || ''
    const local = env.LOCALAPPDATA || ''

    const browserPaths = {
      'Chrome': [
        path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ],
      'Brave': [
        path.join(pf, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
        path.join(local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      ],
      'Edge': [
        path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      ],
      'Opera': [
        path.join(pf, 'Opera Software', 'Opera Stable', 'opera.exe'),
        path.join(local, 'Programs', 'Opera', 'opera.exe'),
        path.join(local, 'Programs', 'Opera GX', 'opera.exe'),
      ],
      'Yandex': [
        path.join(local, 'Yandex', 'YandexBrowser', 'Application', 'browser.exe'),
        path.join(pf, 'Yandex', 'YandexBrowser', 'Application', 'browser.exe'),
      ],
    }

    // Try the selected browser first
    const preferred = browserPaths[browser] || []
    for (const p of preferred) {
      if (fs.existsSync(p)) return p
    }

    // Fallback order: Chrome -> Edge -> any available
    const fallbackOrder = ['Chrome', 'Edge', 'Brave', 'Opera', 'Yandex']
    for (const fb of fallbackOrder) {
      const paths = browserPaths[fb] || []
      for (const p of paths) {
        if (fs.existsSync(p)) return p
      }
    }

    throw new Error('No Chromium-based browser found. Please install Google Chrome or Microsoft Edge.')
  }

  async launchBrowser(profileId) {
    if (this.runningBrowsers.has(profileId)) {
      return { success: false, error: 'Profile already running' }
    }

    const profiles = this._readProfiles()
    const profile = profiles.find(p => p.id === profileId)
    if (!profile) throw new Error('Profile not found')

    const chromePath = this._findBrowserPath(profile.browser || 'Chrome')
    const userDataDir = path.join(this.profilesDir, profileId)

    // Parse proxy - format: host:port or host:port:user:pass
    let proxyServer = ''
    let proxyUser = ''
    let proxyPass = ''
    if (profile.proxy && profile.proxyType !== 'Without Proxy') {
      const parts = profile.proxy.split(':')
      if (parts.length >= 2) {
        proxyServer = `${parts[0]}:${parts[1]}`
        if (parts.length >= 4) {
          proxyUser = parts[2]
          proxyPass = parts[3]
        }
      }
      // Add protocol prefix for --proxy-server flag
      const proxyProtocol = profile.proxyType === 'SOCKS4' ? 'socks4' :
                            profile.proxyType === 'SOCKS5' ? 'socks5' : 'http'
      if (proxyServer) proxyServer = `${proxyProtocol}://${proxyServer}`
    }

    const isMobile = profile.os === 'Android' || profile.os === 'iOS'
    const winW = isMobile ? (profile.screenWidth || 412) : (profile.screenWidth || 1920)
    const winH = isMobile ? (profile.screenHeight || 915) : (profile.screenHeight || 1080)

    const args = [
      `--user-data-dir=${userDataDir}`,
      `--window-size=${winW},${winH}`,
      `--lang=${profile.language}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
      // Stealth: disable automation-related flags
      '--disable-blink-features=AutomationControlled',
      '--disable-features=AutomationControlled,TranslateUI',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-service-autorun',
      '--password-store=basic',
      '--use-mock-keychain',
      '--export-tagged-pdf',
    ]

    if (proxyServer) {
      args.push(`--proxy-server=${proxyServer}`)
    }
    if (profile.muteAudio) {
      args.push('--mute-audio')
    }
    if (profile.dontShowImages) {
      args.push('--blink-settings=imagesEnabled=false')
    }

    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false,
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
      args
    })

    // Generate user agent based on OS + Browser if not custom
    const userAgent = profile.userAgent || this._generateUserAgent(profile.os || 'Windows', profile.browser || 'Chrome')

    const profileLang = profile.language || 'en-US'

    const setupPage = async (page) => {
      try {
        // ═══ Comprehensive Stealth Patches ═══
        await page.evaluateOnNewDocument((lang) => {
          // 1) Hide navigator.webdriver
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

          // 2) Mock window.chrome to look like real Chrome
          if (!window.chrome) {
            window.chrome = {}
          }
          if (!window.chrome.runtime) {
            window.chrome.runtime = {
              connect: function() {},
              sendMessage: function() {},
              onMessage: { addListener: function() {}, removeListener: function() {} },
              id: undefined,
            }
          }
          // chrome.csi and chrome.loadTimes
          if (!window.chrome.csi) {
            window.chrome.csi = function() { return {} }
          }
          if (!window.chrome.loadTimes) {
            window.chrome.loadTimes = function() {
              return {
                commitLoadTime: Date.now() / 1000,
                connectionInfo: 'h2',
                finishDocumentLoadTime: Date.now() / 1000,
                finishLoadTime: Date.now() / 1000,
                firstPaintAfterLoadTime: 0,
                firstPaintTime: Date.now() / 1000,
                navigationType: 'Other',
                npnNegotiatedProtocol: 'h2',
                requestTime: Date.now() / 1000 - 0.16,
                startLoadTime: Date.now() / 1000 - 0.16,
                wasAlternateProtocolAvailable: false,
                wasFetchedViaSpdy: true,
                wasNpnNegotiated: true,
              }
            }
          }

          // 3) Fix navigator.plugins (empty in automation)
          if (navigator.plugins.length === 0) {
            const fakePlugins = [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
              { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
            ]
            const pluginArray = []
            fakePlugins.forEach(fp => {
              const p = Object.create(Plugin.prototype)
              Object.defineProperties(p, {
                name: { value: fp.name, enumerable: true },
                filename: { value: fp.filename, enumerable: true },
                description: { value: fp.description, enumerable: true },
                length: { value: 1, enumerable: true },
              })
              pluginArray.push(p)
            })
            Object.defineProperty(navigator, 'plugins', {
              get: () => {
                const arr = pluginArray
                arr.item = (i) => arr[i] || null
                arr.namedItem = (name) => arr.find(p => p.name === name) || null
                arr.refresh = () => {}
                return arr
              }
            })
          }

          // 4) Fix navigator.languages
          Object.defineProperty(navigator, 'languages', {
            get: () => [lang, lang.split('-')[0]]
          })

          // 5) Fix navigator.permissions.query (notifications should be "prompt" not "denied")
          const originalQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions)
          if (originalQuery) {
            window.navigator.permissions.query = (parameters) => {
              if (parameters.name === 'notifications') {
                return Promise.resolve({ state: Notification.permission === 'denied' ? 'prompt' : Notification.permission })
              }
              return originalQuery(parameters)
            }
          }

          // 6) Fix Notification.permission to "default"
          if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
            Object.defineProperty(Notification, 'permission', { get: () => 'default' })
          }

          // 7) Fix navigator.connection.rtt (0 in automation)
          if (navigator.connection && navigator.connection.rtt === 0) {
            Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 + Math.floor(Math.random() * 100) })
          }

          // 8) Fix iframe contentWindow detection
          const originalAttachShadow = Element.prototype.attachShadow
          Element.prototype.attachShadow = function() {
            return originalAttachShadow.apply(this, arguments)
          }

          // 9) Override toString for patched functions to look native
          const nativeToString = Function.prototype.toString
          const customFns = new Set()
          const origDefineProperty = Object.defineProperty
          const patchToString = (fn, nativeName) => {
            customFns.add(fn)
            try {
              origDefineProperty(fn, 'toString', {
                value: function() { return `function ${nativeName || ''}() { [native code] }` },
                writable: false, configurable: true
              })
            } catch (_) {}
          }
          if (window.chrome?.csi) patchToString(window.chrome.csi, 'csi')
          if (window.chrome?.loadTimes) patchToString(window.chrome.loadTimes, 'loadTimes')

          // 10) Fix window.outerWidth/outerHeight (sometimes 0 in headless)
          if (window.outerWidth === 0) {
            Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth })
          }
          if (window.outerHeight === 0) {
            Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 85 })
          }

          // 11) Fix missing screen properties
          if (screen.availWidth === 0) {
            Object.defineProperty(screen, 'availWidth', { get: () => screen.width })
          }
          if (screen.availHeight === 0) {
            Object.defineProperty(screen, 'availHeight', { get: () => screen.height - 40 })
          }

        }, profileLang)

        // ═══ CDP-level stealth: remove "cdc_" markers ═══
        const cdpStealth = await page.createCDPSession()
        try {
          // Remove automation-related Console domain markers
          await cdpStealth.send('Page.addScriptToEvaluateOnNewDocument', {
            source: `
              // Remove cdc_ properties from document
              delete Object.getPrototypeOf(navigator).webdriver;
              // Prevent detection via error stack traces
              const origError = Error;
              window.Error = function(...args) {
                const err = new origError(...args);
                if (err.stack) {
                  err.stack = err.stack.replace(/\\n.*pptr.*/g, '');
                }
                return err;
              };
              window.Error.prototype = origError.prototype;
            `
          })
        } catch (_) {}
        try { await cdpStealth.detach() } catch (_) {}

        // Authenticate proxy if credentials provided
        if (proxyUser && proxyPass) {
          await page.authenticate({ username: proxyUser, password: proxyPass })
        }

        // Get CDP session for advanced emulation
        const cdp = await page.createCDPSession()

        if (isMobile) {
          // Full mobile device emulation via CDP
          const mobileW = 412
          const mobileH = 915
          const scaleFactor = 2.625

          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: mobileW,
            height: mobileH,
            deviceScaleFactor: scaleFactor,
            mobile: true,
            screenWidth: mobileW,
            screenHeight: mobileH,
            screenOrientation: { angle: 0, type: 'portraitPrimary' }
          })

          await cdp.send('Emulation.setTouchEmulationEnabled', {
            enabled: true,
            maxTouchPoints: 5
          })

          await cdp.send('Emulation.setUserAgentOverride', {
            userAgent: userAgent,
            platform: profile.os === 'Android' ? 'Linux armv81' : 'iPhone',
            userAgentMetadata: {
              mobile: true,
              platform: profile.os === 'Android' ? 'Android' : 'iOS'
            }
          })
        } else {
          // Desktop: just set user agent
          await page.setUserAgent(userAgent)
        }

        if (profile.timezone) await page.emulateTimezone(profile.timezone)
        if (profile.geolocation === 'Allow' && profile.geoLat && profile.geoLng) {
          await page.setGeolocation({
            latitude: parseFloat(profile.geoLat),
            longitude: parseFloat(profile.geoLng),
            accuracy: parseFloat(profile.geoAccuracy) || 100
          })
        }
      } catch (_) {}
    }

    browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        try {
          const page = await target.page()
          if (page) await setupPage(page)
        } catch (_) {}
      }
    })

    const pages = await browser.pages()
    if (pages.length > 0) {
      await setupPage(pages[0])
      // Navigate to start URL or default
      const url = profile.startUrl || 'https://ipfighter.com'
      try { await pages[0].goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }) } catch (_) {}
    }

    this.runningBrowsers.set(profileId, browser)

    browser.on('disconnected', () => {
      this.runningBrowsers.delete(profileId)
      if (this.onBrowserStopped) this.onBrowserStopped(profileId)
    })

    return { success: true }
  }

  getBrowser(profileId) {
    return this.runningBrowsers.get(profileId) || null
  }

  async stopBrowser(profileId) {
    const browser = this.runningBrowsers.get(profileId)
    if (browser) {
      try { await browser.close() } catch (_) {}
      this.runningBrowsers.delete(profileId)
    }
    return { success: true }
  }

  async stopAllBrowsers() {
    for (const [, browser] of this.runningBrowsers) {
      try { await browser.close() } catch (_) {}
    }
    this.runningBrowsers.clear()
  }
}
