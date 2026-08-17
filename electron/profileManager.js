import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawn } from 'child_process'
import extractZip from 'extract-zip'
import { v4 as uuidv4 } from 'uuid'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { HttpProxyRelay } from './httpProxyRelay.js'
import { WindowsProxyLock } from './windowsProxyLock.js'
import { AndroidEmulatorManager } from './androidEmulatorManager.js'
import {
  Browser,
  BrowserTag,
  detectBrowserPlatform,
  getInstalledBrowsers,
  install,
  resolveBuildId
} from '@puppeteer/browsers'

// Apply only the stealth evasions that help automation checks without
// inventing hardware/browser fingerprints that scanners can compare.
const stealth = StealthPlugin()
stealth.enabledEvasions.delete('user-agent-override')
stealth.enabledEvasions.delete('navigator.webdriver')
stealth.enabledEvasions.delete('webgl.vendor')
stealth.enabledEvasions.delete('navigator.hardwareConcurrency')
stealth.enabledEvasions.delete('navigator.languages')
puppeteerExtra.use(stealth)

const NEXUS_WALLET_EXTENSION = {
  id: 'ajhnlmebdlgghbfaoleihpchdmmmgbmg',
  name: 'Nexus Wallet',
  cacheDirName: 'nexus-wallet'
}

const PROFILEO_AUTO_CLICK_EXTENSION = {
  name: 'Auto Click Text Recorder',
  cacheDirName: 'profileo-auto-click-recorder',
  sourceDir: path.join('extensions', 'auto-click-recorder')
}

const PROFILEO_PRIVACY_SHIELD_EXTENSION = {
  name: 'Profileo Privacy Shield',
  cacheDirName: 'profileo-privacy-shield',
  version: '1.0.0'
}

const PROFILEO_WEBRTC_GUARD_EXTENSION = {
  name: 'Profileo WebRTC Guard',
  cacheDirName: 'profileo-webrtc-guard',
  version: '1.0.0'
}

const PROFILEO_BROWSER_RESOURCE_DIR = path.join('browsers', 'chromium')
const PROFILEO_FINGERPRINT_CHROMIUM_VERSION = '142.0.0.0'
const DEFAULT_FOLDERS = [
  { id: 'all', name: 'All Profiles', color: '#ffffff', isDefault: true },
  { id: 'windows', name: 'Windows', color: '#00adef', isDefault: true },
  { id: 'iphone', name: 'Iphone', color: '#4f8cff', isDefault: true },
  { id: 'android', name: 'Android', color: '#3ddc84', isDefault: true }
]

function sanitizeDeviceCount(value, fallback = 0) {
  const parsed = parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(5, parsed))
}

function getChromeWebStoreCrxUrl(extensionId) {
  const x = encodeURIComponent(`id=${extensionId}&installsource=ondemand&uc`)
  return `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0.0.0&acceptformat=crx2,crx3&x=${x}`
}

function readProtoVarint(buffer, offset) {
  let value = 0
  let shift = 0
  while (offset < buffer.length) {
    const byte = buffer[offset++]
    value += (byte & 0x7f) * (2 ** shift)
    if ((byte & 0x80) === 0) return { value, offset }
    shift += 7
  }
  throw new Error('Invalid CRX header')
}

function skipProtoField(buffer, wireType, offset) {
  if (wireType === 0) return readProtoVarint(buffer, offset).offset
  if (wireType === 1) return offset + 8
  if (wireType === 2) {
    const len = readProtoVarint(buffer, offset)
    return len.offset + len.value
  }
  if (wireType === 5) return offset + 4
  throw new Error('Unsupported CRX header field')
}

function getLengthDelimitedProtoField(buffer, fieldNumber) {
  let offset = 0
  while (offset < buffer.length) {
    const key = readProtoVarint(buffer, offset)
    offset = key.offset
    const currentField = Math.floor(key.value / 8)
    const wireType = key.value & 7
    if (currentField === fieldNumber && wireType === 2) {
      const len = readProtoVarint(buffer, offset)
      return buffer.subarray(len.offset, len.offset + len.value)
    }
    offset = skipProtoField(buffer, wireType, offset)
  }
  return null
}

function findCrx3PublicKeys(headerBuffer) {
  const publicKeys = []
  let offset = 0
  while (offset < headerBuffer.length) {
    const key = readProtoVarint(headerBuffer, offset)
    offset = key.offset
    const fieldNumber = Math.floor(key.value / 8)
    const wireType = key.value & 7

    if ((fieldNumber === 2 || fieldNumber === 3) && wireType === 2) {
      const len = readProtoVarint(headerBuffer, offset)
      const proof = headerBuffer.subarray(len.offset, len.offset + len.value)
      const publicKey = getLengthDelimitedProtoField(proof, 1)
      if (publicKey) publicKeys.push(publicKey)
      offset = len.offset + len.value
    } else {
      offset = skipProtoField(headerBuffer, wireType, offset)
    }
  }
  return publicKeys
}

function parseCrxPackage(crxBuffer) {
  if (crxBuffer.toString('utf8', 0, 4) !== 'Cr24') {
    return { zipBuffer: crxBuffer, publicKeys: [] }
  }

  const version = crxBuffer.readUInt32LE(4)
  if (version === 2) {
    const publicKeyLength = crxBuffer.readUInt32LE(8)
    const signatureLength = crxBuffer.readUInt32LE(12)
    const publicKeyStart = 16
    const zipStart = publicKeyStart + publicKeyLength + signatureLength
    return {
      zipBuffer: crxBuffer.subarray(zipStart),
      publicKeys: [crxBuffer.subarray(publicKeyStart, publicKeyStart + publicKeyLength)]
    }
  }

  if (version === 3) {
    const headerLength = crxBuffer.readUInt32LE(8)
    const headerStart = 12
    const headerEnd = headerStart + headerLength
    return {
      zipBuffer: crxBuffer.subarray(headerEnd),
      publicKeys: findCrx3PublicKeys(crxBuffer.subarray(headerStart, headerEnd))
    }
  }

  throw new Error(`Unsupported CRX version: ${version}`)
}

function chromeExtensionIdFromPublicKey(publicKey) {
  const hash = crypto.createHash('sha256').update(publicKey).digest()
  let id = ''
  for (const byte of hash.subarray(0, 16)) {
    id += String.fromCharCode(97 + (byte >> 4))
    id += String.fromCharCode(97 + (byte & 0x0f))
  }
  return id
}

function selectPublicKeyForExtension(publicKeys, expectedId) {
  return publicKeys.find(key => chromeExtensionIdFromPublicKey(key) === expectedId) || publicKeys[0] || null
}

function getBundledResourceCandidates(relativeDir) {
  const candidates = []
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, relativeDir))
  candidates.push(path.resolve(process.cwd(), 'resources', relativeDir))
  return [...new Set(candidates)]
}

const ANDROID_ENABLED = process.env.PROFILEO_ENABLE_ANDROID === 'true'
const normalizeOs = (os) => (!ANDROID_ENABLED && os === 'Android' ? 'Windows' : (os || 'Windows'))

export class ProfileManager {
  constructor({ dataDir, profilesDir, confirmStrictProxyLock }) {
    this.dataDir = dataDir
    this.profilesDir = profilesDir
    this.dataFile = path.join(this.dataDir, 'profiles.json')
    this.foldersFile = path.join(this.dataDir, 'folders.json')
    this.proxiesFile = path.join(this.dataDir, 'proxies.json')
    this.runningBrowsers = new Map()
    this.defaultExtensionsPromise = null
    this.profileoBrowserPromise = null
    this.confirmStrictProxyLock = confirmStrictProxyLock
    this.windowsProxyLock = new WindowsProxyLock()
    this.androidEmulatorManager = new AndroidEmulatorManager({ dataDir })

    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true })
    if (!fs.existsSync(this.profilesDir)) fs.mkdirSync(this.profilesDir, { recursive: true })
    if (!fs.existsSync(this.dataFile)) fs.writeFileSync(this.dataFile, '[]')
    if (!fs.existsSync(this.foldersFile)) fs.writeFileSync(this.foldersFile, JSON.stringify(DEFAULT_FOLDERS, null, 2))
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

  _writeLaunchLog(entry) {
    try {
      const logFile = path.join(this.dataDir, 'launch-log.jsonl')
      fs.appendFileSync(logFile, JSON.stringify({
        time: new Date().toISOString(),
        ...entry
      }) + '\n')
    } catch (_) {}
  }

  _touchProfileActivity(profileId, activity) {
    try {
      const profiles = this._readProfiles()
      const index = profiles.findIndex(p => p.id === profileId)
      if (index === -1) return

      const timestamp = new Date().toISOString()
      profiles[index] = {
        ...profiles[index],
        lastActivity: activity,
        lastActivityAt: timestamp,
        updatedAt: timestamp
      }

      if (activity === 'launched') profiles[index].lastLaunchedAt = timestamp
      if (activity === 'stopped') profiles[index].lastStoppedAt = timestamp
      if (activity === 'error') profiles[index].lastErrorAt = timestamp

      this._writeProfiles(profiles)
    } catch (_) {}
  }

  getAll() {
    const profiles = this._readProfiles()
    return profiles.map(p => ({
      ...p,
      status: this.runningBrowsers.has(p.id) ? 'active' : 'ready'
    }))
  }

  getProfile(profileId) {
    return this._readProfiles().find(p => p.id === profileId) || null
  }

  create(data) {
    const profiles = this._readProfiles()
    // Sanitize name: strip HTML tags, limit length
    const safeName = (data.name || 'Untitled Profile').replace(/<[^>]*>/g, '').substring(0, 100)
    const newProfile = {
      id: uuidv4(),
      name: safeName,
      folder: data.folder || '',
      os: normalizeOs(data.os),
      browser: data.browser || 'Chrome',
      userAgent: data.userAgent || '',
      screenWidth: parseInt(data.screenWidth) || 1920,
      screenHeight: parseInt(data.screenHeight) || 1080,
      timezone: data.timezone || 'America/New_York',
      language: data.language || 'en-US',
      proxy: data.proxy || '',
      proxyType: data.proxyType || 'Without Proxy',
      proxyNetworkType: data.proxyNetworkType || '',
      proxyCountryCode: data.proxyCountryCode || '',
      proxyCountry: data.proxyCountry || '',
      notes: data.notes || '',
      tags: data.tags || '',
      startUrl: data.startUrl || '',
      webrtc: data.webrtc || 'Disabled',
      geolocation: data.geolocation || 'Prompt',
      geoLat: data.geoLat || '',
      geoLng: data.geoLng || '',
      geoAccuracy: data.geoAccuracy || '',
      browserDataSync: data.browserDataSync !== false,
      fakeCanvas: data.fakeCanvas !== false,
      fakeAudio: data.fakeAudio !== false,
      fakeWebGLImage: data.fakeWebGLImage !== false,
      fakeWebGLMetadata: data.fakeWebGLMetadata !== false,
      fakeClientRects: data.fakeClientRects || false,
      maskMediaDevices: data.maskMediaDevices !== false,
      mediaVideoInputs: sanitizeDeviceCount(data.mediaVideoInputs, 0),
      mediaAudioInputs: sanitizeDeviceCount(data.mediaAudioInputs, 0),
      mediaAudioOutputs: sanitizeDeviceCount(data.mediaAudioOutputs, 0),
      clearCache: data.clearCache !== false,
      restoreSession: data.restoreSession !== false,
      dontShowImages: data.dontShowImages || false,
      muteAudio: data.muteAudio || false,
      vpsCompatibilityMode: data.vpsCompatibilityMode || false,
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
      os: normalizeOs(data.os || profiles[index].os),
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

  replaceAllFromCloud(cloudProfiles) {
    // Replace all local profile metadata with cloud data
    // Preserves local browser data dirs where IDs match
    const oldProfiles = this._readProfiles()
    const newProfiles = []
    for (const data of cloudProfiles) {
      newProfiles.push({
        id: data.id || uuidv4(),
        name: data.name || 'Untitled Profile',
        folder: data.folder || '',
        os: normalizeOs(data.os),
        browser: data.browser || 'Chrome',
        userAgent: data.userAgent || '',
        screenWidth: parseInt(data.screenWidth) || 1920,
        screenHeight: parseInt(data.screenHeight) || 1080,
        timezone: data.timezone || 'America/New_York',
        language: data.language || 'en-US',
        proxy: data.proxy || '',
        proxyType: data.proxyType || 'Without Proxy',
        proxyNetworkType: data.proxyNetworkType || '',
        proxyCountryCode: data.proxyCountryCode || '',
        proxyCountry: data.proxyCountry || '',
        notes: data.notes || '',
        tags: data.tags || '',
        startUrl: data.startUrl || '',
        webrtc: data.webrtc || 'Disabled',
        geolocation: data.geolocation || 'Prompt',
        geoLat: data.geoLat || '',
        geoLng: data.geoLng || '',
        geoAccuracy: data.geoAccuracy || '',
        browserDataSync: data.browserDataSync !== false,
      fakeCanvas: data.fakeCanvas !== false,
      fakeAudio: data.fakeAudio !== false,
      fakeWebGLImage: data.fakeWebGLImage !== false,
      fakeWebGLMetadata: data.fakeWebGLMetadata !== false,
      fakeClientRects: data.fakeClientRects || false,
      maskMediaDevices: data.maskMediaDevices !== false,
      mediaVideoInputs: sanitizeDeviceCount(data.mediaVideoInputs, 0),
      mediaAudioInputs: sanitizeDeviceCount(data.mediaAudioInputs, 0),
      mediaAudioOutputs: sanitizeDeviceCount(data.mediaAudioOutputs, 0),
        clearCache: data.clearCache || false,
        restoreSession: data.restoreSession !== false,
        dontShowImages: data.dontShowImages || false,
        muteAudio: data.muteAudio || false,
        vpsCompatibilityMode: data.vpsCompatibilityMode || false,
        cookies: data.cookies || '',
        bookmarks: data.bookmarks || '',
        lastActivity: data.lastActivity || '',
        lastActivityAt: data.lastActivityAt || '',
        lastLaunchedAt: data.lastLaunchedAt || '',
        lastStoppedAt: data.lastStoppedAt || '',
        lastErrorAt: data.lastErrorAt || '',
        status: 'ready',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString()
      })
    }
    this._writeProfiles(newProfiles)
    return newProfiles
  }

  createBatch(dataArray) {
    const profiles = this._readProfiles()
    const created = []
    for (const data of dataArray) {
      const newProfile = {
        id: uuidv4(),
        name: data.name || 'Untitled Profile',
        folder: data.folder || '',
        os: normalizeOs(data.os),
        browser: data.browser || 'Chrome',
        userAgent: data.userAgent || '',
        screenWidth: parseInt(data.screenWidth) || 1920,
        screenHeight: parseInt(data.screenHeight) || 1080,
        timezone: data.timezone || 'America/New_York',
        language: data.language || 'en-US',
        proxy: data.proxy || '',
        proxyType: data.proxyType || 'Without Proxy',
        proxyNetworkType: data.proxyNetworkType || '',
        proxyCountryCode: data.proxyCountryCode || '',
        proxyCountry: data.proxyCountry || '',
        notes: data.notes || '',
        tags: data.tags || '',
        startUrl: data.startUrl || '',
        webrtc: data.webrtc || 'Disabled',
        geolocation: data.geolocation || 'Prompt',
        geoLat: data.geoLat || '',
        geoLng: data.geoLng || '',
        geoAccuracy: data.geoAccuracy || '',
        browserDataSync: data.browserDataSync !== false,
        fakeCanvas: data.fakeCanvas !== false,
        fakeAudio: data.fakeAudio !== false,
        fakeWebGLImage: data.fakeWebGLImage !== false,
        fakeWebGLMetadata: data.fakeWebGLMetadata !== false,
        fakeClientRects: data.fakeClientRects || false,
        maskMediaDevices: data.maskMediaDevices !== false,
        mediaVideoInputs: sanitizeDeviceCount(data.mediaVideoInputs, 0),
        mediaAudioInputs: sanitizeDeviceCount(data.mediaAudioInputs, 0),
        mediaAudioOutputs: sanitizeDeviceCount(data.mediaAudioOutputs, 0),
        clearCache: data.clearCache !== false,
        restoreSession: data.restoreSession !== false,
        dontShowImages: data.dontShowImages || false,
        muteAudio: data.muteAudio || false,
        vpsCompatibilityMode: data.vpsCompatibilityMode || false,
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
        os: normalizeOs(options.userAgents ? source.os : 'Windows'),
        browser: options.userAgents ? source.browser : 'Chrome',
        userAgent: options.userAgents ? source.userAgent : '',
        screenWidth: options.fingerprint ? source.screenWidth : 1920,
        screenHeight: options.fingerprint ? source.screenHeight : 1080,
        timezone: source.timezone,
        language: source.language,
        proxy: options.proxy ? source.proxy : '',
        proxyType: options.proxy ? source.proxyType : 'Without Proxy',
        proxyNetworkType: options.proxy ? source.proxyNetworkType || '' : '',
        proxyCountryCode: options.proxy ? source.proxyCountryCode || '' : '',
        proxyCountry: options.proxy ? source.proxyCountry || '' : '',
        notes: source.notes,
        tags: source.tags,
        startUrl: source.startUrl,
        webrtc: options.webrtcGeo ? source.webrtc : 'Disabled',
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
        vpsCompatibilityMode: source.vpsCompatibilityMode || false,
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
    catch { return DEFAULT_FOLDERS }
  }
  _writeFolders(folders) {
    fs.writeFileSync(this.foldersFile, JSON.stringify(folders, null, 2))
  }

  _ensureDefaultFolders(folders) {
    const source = Array.isArray(folders) ? folders : []
    const used = new Set()
    const normalizedName = folder => String(folder?.name || '').trim().toLowerCase()
    const byName = name => source.find(folder => normalizedName(folder) === name)

    const defaults = DEFAULT_FOLDERS.map(defaultFolder => {
      const match = byName(defaultFolder.name.toLowerCase()) || source.find(folder => folder.id === defaultFolder.id)
      if (!match) return defaultFolder
      used.add(match.id)
      return { ...defaultFolder, ...match, id: match.id || defaultFolder.id, name: defaultFolder.name, isDefault: true }
    })

    return [
      ...defaults,
      ...source.filter(folder => !used.has(folder.id) && !DEFAULT_FOLDERS.some(defaultFolder => normalizedName(folder) === defaultFolder.name.toLowerCase()))
    ]
  }

  getFolders() {
    const folders = this._ensureDefaultFolders(this._readFolders())
    this._writeFolders(folders)
    return folders
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
      networkType: data.networkType || '',
      countryCode: data.countryCode || '',
      countryName: data.countryName || '',
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

  _extractChromiumVersion(value) {
    const match = String(value || '').match(/(?:Chrome|Chromium|HeadlessChrome|CriOS)\/(\d+(?:\.\d+){0,3})/)
    return match ? match[1] : ''
  }

  _normalizeBrowserVersion(version) {
    const parts = String(version || '').split('.').filter(Boolean)
    if (!parts.length) return ''
    while (parts.length < 4) parts.push('0')
    return parts.slice(0, 4).join('.')
  }

  _reduceBrowserVersion(version) {
    const normalized = this._normalizeBrowserVersion(version)
    const major = normalized.split('.')[0]
    return major ? `${major}.0.0.0` : ''
  }

  _isChromiumProfileBrowser(browser) {
    return ['Chrome', 'Brave', 'Edge', 'Opera', 'Yandex'].includes(browser || 'Chrome')
  }

  _shouldRefreshUserAgent(userAgent, browserVersion) {
    if (!userAgent) return true

    const uaVersion = this._extractChromiumVersion(userAgent)
    const uaMajor = parseInt(uaVersion.split('.')[0], 10)
    const browserMajor = parseInt(String(browserVersion || '').split('.')[0], 10)

    if (!uaMajor || !browserMajor) return false
    if (Math.abs(browserMajor - uaMajor) > 2) return true

    const reduced = this._reduceBrowserVersion(uaVersion)
    return Boolean(reduced && uaVersion !== reduced)
  }

  _resolveFingerprintBrowserVersion(browserName, browserVersion, browserSource) {
    const normalizedVersion = this._normalizeBrowserVersion(browserVersion)
    const major = parseInt(normalizedVersion.split('.')[0], 10)

    // The bundled Chromium binary reports a newer file version, but browser-engine
    // feature tests currently classify this fingerprint surface as Chrome 142.
    if (this._isChromiumProfileBrowser(browserName) && browserSource === 'packaged-chromium' && major >= 153) {
      return PROFILEO_FINGERPRINT_CHROMIUM_VERSION
    }

    return normalizedVersion || PROFILEO_FINGERPRINT_CHROMIUM_VERSION
  }

  _resolveUserAgent(profile, browserName, browserVersion, defaultUserAgent) {
    const os = profile.os || 'Windows'
    const normalizedVersion = this._normalizeBrowserVersion(browserVersion) || this._normalizeBrowserVersion(this._extractChromiumVersion(defaultUserAgent))
    const nativeUserAgent = String(defaultUserAgent || '')
      .replace('HeadlessChrome/', 'Chrome/')
      .replace(/Chrome\/[\d.]+/, `Chrome/${this._reduceBrowserVersion(normalizedVersion)}`)

    if (!this._shouldRefreshUserAgent(profile.userAgent, normalizedVersion)) {
      return profile.userAgent
    }

    if (os === 'Windows' && ['Chrome', 'Brave'].includes(browserName || 'Chrome') && nativeUserAgent.includes('Chrome/')) {
      return nativeUserAgent
    }

    if (this._isChromiumProfileBrowser(browserName)) {
      return this._generateUserAgent(os, browserName, normalizedVersion)
    }

    return profile.userAgent || nativeUserAgent || this._generateUserAgent(os, browserName, normalizedVersion)
  }

  _buildClientHintBrands(browserName, userAgent, majorVersion, fullVersion, full) {
    const version = full ? fullVersion : majorVersion
    const notBrandVersion = full ? '24.0.0.0' : '24'
    const brands = [
      { brand: 'Chromium', version }
    ]

    if (browserName === 'Edge' && userAgent.includes('Edg/')) {
      brands.push({ brand: 'Microsoft Edge', version })
    } else if (browserName === 'Opera' && userAgent.includes('OPR/')) {
      brands.push({ brand: 'Opera', version })
    } else {
      brands.push({ brand: 'Google Chrome', version })
    }

    brands.push({ brand: 'Not_A Brand', version: notBrandVersion })
    return brands
  }

  _getStableIndex(seed, size) {
    const hash = crypto.createHash('sha256').update(String(seed || 'profileo')).digest()
    return hash.readUInt32LE(0) % size
  }

  _getWebGLMask(profile) {
    const masksByOs = {
      Windows: [
        {
          vendor: 'Google Inc. (Intel)',
          renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)'
        },
        {
          vendor: 'Google Inc. (Intel)',
          renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005916) Direct3D11 vs_5_0 ps_5_0, D3D11)'
        },
        {
          vendor: 'Google Inc. (Intel)',
          renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A6) Direct3D11 vs_5_0 ps_5_0, D3D11)'
        },
        {
          vendor: 'Google Inc. (AMD)',
          renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)'
        }
      ],
      MacOS: [
        {
          vendor: 'Apple Inc.',
          renderer: 'Apple GPU'
        },
        {
          vendor: 'Intel Inc.',
          renderer: 'Intel Iris OpenGL Engine'
        }
      ],
      Linux: [
        {
          vendor: 'Google Inc. (Intel)',
          renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620, OpenGL 4.6)'
        },
        {
          vendor: 'Google Inc. (AMD)',
          renderer: 'ANGLE (AMD, AMD Radeon Graphics, OpenGL 4.6)'
        }
      ],
      Android: [
        {
          vendor: 'Qualcomm',
          renderer: 'Adreno (TM) 640'
        },
        {
          vendor: 'ARM',
          renderer: 'Mali-G78'
        }
      ],
      iOS: [
        {
          vendor: 'Apple Inc.',
          renderer: 'Apple GPU'
        }
      ]
    }

    const os = profile.os || 'Windows'
    const masks = masksByOs[os] || masksByOs.Windows
    return masks[this._getStableIndex(`${profile.id || profile.name || ''}:webgl`, masks.length)]
  }

  _makeStableId(seed) {
    return crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 32)
  }

  _getMediaDeviceMask(profile, { hideDevices = false } = {}) {
    if (hideDevices) {
      return {
        devices: [
          {
            kind: 'audioinput',
            label: '',
            deviceId: 'profileo-audio-input',
            groupId: 'profileo-default-media-group'
          },
          {
            kind: 'videoinput',
            label: '',
            deviceId: 'profileo-video-input',
            groupId: 'profileo-default-media-group'
          },
          {
            kind: 'audiooutput',
            label: '',
            deviceId: 'profileo-audio-output',
            groupId: 'profileo-default-media-group'
          }
        ]
      }
    }

    const devices = []
    const audioInputs = sanitizeDeviceCount(profile.mediaAudioInputs, 0)
    const videoInputs = sanitizeDeviceCount(profile.mediaVideoInputs, 0)
    const audioOutputs = sanitizeDeviceCount(profile.mediaAudioOutputs, 0)
    const seed = profile.id || profile.name || 'profileo'

    const addDevices = (kind, count) => {
      for (let index = 0; index < count; index += 1) {
        devices.push({
          kind,
          label: '',
          deviceId: this._makeStableId(`${seed}:${kind}:${index}:device`),
          groupId: this._makeStableId(`${seed}:${kind}:${index}:group`)
        })
      }
    }

    addDevices('audioinput', audioInputs)
    addDevices('videoinput', videoInputs)
    addDevices('audiooutput', audioOutputs)
    return { devices }
  }

  _getFingerprintPrivacyMask(profile, { blockWebRTC = false } = {}) {
    const strictMode = blockWebRTC || profile.fakeCanvas !== false || profile.fakeAudio !== false || profile.fakeWebGLMetadata !== false || profile.fakeWebGLImage !== false
    if (!strictMode) return null

    return {
      hardwareConcurrency: 4,
      deviceMemory: 4,
      blockBattery: true,
      blockCanvas: false,
      blockAudio: profile.fakeAudio !== false || blockWebRTC,
      blockWebGLDebug: profile.fakeWebGLMetadata !== false || blockWebRTC,
      reduceFonts: true
    }
  }

  // ─── User Agent Generator ───
  _generateUserAgent(os, browser, browserVersion = '') {
    const chromeVer = this._reduceBrowserVersion(browserVersion) || '153.0.0.0'
    const major = chromeVer.split('.')[0] || '153'

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
        const edgeVer = `${major}.0.0.0`
        if (os === 'iOS') {
          return `Mozilla/5.0 (${platform}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/${edgeVer} Mobile/15E148 Safari/604.1`
        }
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}${mobileSuffix} Safari/537.36 Edg/${edgeVer}`

      case 'Opera':
        const operaVer = `${major}.0.0.0`
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
  _findExecutableInTree(rootDir, executableName, maxDepth = 5) {
    if (!rootDir || !fs.existsSync(rootDir) || maxDepth < 0) return null

    const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(rootDir, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === executableName.toLowerCase()) {
        return entryPath
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const found = this._findExecutableInTree(path.join(rootDir, entry.name), executableName, maxDepth - 1)
      if (found) return found
    }

    return null
  }

  _getPackagedProfileoBrowserPath() {
    const candidates = []

    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, PROFILEO_BROWSER_RESOURCE_DIR))
    }

    candidates.push(path.join(process.cwd(), '.profileo-browsers-test', 'chromium'))

    for (const candidate of candidates) {
      const chromePath = this._findExecutableInTree(candidate, process.platform === 'win32' ? 'chrome.exe' : 'chrome')
      if (chromePath) return chromePath
    }

    return null
  }

  async _getCachedProfileoBrowserPath() {
    const cacheDir = path.join(this.dataDir, 'browsers')
    const installedBrowsers = await getInstalledBrowsers({ cacheDir })
    const installedChromium = installedBrowsers
      .filter(browser => browser.browser === Browser.CHROMIUM && fs.existsSync(browser.executablePath))
      .sort((a, b) => String(b.buildId).localeCompare(String(a.buildId), undefined, { numeric: true }))[0]

    if (installedChromium) return installedChromium.executablePath

    const platform = detectBrowserPlatform()
    if (!platform) throw new Error('Unsupported platform for Profileo browser')

    const buildId = await resolveBuildId(Browser.CHROMIUM, platform, BrowserTag.LATEST)
    const installedBrowser = await install({
      browser: Browser.CHROMIUM,
      buildId,
      buildIdAlias: 'profileo-stable',
      cacheDir,
      platform
    })

    return installedBrowser.executablePath
  }

  async _getProfileoBrowserPath() {
    if (!this.profileoBrowserPromise) {
      this.profileoBrowserPromise = (async () => {
        const packagedBrowser = this._getPackagedProfileoBrowserPath()
        if (packagedBrowser) return { executablePath: packagedBrowser, source: 'packaged-chromium' }

        const cachedBrowser = await this._getCachedProfileoBrowserPath()
        return { executablePath: cachedBrowser, source: 'cached-chromium' }
      })().finally(() => { this.profileoBrowserPromise = null })
    }

    return this.profileoBrowserPromise
  }

  async _getBrowserLaunchTarget(browser, requiresExtensions) {
    if (requiresExtensions) {
      try {
        return await this._getProfileoBrowserPath()
      } catch (error) {
        this._writeLaunchLog({
          browser,
          profileoBrowserError: error.message
        })
        throw new Error(`Profileo browser is required to load Nexus Wallet automatically, but it could not be prepared: ${error.message}`)
      }
    }

    return {
      executablePath: this._findBrowserPath(browser),
      source: 'system-browser'
    }
  }

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

  _isUsableExtensionDir(extensionDir) {
    const manifestPath = path.join(extensionDir, 'manifest.json')
    try {
      if (!fs.existsSync(manifestPath)) return false
      if (fs.existsSync(path.join(extensionDir, '_metadata'))) return false
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      return Boolean(manifest.manifest_version && manifest.name)
    } catch (_) {
      return false
    }
  }

  _findExtensionManifestDir(rootDir) {
    const rootManifest = path.join(rootDir, 'manifest.json')
    if (fs.existsSync(rootManifest)) return rootDir

    const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const childDir = path.join(rootDir, entry.name)
      if (fs.existsSync(path.join(childDir, 'manifest.json'))) return childDir
    }

    return null
  }

  _writeExtensionKeyIfAvailable(extensionDir, publicKeys, extensionConfig) {
    fs.rmSync(path.join(extensionDir, '_metadata'), { recursive: true, force: true })

    const manifestPath = path.join(extensionDir, 'manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const publicKey = selectPublicKeyForExtension(publicKeys, extensionConfig.id)

    if (publicKey && !manifest.key) {
      manifest.key = publicKey.toString('base64')
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    }

    if (publicKey) {
      const resolvedId = chromeExtensionIdFromPublicKey(publicKey)
      if (resolvedId !== extensionConfig.id) {
        console.warn(`${extensionConfig.name} loaded with extension id ${resolvedId}, expected ${extensionConfig.id}`)
      }
    }

    fs.writeFileSync(path.join(extensionDir, '.profileo-extension.json'), JSON.stringify({
      id: extensionConfig.id,
      name: extensionConfig.name,
      installedAt: new Date().toISOString(),
      source: 'chrome-web-store'
    }, null, 2))
  }

  async _ensureChromeWebStoreExtension(extensionConfig) {
    const extensionsRoot = path.join(this.dataDir, 'extensions')
    const targetDir = path.join(extensionsRoot, extensionConfig.cacheDirName)

    if (this._isUsableExtensionDir(targetDir)) return targetDir

    const downloadsDir = path.join(extensionsRoot, '_downloads')
    const stagingDir = path.join(extensionsRoot, `${extensionConfig.cacheDirName}-${process.pid}-${Date.now()}`)
    const zipPath = path.join(downloadsDir, `${extensionConfig.id}.zip`)

    fs.mkdirSync(downloadsDir, { recursive: true })
    fs.rmSync(stagingDir, { recursive: true, force: true })
    fs.mkdirSync(stagingDir, { recursive: true })

    try {
      if (typeof fetch !== 'function') throw new Error('Network fetch is not available in this runtime')
      const response = await fetch(getChromeWebStoreCrxUrl(extensionConfig.id), { redirect: 'follow' })
      if (!response.ok) throw new Error(`Chrome Web Store returned HTTP ${response.status}`)

      const crxBuffer = Buffer.from(await response.arrayBuffer())
      const { zipBuffer, publicKeys } = parseCrxPackage(crxBuffer)
      fs.writeFileSync(zipPath, zipBuffer)
      await extractZip(zipPath, { dir: stagingDir })

      const manifestDir = this._findExtensionManifestDir(stagingDir)
      if (!manifestDir) throw new Error('Downloaded package does not contain manifest.json')

      this._writeExtensionKeyIfAvailable(manifestDir, publicKeys, extensionConfig)

      fs.rmSync(targetDir, { recursive: true, force: true })
      if (manifestDir === stagingDir) {
        fs.renameSync(stagingDir, targetDir)
      } else {
        fs.renameSync(manifestDir, targetDir)
        fs.rmSync(stagingDir, { recursive: true, force: true })
      }

      return targetDir
    } catch (error) {
      fs.rmSync(stagingDir, { recursive: true, force: true })
      throw new Error(`${extensionConfig.name} could not be installed automatically: ${error.message}`)
    } finally {
      try { fs.rmSync(zipPath, { force: true }) } catch (_) {}
    }
  }

  _findBundledExtensionSourceDir(extensionConfig) {
    const candidates = getBundledResourceCandidates(extensionConfig.sourceDir)
    const sourceDir = candidates.find(candidate => this._isUsableExtensionDir(candidate))
    if (!sourceDir) {
      throw new Error(`${extensionConfig.name} source package was not found in bundled resources.`)
    }
    return sourceDir
  }

  _ensureBundledExtension(extensionConfig) {
    const extensionsRoot = path.join(this.dataDir, 'extensions')
    const targetDir = path.join(extensionsRoot, extensionConfig.cacheDirName)
    const sourceDir = this._findBundledExtensionSourceDir(extensionConfig)
    const sourceManifest = JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'))
    const markerPath = path.join(targetDir, '.profileo-extension.json')
    let marker = null

    try {
      marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
    } catch (_) {}

    if (
      this._isUsableExtensionDir(targetDir) &&
      marker &&
      marker.source === 'bundled' &&
      marker.version === sourceManifest.version &&
      marker.sourcePath === sourceDir
    ) {
      return targetDir
    }

    fs.mkdirSync(extensionsRoot, { recursive: true })
    fs.rmSync(targetDir, { recursive: true, force: true })
    fs.cpSync(sourceDir, targetDir, { recursive: true, force: true })
    fs.rmSync(path.join(targetDir, '_metadata'), { recursive: true, force: true })
    fs.writeFileSync(markerPath, JSON.stringify({
      name: extensionConfig.name,
      version: sourceManifest.version || '',
      source: 'bundled',
      sourcePath: sourceDir,
      installedAt: new Date().toISOString()
    }, null, 2))

    return targetDir
  }

  _getPrivacyShieldContentScript() {
    return `(() => {
  const defineGetter = (target, key, value) => {
    try {
      const getter = markNative(
        function() { return value; },
        'get ' + key,
        'function get ' + key + '() { [native code] }'
      );
      Object.defineProperty(target, key, {
        get: getter,
        configurable: true
      });
    } catch (_) {}
  };

  const defineValue = (target, key, value) => {
    try {
      Object.defineProperty(target, key, {
        value,
        configurable: true,
        writable: true
      });
    } catch (_) {}
  };

  const nativeToString = Function.prototype.toString;
  const nativeSource = new WeakMap();
  const markNative = (fn, name, source) => {
    if (typeof fn !== 'function') return fn;
    try { Object.defineProperty(fn, 'name', { value: name, configurable: true }); } catch (_) {}
    nativeSource.set(fn, source || 'function ' + name + '() { [native code] }');
    return fn;
  };

  try {
    Function.prototype.toString = new Proxy(nativeToString, {
      apply(target, ctx, args) {
        if (nativeSource.has(ctx)) return nativeSource.get(ctx);
        return Reflect.apply(target, ctx, args);
      }
    });
  } catch (_) {}

  try {
    Object.defineProperty(window, '__profileoPrivacyShield', {
      value: true,
      configurable: false
    });
  } catch (_) {}

  const navProto = Object.getPrototypeOf(navigator);
  const setWebdriverFalse = () => {
    defineGetter(Object.getPrototypeOf(navigator), 'webdriver', false);
    defineGetter(navigator, 'webdriver', false);
  };

  const automationGlobals = [
    'callSelenium',
    '_Selenium_IDE_Recorder',
    '_selenium',
    'calledSelenium',
    '__driver_evaluate',
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__fxdriver_evaluate',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped',
    '__webdriver_script_function',
    '__webdriver_script_func',
    '__webdriver_script_fn',
    '__webdriver_script_num',
    'domAutomation',
    'domAutomationController',
    '_phantom',
    'callPhantom',
    'Buffer',
    'emit',
    'spawn'
  ];

  const removeAutomationGlobals = () => {
    for (const key of automationGlobals) {
      try { delete window[key]; } catch (_) {}
      try { delete document[key]; } catch (_) {}
    }
    try {
      for (const key of Object.getOwnPropertyNames(window)) {
        const lower = String(key || '').toLowerCase();
        if (
          lower.includes('webdriver') ||
          lower.includes('selenium') ||
          lower.includes('chromedriver') ||
          lower.startsWith('cdc_') ||
          lower.startsWith('$cdc_')
        ) {
          try { delete window[key]; } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      for (const key of Object.getOwnPropertyNames(document)) {
        const lower = String(key || '').toLowerCase();
        if (
          lower.includes('webdriver') ||
          lower.includes('selenium') ||
          lower.includes('chromedriver') ||
          lower.startsWith('cdc_') ||
          lower.startsWith('$cdc_')
        ) {
          try { delete document[key]; } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      if (window.chrome && window.chrome.runtime) {
        defineGetter(window.chrome.runtime, 'id', undefined);
      }
    } catch (_) {}
  };

  const runEarlyCleanup = () => {
    setWebdriverFalse();
    removeAutomationGlobals();
  };

  runEarlyCleanup();
  try { queueMicrotask(runEarlyCleanup); } catch (_) {}
  try { setTimeout(runEarlyCleanup, 0); } catch (_) {}
  try { setTimeout(runEarlyCleanup, 50); } catch (_) {}
  try { setTimeout(runEarlyCleanup, 250); } catch (_) {}
  try {
    const cleanupUntil = Date.now() + 3000;
    const cleanupTimer = setInterval(() => {
      runEarlyCleanup();
      if (Date.now() > cleanupUntil) clearInterval(cleanupTimer);
    }, 25);
  } catch (_) {}

  defineGetter(navProto, 'hardwareConcurrency', 4);
  defineGetter(navigator, 'hardwareConcurrency', 4);
  defineGetter(navProto, 'deviceMemory', 4);
  defineGetter(navigator, 'deviceMemory', 4);
  defineGetter(navProto, 'languages', ['en-US', 'en']);
  defineGetter(navigator, 'languages', ['en-US', 'en']);
  defineGetter(navProto, 'doNotTrack', null);
  defineGetter(navigator, 'doNotTrack', null);

  try {
    const removeAutomationAttributes = () => {
      try {
        for (const attr of ['webdriver', 'selenium', 'driver']) {
          document.documentElement && document.documentElement.removeAttribute(attr);
          document.body && document.body.removeAttribute(attr);
        }
      } catch (_) {}
    };
    removeAutomationAttributes();
    document.addEventListener('DOMContentLoaded', removeAutomationAttributes, { once: true });
    window.addEventListener('load', removeAutomationAttributes, { once: true });
  } catch (_) {}

  try {
    const sanitizeConsoleValue = (value) => {
      if (typeof value === 'function') return '[function]';
      if (value && typeof value === 'object') {
        try {
          const ownStack = Object.getOwnPropertyDescriptor(value, 'stack');
          const proto = Object.getPrototypeOf(value);
          const protoStack = proto ? Object.getOwnPropertyDescriptor(proto, 'stack') : null;
          if ((ownStack && typeof ownStack.get === 'function') || (protoStack && typeof protoStack.get === 'function')) {
            return '[object Error]';
          }
        } catch (_) {
          return '[object Object]';
        }
        return Array.isArray(value) ? '[object Array]' : '[object Object]';
      }
      return value;
    };

    Object.defineProperty(window, 'devtoolsFormatters', {
      get: markNative(function() { return undefined; }, 'get devtoolsFormatters', 'function get devtoolsFormatters() { [native code] }'),
      set: markNative(function() { return true; }, 'set devtoolsFormatters', 'function set devtoolsFormatters() { [native code] }'),
      configurable: true
    });

    for (const key of ['debug', 'log', 'info', 'warn', 'error', 'dir', 'table', 'trace']) {
      const original = console && console[key];
      if (typeof original !== 'function') continue;
      const wrapped = markNative(function(...items) {
        return original.apply(this, items.map(sanitizeConsoleValue));
      }, key, nativeToString.call(original));
      defineValue(console, key, wrapped);
    }
  } catch (_) {}

  defineGetter(navProto, 'getBattery', undefined);
  defineGetter(navigator, 'getBattery', undefined);
  defineGetter(window, 'OfflineAudioContext', undefined);
  defineGetter(window, 'webkitOfflineAudioContext', undefined);
  defineGetter(window, 'queryLocalFonts', undefined);
  for (const key of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate']) {
    defineGetter(window, key, undefined);
  }

  try {
    if (navigator.mediaDevices) {
      const makeDevice = (kind, id) => ({
        kind,
        deviceId: id,
        groupId: 'profileo-default-media-group',
        label: '',
        toJSON() {
          return {
            kind: this.kind,
            deviceId: this.deviceId,
            groupId: this.groupId,
            label: this.label
          };
        }
      });

      const fakeDevices = [
        makeDevice('audioinput', 'profileo-audio-input'),
        makeDevice('videoinput', 'profileo-video-input'),
        makeDevice('audiooutput', 'profileo-audio-output')
      ];

      const enumerateDevices = markNative(
        () => Promise.resolve(fakeDevices.slice()),
        'enumerateDevices',
        'function enumerateDevices() { [native code] }'
      );
      defineValue(navigator.mediaDevices, 'enumerateDevices', enumerateDevices);

      const makeFallbackTrack = (kind) => {
        const track = {
          kind,
          id: 'profileo-' + kind + '-track',
          label: '',
          enabled: true,
          muted: false,
          readyState: 'live',
          stop() {
            this.readyState = 'ended';
          },
          clone() {
            return makeFallbackTrack(kind);
          },
          getSettings() {
            if (kind === 'audio') {
              return { deviceId: 'profileo-audio-input', sampleRate: 48000, channelCount: 2 };
            }
            return { deviceId: 'profileo-video-input', width: 640, height: 480, frameRate: 1 };
          },
          getCapabilities() { return {}; },
          getConstraints() { return {}; },
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() { return true; }
        };
        return track;
      };

      const makeSilentAudioTrack = () => {
        try {
          const AudioCtor = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtor) return makeFallbackTrack('audio');
          const ctx = new AudioCtor();
          const dest = ctx.createMediaStreamDestination();
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0;
          oscillator.connect(gain);
          gain.connect(dest);
          oscillator.start();
          const track = dest.stream.getAudioTracks()[0];
          if (!track) return makeFallbackTrack('audio');
          const originalStop = track.stop.bind(track);
          try {
            Object.defineProperty(track, 'stop', {
              value() {
                try { oscillator.stop(); } catch (_) {}
                try { ctx.close(); } catch (_) {}
                return originalStop();
              },
              configurable: true
            });
          } catch (_) {}
          return track;
        } catch (_) {
          return makeFallbackTrack('audio');
        }
      };

      const makeBlankVideoTrack = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          const stream = canvas.captureStream ? canvas.captureStream(1) : null;
          const track = stream && stream.getVideoTracks()[0];
          if (!track) return makeFallbackTrack('video');
          try {
            Object.defineProperty(track, '__profileoCanvas', {
              value: canvas,
              configurable: true
            });
          } catch (_) {}
          return track;
        } catch (_) {
          return makeFallbackTrack('video');
        }
      };

      const makeFakeStreamObject = (tracks) => ({
        id: 'profileo-media-stream',
        active: true,
        getTracks() { return tracks.slice(); },
        getAudioTracks() { return tracks.filter(track => track && track.kind === 'audio'); },
        getVideoTracks() { return tracks.filter(track => track && track.kind === 'video'); },
        addTrack(track) { tracks.push(track); },
        removeTrack(track) {
          const index = tracks.indexOf(track);
          if (index >= 0) tracks.splice(index, 1);
        },
        clone() {
          return makeFakeStreamObject(tracks.map(track => track && track.clone ? track.clone() : track));
        },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return true; }
      });

      const makeFakeMediaStream = (constraints) => {
        const wantsAudio = constraints === true || Boolean(constraints && constraints.audio);
        const wantsVideo = constraints === true || Boolean(constraints && constraints.video);
        const tracks = [];
        if (wantsAudio) tracks.push(makeSilentAudioTrack());
        if (wantsVideo) tracks.push(makeBlankVideoTrack());
        if (!tracks.length) tracks.push(makeBlankVideoTrack());

        try {
          if (typeof MediaStream === 'function' && tracks.every(track => typeof MediaStreamTrack === 'function' && track instanceof MediaStreamTrack)) {
            return new MediaStream(tracks);
          }
        } catch (_) {}
        return makeFakeStreamObject(tracks);
      };

      const getUserMedia = markNative(
        (constraints) => Promise.resolve(makeFakeMediaStream(constraints || {})),
        'getUserMedia',
        'function getUserMedia() { [native code] }'
      );
      defineValue(navigator.mediaDevices, 'getUserMedia', getUserMedia);
    }
  } catch (_) {}

  try {
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query.bind(navigator.permissions);
      const makePermissionStatus = (name) => ({
        name,
        state: 'granted',
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return true; }
      });
      const query = markNative(
        (descriptor) => {
          const name = String((descriptor && descriptor.name) || '').toLowerCase();
          if (name === 'camera' || name === 'microphone') {
            return Promise.resolve(makePermissionStatus(name));
          }
          return originalQuery(descriptor);
        },
        'query',
        'function query() { [native code] }'
      );
      defineValue(navigator.permissions, 'query', query);
    }
  } catch (_) {}

  try {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'offsetWidth');
    if (descriptor && descriptor.get) {
      const originalOffsetWidth = descriptor.get;
      const maskedOffsetWidth = markNative(function() {
        try {
          const style = this.style || {};
          const text = String(this.textContent || '');
          if (
            text === 'mmmmmmmmwwwwwwwwllllll' &&
            String(style.fontSize || '') === '72px' &&
            String(style.position || '') === 'absolute' &&
            String(style.left || '') === '-9999px'
          ) {
            const family = String(style.fontFamily || '').toLowerCase();
            if (family.includes('monospace')) return 1100;
            if (family.includes('serif') && !family.includes('sans-serif')) return 980;
            return 1030;
          }
        } catch (_) {}
        return originalOffsetWidth.call(this);
      }, 'get offsetWidth', 'function get offsetWidth() { [native code] }');

      Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {
        get: maskedOffsetWidth,
        configurable: true
      });
    }
  } catch (_) {}

  const patchWebGL = (proto) => {
    if (!proto) return;

    if (proto.getExtension) {
      const originalGetExtension = proto.getExtension;
      const getExtension = markNative(function(name) {
        if (String(name || '').toUpperCase() === 'WEBGL_DEBUG_RENDERER_INFO') return null;
        return originalGetExtension.apply(this, arguments);
      }, 'getExtension', nativeToString.call(originalGetExtension));
      defineValue(proto, 'getExtension', getExtension);
    }

    if (proto.getParameter) {
      const originalGetParameter = proto.getParameter;
      const getParameter = markNative(function(parameter) {
        if (parameter === 37445) return 'Google Inc. (Intel)';
        if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005916) Direct3D11 vs_5_0 ps_5_0, D3D11)';
        return originalGetParameter.apply(this, arguments);
      }, 'getParameter', nativeToString.call(originalGetParameter));
      defineValue(proto, 'getParameter', getParameter);
    }
  };

  try { patchWebGL(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype); } catch (_) {}
  try { patchWebGL(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype); } catch (_) {}
})();`
  }

  _getPrivacyShieldBackgroundScript() {
    return `const applyWebRTCPolicy = () => {
  try {
    const setting = chrome &&
      chrome.privacy &&
      chrome.privacy.network &&
      chrome.privacy.network.webRTCIPHandlingPolicy;

    if (!setting || typeof setting.set !== 'function') return;

    setting.set({ value: 'disable_non_proxied_udp', scope: 'regular' }, () => {
      try { chrome.runtime.lastError; } catch (_) {}
    });
  } catch (_) {}
};

applyWebRTCPolicy();
try { chrome.runtime.onInstalled.addListener(applyWebRTCPolicy); } catch (_) {}
try { chrome.runtime.onStartup.addListener(applyWebRTCPolicy); } catch (_) {}
`
  }

  _getWebRTCGuardContentScript() {
    return `(() => {
  // Strict privacy mode: do not allow sites to create WebRTC peer connections.
  // This prevents direct ICE/STUN traffic from bypassing an HTTP proxy.
  const blockConstructor = (key) => {
    try {
      Object.defineProperty(window, key, {
        value: undefined,
        writable: false,
        configurable: false
      });
    } catch (_) {
      try { window[key] = undefined; } catch (_) {}
    }
  };

  for (const key of ['RTCPeerConnection', 'webkitRTCPeerConnection']) {
    blockConstructor(key);
  }

  // Battery state is a high-entropy fingerprinting signal and is rarely needed
  // for standard browsing. Leave all other browser hardware APIs untouched.
  try {
    Object.defineProperty(Navigator.prototype, 'getBattery', {
      value: undefined,
      writable: false,
      configurable: false
    });
  } catch (_) {
    try { navigator.getBattery = undefined; } catch (_) {}
  }
})();`
  }

  _enableDoNotTrack(userDataDir) {
    try {
      const profileDir = path.join(userDataDir, 'Default')
      const preferencesPath = path.join(profileDir, 'Preferences')
      const preferences = fs.existsSync(preferencesPath)
        ? JSON.parse(fs.readFileSync(preferencesPath, 'utf8'))
        : {}

      if (preferences.enable_do_not_track === true) return
      preferences.enable_do_not_track = true
      fs.mkdirSync(profileDir, { recursive: true })
      fs.writeFileSync(preferencesPath, JSON.stringify(preferences))
    } catch (_) {}
  }

  _ensureWebRTCGuardExtension() {
    const extensionDir = path.join(this.dataDir, 'extensions', PROFILEO_WEBRTC_GUARD_EXTENSION.cacheDirName)
    const manifestPath = path.join(extensionDir, 'manifest.json')
    const contentPath = path.join(extensionDir, 'content.js')
    const manifest = {
      manifest_version: 3,
      name: PROFILEO_WEBRTC_GUARD_EXTENSION.name,
      version: PROFILEO_WEBRTC_GUARD_EXTENSION.version,
      minimum_chrome_version: '111',
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['content.js'],
          run_at: 'document_start',
          all_frames: true,
          world: 'MAIN'
        }
      ]
    }
    const content = this._getWebRTCGuardContentScript()
    const nextManifest = JSON.stringify(manifest, null, 2)
    const currentManifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : ''
    const currentContent = fs.existsSync(contentPath) ? fs.readFileSync(contentPath, 'utf8') : ''

    if (currentManifest !== nextManifest || currentContent !== content) {
      fs.mkdirSync(extensionDir, { recursive: true })
      fs.writeFileSync(manifestPath, nextManifest)
      fs.writeFileSync(contentPath, content)
    }

    return extensionDir
  }

  _ensurePrivacyShieldExtension() {
    const extensionDir = path.join(this.dataDir, 'extensions', PROFILEO_PRIVACY_SHIELD_EXTENSION.cacheDirName)
    const manifestPath = path.join(extensionDir, 'manifest.json')
    const contentPath = path.join(extensionDir, 'content.js')
    const backgroundPath = path.join(extensionDir, 'background.js')
    const manifest = {
      manifest_version: 3,
      name: PROFILEO_PRIVACY_SHIELD_EXTENSION.name,
      version: PROFILEO_PRIVACY_SHIELD_EXTENSION.version,
      minimum_chrome_version: '111',
      permissions: ['privacy'],
      background: {
        service_worker: 'background.js'
      },
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['content.js'],
          run_at: 'document_start',
          all_frames: true,
          world: 'MAIN'
        }
      ]
    }
    const content = this._getPrivacyShieldContentScript()
    const background = this._getPrivacyShieldBackgroundScript()
    const currentManifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : ''
    const nextManifest = JSON.stringify(manifest, null, 2)
    const currentContent = fs.existsSync(contentPath) ? fs.readFileSync(contentPath, 'utf8') : ''
    const currentBackground = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath, 'utf8') : ''

    if (currentManifest !== nextManifest || currentContent !== content || currentBackground !== background) {
      fs.mkdirSync(extensionDir, { recursive: true })
      fs.writeFileSync(manifestPath, nextManifest)
      fs.writeFileSync(contentPath, content)
      fs.writeFileSync(backgroundPath, background)
    }

    return extensionDir
  }

  _removeGeneratedExtensionCache(extensionConfig) {
    try {
      fs.rmSync(path.join(this.dataDir, 'extensions', extensionConfig.cacheDirName), {
        recursive: true,
        force: true
      })
    } catch (_) {}
  }

  _removeProfileExtensionState(userDataDir, extensionConfig) {
    const prefsFiles = [
      path.join(userDataDir, 'Default', 'Preferences'),
      path.join(userDataDir, 'Default', 'Secure Preferences')
    ]
    const cacheNeedle = String(extensionConfig.cacheDirName || '').toLowerCase()
    const nameNeedle = String(extensionConfig.name || '').toLowerCase()

    for (const prefsFile of prefsFiles) {
      try {
        if (!fs.existsSync(prefsFile)) continue
        const prefs = JSON.parse(fs.readFileSync(prefsFile, 'utf8'))
        const settings = prefs.extensions && prefs.extensions.settings
        const removedIds = []
        let changed = false

        if (settings && typeof settings === 'object') {
          for (const [extensionId, setting] of Object.entries(settings)) {
            const manifestName = String((setting && setting.manifest && setting.manifest.name) || '').toLowerCase()
            const sourcePath = String((setting && setting.path) || '').toLowerCase()
            const manifestText = JSON.stringify((setting && setting.manifest) || {}).toLowerCase()
            if (
              manifestName === nameNeedle ||
              sourcePath.includes(cacheNeedle) ||
              manifestText.includes(nameNeedle)
            ) {
              delete settings[extensionId]
              removedIds.push(extensionId)
              changed = true
            }
          }
        }

        if (removedIds.length && prefs.extensions) {
          for (const key of ['commands', 'content_settings', 'state_store', 'toolbar']) {
            const container = prefs.extensions[key]
            if (!container || typeof container !== 'object') continue
            for (const extensionId of removedIds) {
              if (Object.prototype.hasOwnProperty.call(container, extensionId)) {
                delete container[extensionId]
                changed = true
              }
            }
          }
        }

        if (changed) {
          fs.writeFileSync(prefsFile, JSON.stringify(prefs))
        }
      } catch (_) {}
    }
  }

  async _getDefaultExtensionPaths({ strictWebRTC = false } = {}) {
    if (!this.defaultExtensionsPromise) {
      this.defaultExtensionsPromise = Promise.all([
        this._ensureChromeWebStoreExtension(NEXUS_WALLET_EXTENSION),
        this._ensureBundledExtension(PROFILEO_AUTO_CLICK_EXTENSION)
      ])
        .finally(() => { this.defaultExtensionsPromise = null })
    }
    const extensionPaths = await this.defaultExtensionsPromise
    return strictWebRTC
      ? [...extensionPaths, this._ensureWebRTCGuardExtension()]
      : extensionPaths
  }

  async _enableStrictProxyLock(chromePath) {
    if (await this.windowsProxyLock.isEnabledFor(chromePath)) return { changed: false }

    const approved = typeof this.confirmStrictProxyLock === 'function'
      ? await this.confirmStrictProxyLock()
      : false
    if (!approved) {
      throw new Error('Strict Proxy Lock was not enabled, so the profile was not started without protection.')
    }

    try {
      return await this.windowsProxyLock.enableFor(chromePath)
    } catch (error) {
      throw new Error(`Strict Proxy Lock could not be enabled: ${error.message}`)
    }
  }

  async _disableStrictProxyLock(chromePath) {
    try {
      return await this.windowsProxyLock.disableFor(chromePath)
    } catch (error) {
      throw new Error(`Strict Proxy Lock could not be removed: ${error.message}`)
    }
  }

  _getVpsCompatibilityFlags(profile) {
    if (!profile?.vpsCompatibilityMode) return []

    return [
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
      '--enable-accelerated-2d-canvas',
      '--enable-webgl',
      '--enable-webgl2',
      '--use-angle=d3d11'
    ]
  }

  async _launchAndroidProfile(profileId, profile, options = {}) {
    let controller
    try {
      controller = await this.androidEmulatorManager.launchProfile(profile, {
        hidden: Boolean(options.hidden)
      })
    } catch (error) {
      this._writeLaunchLog({
        profileId,
        mode: 'android-emulator',
        launchError: error.message
      })
      throw new Error(`Could not start Android emulator: ${error.message}`)
    }

    const clearRunning = () => {
      if (this.runningBrowsers.get(profileId) === controller) {
        this.runningBrowsers.delete(profileId)
        this._touchProfileActivity(profileId, 'stopped')
        if (this.onBrowserStopped) this.onBrowserStopped(profileId)
      }
    }

    this.runningBrowsers.set(profileId, controller)
    this._touchProfileActivity(profileId, 'launched')
    this._writeLaunchLog({
      profileId,
      mode: 'android-emulator',
      avdName: controller.avdName,
      serial: controller.serial,
      port: controller.port,
      scopedAvd: controller.scoped,
      hidden: controller.hidden
    })

    controller.process.once('error', error => {
      this._writeLaunchLog({
        profileId,
        mode: 'android-emulator',
        launchError: error.message
      })
      clearRunning()
    })

    controller.process.once('exit', () => {
      clearRunning()
    })

    controller.ready
      .then(result => {
        this._writeLaunchLog({
          profileId,
          mode: 'android-emulator',
          ready: true,
          avdName: controller.avdName,
          serial: controller.serial,
          startUrl: result.url,
          hidden: controller.hidden,
          hasProxy: result.proxy,
          proxyAuthentication: result.proxyAuthWarning ? 'not-supported-by-android-global-proxy' : 'none',
          webrtcPolicy: result.webrtcPolicy,
          androidWebRTCFirewall: result.firewall,
          androidBundledApps: result.bundledApps,
          androidChromePackages: result.chromePackages,
          androidAppPackages: result.androidAppPackages,
          androidProtectedPackages: result.protectedPackages,
          androidProtectedScope: result.protectedScope,
          androidProtectedPackageCount: result.protectedPackageCount,
          androidChromeUids: result.uids
        })
      })
      .catch(async error => {
        this._writeLaunchLog({
          profileId,
          mode: 'android-emulator',
          readyError: error.message
        })
        try { await controller.close() } catch (_) {}
        clearRunning()
      })

    return {
      success: true,
      mode: 'android-emulator',
      avdName: controller.avdName,
      serial: controller.serial,
      hidden: controller.hidden
    }
  }

  async launchBrowser(profileId, { mode = 'standard' } = {}) {
    if (this.runningBrowsers.has(profileId)) {
      return { success: false, error: 'Profile already running' }
    }

    const profiles = this._readProfiles()
    const profile = profiles.find(p => p.id === profileId)
    if (!profile) throw new Error('Profile not found')

    if (profile.os === 'Android') {
      return this._launchAndroidProfile(profileId, profile, { hidden: mode === 'automation' })
    }

    if (mode === 'automation') {
      return this._launchControlledBrowser(profileId)
    }

    const profileBrowserName = profile.browser || 'Chrome'
    const userDataDir = path.join(this.profilesDir, profileId)
    const isMobile = profile.os === 'Android' || profile.os === 'iOS'
    const winW = isMobile ? (profile.screenWidth || 412) : (profile.screenWidth || 1920)
    const winH = isMobile ? (profile.screenHeight || 915) : (profile.screenHeight || 1080)
    const isFirstLaunch = !fs.existsSync(path.join(userDataDir, 'Default'))

    let proxyServer = ''
    let proxyHost = ''
    let proxyPort = ''
    let proxyUser = ''
    let proxyPass = ''
    if (profile.proxy && profile.proxyType !== 'Without Proxy') {
      const parts = profile.proxy.split(':')
      if (parts.length >= 2) {
        proxyHost = parts[0]
        proxyPort = parts[1]
        proxyServer = `${proxyHost}:${proxyPort}`
        if (parts.length >= 4) {
          proxyUser = parts[2]
          proxyPass = parts[3]
        }
      }
      const proxyProtocol = profile.proxyType === 'SOCKS4' ? 'socks4' :
        profile.proxyType === 'SOCKS5' ? 'socks5' : 'http'
      if (proxyServer) proxyServer = `${proxyProtocol}://${proxyServer}`
    }

    const args = [
      `--user-data-dir=${userDataDir}`,
      `--window-size=${winW},${winH}`,
      `--lang=${profile.language || 'en-US'}`,
      '--test-type',
      '--disable-infobars',
      '--new-window'
    ]

    if (profile.vpsCompatibilityMode) {
      args.push(...this._getVpsCompatibilityFlags(profile))
      args.push('--disable-features=CalculateNativeWinOcclusion')
    }

    const strictWebRTC = profile.webrtc !== 'Real'
    if (strictWebRTC && proxyServer && profile.proxyType !== 'HTTP') {
      throw new Error('Strict Proxy Lock currently requires an HTTP proxy. This profile was not started because SOCKS traffic cannot be locked through the local relay yet.')
    }
    if (strictWebRTC) this._enableDoNotTrack(userDataDir)
    const defaultExtensionPaths = await this._getDefaultExtensionPaths({ strictWebRTC })
    if (defaultExtensionPaths.length > 0) {
      const chromeExtensionPaths = defaultExtensionPaths.map(extensionPath => extensionPath.replace(/\\/g, '/'))
      args.push(`--disable-extensions-except=${chromeExtensionPaths.join(',')}`)
      args.push(`--load-extension=${chromeExtensionPaths.join(',')}`)
    }

    const launchTarget = strictWebRTC
      ? await this._getProfileoBrowserPath()
      : { executablePath: this._findBrowserPath(profileBrowserName), source: 'system-browser' }
    const chromePath = launchTarget.executablePath

    let proxyRelay = null
    if (proxyServer && profile.proxyType === 'HTTP') {
      try {
        proxyRelay = new HttpProxyRelay({
          host: proxyHost,
          port: proxyPort,
          username: proxyUser,
          password: proxyPass
        })
        const relayPort = await proxyRelay.start()
        proxyServer = `http://127.0.0.1:${relayPort}`
      } catch (error) {
        proxyRelay?.close()
        throw new Error(`Could not prepare the local proxy relay: ${error.message}`)
      }
    }

    if (proxyServer) args.push(`--proxy-server=${proxyServer}`)
    const strictProxyLock = strictWebRTC && Boolean(proxyRelay)
    if (strictProxyLock) {
      try {
        await this._enableStrictProxyLock(chromePath)
      } catch (error) {
        proxyRelay?.close()
        throw error
      }
      // The relay remains on 127.0.0.1. The Windows Firewall rule blocks all
      // direct Internet traffic from Chromium, including worker-created WebRTC.
      args.push('--disable-quic')
      args.push('--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1')
    } else {
      // A previous proxy profile may have left the bundled browser blocked by
      // the dedicated firewall rule. Remove only Profileo's rule before a
      // direct or non-locked launch so it can reach the Internet again.
      await this._disableStrictProxyLock(chromePath)
    }
    if (strictWebRTC) {
      // Keep Chromium's network policy as a second layer behind the strict API block.
      args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp')
      args.push('--enforce-webrtc-ip-permission-check')
    }
    if (!isFirstLaunch && profile.restoreSession !== false) args.push('--restore-last-session')

    const startUrl = profile.startUrl || (isFirstLaunch ? 'https://ipfighter.com' : '')
    if (startUrl) args.push(startUrl)

    let child
    try {
      child = spawn(chromePath, args, { windowsHide: false, stdio: 'ignore' })
    } catch (error) {
      throw new Error(`Could not start the standard browser: ${error.message}`)
    }

    const nativeBrowser = {
      kind: 'native',
      process: child,
      close: async () => {
        if (!child.killed && child.exitCode === null) child.kill()
        proxyRelay?.close()
      }
    }

    this.runningBrowsers.set(profileId, nativeBrowser)
    this._touchProfileActivity(profileId, 'launched')
    this._writeLaunchLog({
      profileId,
      mode: 'standard',
      chromePath,
      browserSource: launchTarget.source,
      hasNexusWallet: defaultExtensionPaths.some(p => p.includes(NEXUS_WALLET_EXTENSION.cacheDirName)),
      hasAutoClickRecorder: defaultExtensionPaths.some(p => p.includes(PROFILEO_AUTO_CLICK_EXTENSION.cacheDirName)),
      strictWebRTC,
      vpsCompatibilityMode: profile.vpsCompatibilityMode || false,
      hasWebRTCGuard: defaultExtensionPaths.some(p => p.includes(PROFILEO_WEBRTC_GUARD_EXTENSION.cacheDirName)),
      hasProxy: Boolean(proxyServer),
      proxyAuthentication: proxyRelay ? 'local-relay' : (proxyUser && proxyPass ? 'browser-prompt' : 'none'),
      strictProxyLock,
      webrtcPolicy: strictWebRTC ? (strictProxyLock ? 'network-lock' : 'page-api-guard') : 'real',
      args
    })

    child.once('error', error => {
      proxyRelay?.close()
      this.runningBrowsers.delete(profileId)
      this._touchProfileActivity(profileId, 'error')
      this._writeLaunchLog({ profileId, mode: 'standard', launchError: error.message })
      if (this.onBrowserStopped) this.onBrowserStopped(profileId)
    })
    child.once('exit', () => {
      proxyRelay?.close()
      this.runningBrowsers.delete(profileId)
      this._touchProfileActivity(profileId, 'stopped')
      if (this.onBrowserStopped) this.onBrowserStopped(profileId)
    })

    return { success: true, mode: 'standard' }
  }

  async _launchControlledBrowser(profileId) {
    if (this.runningBrowsers.has(profileId)) {
      return { success: false, error: 'Profile already running' }
    }

    const profiles = this._readProfiles()
    const profile = profiles.find(p => p.id === profileId)
    if (!profile) throw new Error('Profile not found')

    const profileBrowserName = profile.browser || 'Chrome'
    const userDataDir = path.join(this.profilesDir, profileId)

    this._removeGeneratedExtensionCache(PROFILEO_PRIVACY_SHIELD_EXTENSION)
    this._removeProfileExtensionState(userDataDir, PROFILEO_PRIVACY_SHIELD_EXTENSION)

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

    // Check if this is the first time launching this profile
    const isFirstLaunch = !fs.existsSync(path.join(userDataDir, 'Default'))

    // Load saved session URLs for session restore
    const sessionFile = path.join(userDataDir, '_lastSession.json')
    let lastSessionUrls = []
    if (!isFirstLaunch && profile.restoreSession !== false) {
      try {
        lastSessionUrls = JSON.parse(fs.readFileSync(sessionFile, 'utf8'))
      } catch (_) {}
    }

    // MINIMAL Chrome flags - no automation tells
    // ignoreDefaultArgs: true removes ALL puppeteer defaults like:
    // --disable-extensions, --disable-component-extensions, --metrics-recording-only,
    // --disable-default-apps, --disable-hang-monitor, --password-store=basic, etc.
    // These are well-known automation flags that Cloudflare detects.
    const disableFeatures = ['ExtensionsMenuAccessControl']
    if (profile.vpsCompatibilityMode) disableFeatures.push('CalculateNativeWinOcclusion')

    const args = [
      `--user-data-dir=${userDataDir}`,
      `--window-size=${winW},${winH}`,
      `--lang=${profile.language}`,
      '--new-window',
      '--test-type',
      '--disable-infobars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      `--disable-features=${disableFeatures.join(',')}`,
      // Prevent Chrome from showing "crashed" bubbles on unclean exit
      '--disable-breakpad',
      // Keep background throttling prevention for functionality
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ]

    if (profile.vpsCompatibilityMode) {
      args.push(...this._getVpsCompatibilityFlags(profile))
    }

    const defaultExtensionPaths = await this._getDefaultExtensionPaths()
    const launchTarget = await this._getBrowserLaunchTarget(profileBrowserName, defaultExtensionPaths.length > 0)
    const chromePath = launchTarget.executablePath
    if (defaultExtensionPaths.length > 0) {
      const chromeExtensionPaths = defaultExtensionPaths.map(extensionPath => extensionPath.replace(/\\/g, '/'))
      args.push(`--disable-extensions-except=${chromeExtensionPaths.join(',')}`)
      args.push(`--load-extension=${chromeExtensionPaths.join(',')}`)
    }

    if (proxyServer) {
      args.push(`--proxy-server=${proxyServer}`)
    }
    if (profile.muteAudio) {
      args.push('--mute-audio')
    }
    if (profile.dontShowImages) {
      args.push('--blink-settings=imagesEnabled=false')
    }

    const blockWebRTC = profile.webrtc !== 'Real'
    if (blockWebRTC) {
      args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp')
      args.push('--enforce-webrtc-ip-permission-check')
    }

    // Start on a neutral page so Chromium does not briefly show its New Tab UI.
    args.push('about:blank')

    const browser = await puppeteerExtra.launch({
      executablePath: chromePath,
      headless: false,
      defaultViewport: null,
      ignoreDefaultArgs: true,
      env: {
        ...process.env,
        GOOGLE_API_KEY: 'no',
        GOOGLE_DEFAULT_CLIENT_ID: 'no',
        GOOGLE_DEFAULT_CLIENT_SECRET: 'no'
      },
      args
    })

    const browserVersionText = await browser.version().catch(() => '')
    const browserFullVersion = this._normalizeBrowserVersion(this._extractChromiumVersion(browserVersionText))
    const defaultUserAgent = await browser.userAgent().catch(() => '')
    const fingerprintBrowserFullVersion = this._resolveFingerprintBrowserVersion(profileBrowserName, browserFullVersion, launchTarget.source)
    const previousUserAgent = profile.userAgent || ''
    const userAgent = this._resolveUserAgent(profile, profileBrowserName, fingerprintBrowserFullVersion, defaultUserAgent)

    if (userAgent && previousUserAgent !== userAgent) {
      const latestProfiles = this._readProfiles()
      const idx = latestProfiles.findIndex(p => p.id === profileId)
      if (idx !== -1) {
        latestProfiles[idx].userAgent = userAgent
        latestProfiles[idx].updatedAt = new Date().toISOString()
        this._writeProfiles(latestProfiles)
      }
      profile.userAgent = userAgent
    }

    const userAgentVersion = this._normalizeBrowserVersion(this._extractChromiumVersion(userAgent))
    const userAgentMajor = (userAgentVersion || fingerprintBrowserFullVersion || browserFullVersion || PROFILEO_FINGERPRINT_CHROMIUM_VERSION).split('.')[0]
    const clientHintFullVersion = fingerprintBrowserFullVersion && fingerprintBrowserFullVersion.split('.')[0] === userAgentMajor
      ? fingerprintBrowserFullVersion
      : (userAgentVersion || `${userAgentMajor}.0.0.0`)
    const webGLMask = profile.fakeWebGLMetadata !== false ? this._getWebGLMask(profile) : null
    const mediaDeviceMask = (profile.maskMediaDevices !== false || blockWebRTC)
      ? this._getMediaDeviceMask(profile, { hideDevices: blockWebRTC })
      : null
    const fingerprintPrivacyMask = this._getFingerprintPrivacyMask(profile, { blockWebRTC })
    const privacyShieldScript = (blockWebRTC || fingerprintPrivacyMask)
      ? this._getPrivacyShieldContentScript()
      : ''

    this._writeLaunchLog({
      profileId,
      chromePath,
      browserSource: launchTarget.source,
      browserVersion: browserVersionText,
      browserFullVersion,
      fingerprintBrowserFullVersion,
      defaultUserAgent,
      previousUserAgent,
      userAgent,
      userAgentUpdated: previousUserAgent !== userAgent,
      userDataDir,
      defaultExtensionPaths,
      hasNexusWallet: defaultExtensionPaths.some(p => p.includes(NEXUS_WALLET_EXTENSION.cacheDirName)),
      hasAutoClickRecorder: defaultExtensionPaths.some(p => p.includes(PROFILEO_AUTO_CLICK_EXTENSION.cacheDirName)),
      webrtcMode: profile.webrtc || 'Disabled',
      blockWebRTC,
      vpsCompatibilityMode: profile.vpsCompatibilityMode || false,
      webGLMask,
      mediaDeviceMask,
      fingerprintPrivacyMask,
      privacyShieldInjected: Boolean(privacyShieldScript),
      args
    })

    const profileLang = profile.language || 'en-US'

    // Platform data to make navigator.platform + Client Hints match the user agent OS
    const platformMap = {
      'Windows': { nav: 'Win32', ua: 'Windows', ver: '15.0.0', mobile: false, arch: 'x86', model: '' },
      'MacOS': { nav: 'MacIntel', ua: 'macOS', ver: '14.5.0', mobile: false, arch: 'x86', model: '' },
      'Linux': { nav: 'Linux x86_64', ua: 'Linux', ver: '6.5.0', mobile: false, arch: 'x86', model: '' },
      'Android': { nav: 'Linux armv81', ua: 'Android', ver: '14.0.0', mobile: true, arch: 'arm', model: '' },
      'iOS': { nav: 'iPhone', ua: 'iOS', ver: '17.5.0', mobile: true, arch: 'arm', model: 'iPhone' }
    }

    const setupPage = async (page) => {
      try {
        if (privacyShieldScript) {
          await page.evaluateOnNewDocument(privacyShieldScript)
          try {
            const initSession = await page.target().createCDPSession()
            await initSession.send('Page.addScriptToEvaluateOnNewDocument', { source: privacyShieldScript })
            await initSession.detach()
          } catch (_) {}
          try {
            await page.evaluate(privacyShieldScript)
          } catch (_) {}
        }

        await page.evaluateOnNewDocument((shouldBlockWebRTC, webGLMetadataMask, mediaDevicesMask, privacyMask) => {
          const setWebdriverFalse = () => {
            if (window.__profileoPrivacyShield) return
            try {
              Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
                get: () => false,
                configurable: true
              })
            } catch (_) {}
            try {
              Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
                configurable: true
              })
            } catch (_) {}
          }
          setWebdriverFalse()
          try { queueMicrotask(setWebdriverFalse) } catch (_) {}
          try { setTimeout(setWebdriverFalse, 0) } catch (_) {}

          if (privacyMask && !window.__profileoPrivacyShield) {
            const navProto = Object.getPrototypeOf(navigator)
            const defineNavigatorGetter = (key, value) => {
              try {
                Object.defineProperty(navProto, key, {
                  get: () => value,
                  configurable: true
                })
              } catch (_) {}
              try {
                Object.defineProperty(navigator, key, {
                  get: () => value,
                  configurable: true
                })
              } catch (_) {}
            }

            try { defineNavigatorGetter('hardwareConcurrency', privacyMask.hardwareConcurrency || 4) } catch (_) {}
            try { defineNavigatorGetter('deviceMemory', privacyMask.deviceMemory || 4) } catch (_) {}

            if (privacyMask.blockBattery) {
              try {
                Object.defineProperty(navProto, 'getBattery', {
                  get: () => undefined,
                  configurable: true
                })
              } catch (_) {}
              try {
                Object.defineProperty(navigator, 'getBattery', {
                  get: () => undefined,
                  configurable: true
                })
              } catch (_) {}
            }

            try {
              if ('queryLocalFonts' in window) {
                Object.defineProperty(window, 'queryLocalFonts', {
                  get: () => undefined,
                  configurable: true
                })
              }
            } catch (_) {}

            if (privacyMask.reduceFonts && window.HTMLElement) {
              try {
                const descriptor = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'offsetWidth')
                if (descriptor && descriptor.get && !descriptor.get.__profileoFontMask) {
                  const originalOffsetWidth = descriptor.get
                  const maskedOffsetWidth = function() {
                    try {
                      const style = this.style || {}
                      const text = String(this.textContent || '')
                      const fontSize = String(style.fontSize || '')
                      const position = String(style.position || '')
                      const left = String(style.left || '')
                      if (text === 'mmmmmmmmwwwwwwwwllllll' && fontSize === '72px' && position === 'absolute' && left === '-9999px') {
                        const family = String(style.fontFamily || '').toLowerCase()
                        if (family.includes('monospace')) return 1100
                        if (family.includes('serif') && !family.includes('sans-serif')) return 980
                        return 1030
                      }
                    } catch (_) {}
                    return originalOffsetWidth.call(this)
                  }
                  try { Object.defineProperty(maskedOffsetWidth, '__profileoFontMask', { value: true }) } catch (_) {}
                  Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {
                    get: maskedOffsetWidth,
                    configurable: true
                  })
                }
              } catch (_) {}
            }

            if (privacyMask.blockCanvas && window.HTMLCanvasElement) {
              const blockRead = () => {
                throw new DOMException('Canvas readback is blocked by this profile', 'SecurityError')
              }

              try {
                Object.defineProperty(window.HTMLCanvasElement.prototype, 'toDataURL', {
                  value: blockRead,
                  configurable: true,
                  writable: true
                })
              } catch (_) {}

              try {
                Object.defineProperty(window.HTMLCanvasElement.prototype, 'toBlob', {
                  value: function(callback) {
                    if (typeof callback === 'function') {
                      setTimeout(() => callback(null), 0)
                      return
                    }
                    blockRead()
                  },
                  configurable: true,
                  writable: true
                })
              } catch (_) {}

              try {
                if (window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype.getImageData) {
                  Object.defineProperty(window.CanvasRenderingContext2D.prototype, 'getImageData', {
                    value: blockRead,
                    configurable: true,
                    writable: true
                  })
                }
              } catch (_) {}
            }

            if (privacyMask.blockAudio) {
              for (const key of ['OfflineAudioContext', 'webkitOfflineAudioContext']) {
                try {
                  Object.defineProperty(window, key, {
                    get: () => undefined,
                    configurable: true
                  })
                } catch (_) {}
              }
            }
          }

          if ((webGLMetadataMask || (privacyMask && privacyMask.blockWebGLDebug)) && !window.__profileoPrivacyShield) {
            const patchPrototype = (proto) => {
              if (!proto || !proto.getParameter || proto.getParameter.__profileoWebGLMask) return
              const originalGetParameter = proto.getParameter
              const patchedGetParameter = function(parameter) {
                if (webGLMetadataMask && parameter === 37445) return webGLMetadataMask.vendor
                if (webGLMetadataMask && parameter === 37446) return webGLMetadataMask.renderer
                return originalGetParameter.apply(this, arguments)
              }

              try {
                Object.defineProperty(patchedGetParameter, 'name', { value: 'getParameter', configurable: true })
                Object.defineProperty(patchedGetParameter, 'length', { value: 1, configurable: true })
                Object.defineProperty(patchedGetParameter, '__profileoWebGLMask', { value: true })
                Object.defineProperty(patchedGetParameter, 'toString', {
                  value: () => originalGetParameter.toString(),
                  configurable: true
                })
              } catch (_) {}

              try {
                Object.defineProperty(proto, 'getParameter', {
                  value: patchedGetParameter,
                  configurable: true,
                  writable: true
                })
              } catch (_) {
                try { proto.getParameter = patchedGetParameter } catch (_) {}
              }

              if (privacyMask && privacyMask.blockWebGLDebug && proto.getExtension && !proto.getExtension.__profileoWebGLDebugMask) {
                const originalGetExtension = proto.getExtension
                const patchedGetExtension = function(name) {
                  if (String(name || '').toUpperCase() === 'WEBGL_DEBUG_RENDERER_INFO') return null
                  return originalGetExtension.apply(this, arguments)
                }
                try {
                  Object.defineProperty(patchedGetExtension, 'name', { value: 'getExtension', configurable: true })
                  Object.defineProperty(patchedGetExtension, 'length', { value: 1, configurable: true })
                  Object.defineProperty(patchedGetExtension, '__profileoWebGLDebugMask', { value: true })
                  Object.defineProperty(patchedGetExtension, 'toString', {
                    value: () => originalGetExtension.toString(),
                    configurable: true
                  })
                } catch (_) {}
                try {
                  Object.defineProperty(proto, 'getExtension', {
                    value: patchedGetExtension,
                    configurable: true,
                    writable: true
                  })
                } catch (_) {
                  try { proto.getExtension = patchedGetExtension } catch (_) {}
                }
              }
            }

            try { patchPrototype(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype) } catch (_) {}
            try { patchPrototype(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype) } catch (_) {}
          }

          if (mediaDevicesMask && navigator.mediaDevices && !window.__profileoPrivacyShield) {
            const makeDevice = (device) => {
              const mediaDevice = {}
              for (const key of ['kind', 'label', 'deviceId', 'groupId']) {
                Object.defineProperty(mediaDevice, key, {
                  value: device[key] || '',
                  enumerable: true,
                  configurable: true
                })
              }
              Object.defineProperty(mediaDevice, 'toJSON', {
                value: () => ({
                  kind: mediaDevice.kind,
                  label: mediaDevice.label,
                  deviceId: mediaDevice.deviceId,
                  groupId: mediaDevice.groupId
                }),
                configurable: true
              })
              return mediaDevice
            }

            const enumerateDevices = () => Promise.resolve(
              (mediaDevicesMask.devices || []).map(device => makeDevice(device))
            )

            try {
              Object.defineProperty(enumerateDevices, 'name', { value: 'enumerateDevices', configurable: true })
              Object.defineProperty(enumerateDevices, 'length', { value: 0, configurable: true })
            } catch (_) {}

            try {
              Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
                value: enumerateDevices,
                configurable: true
              })
            } catch (_) {
              try { navigator.mediaDevices.enumerateDevices = enumerateDevices } catch (_) {}
            }
          }

          if (shouldBlockWebRTC && navigator.mediaDevices && !window.__profileoPrivacyShield) {
            const makeNativeLike = (fn, name) => {
              try { Object.defineProperty(fn, 'name', { value: name, configurable: true }) } catch (_) {}
              try {
                Object.defineProperty(fn, 'toString', {
                  value: () => 'function ' + name + '() { [native code] }',
                  configurable: true
                })
              } catch (_) {}
              return fn
            }

            const makeFallbackTrack = (kind) => {
              const track = {
                kind,
                id: 'profileo-' + kind + '-track',
                label: '',
                enabled: true,
                muted: false,
                readyState: 'live',
                stop() {
                  this.readyState = 'ended'
                },
                clone() {
                  return makeFallbackTrack(kind)
                },
                getSettings() {
                  if (kind === 'audio') {
                    return { deviceId: 'profileo-audio-input', sampleRate: 48000, channelCount: 2 }
                  }
                  return { deviceId: 'profileo-video-input', width: 640, height: 480, frameRate: 1 }
                },
                getCapabilities() { return {} },
                getConstraints() { return {} },
                addEventListener() {},
                removeEventListener() {},
                dispatchEvent() { return true }
              }
              return track
            }

            const makeSilentAudioTrack = () => {
              try {
                const AudioCtor = window.AudioContext || window.webkitAudioContext
                if (!AudioCtor) return makeFallbackTrack('audio')
                const ctx = new AudioCtor()
                const dest = ctx.createMediaStreamDestination()
                const oscillator = ctx.createOscillator()
                const gain = ctx.createGain()
                gain.gain.value = 0
                oscillator.connect(gain)
                gain.connect(dest)
                oscillator.start()
                const track = dest.stream.getAudioTracks()[0]
                if (!track) return makeFallbackTrack('audio')
                const originalStop = track.stop.bind(track)
                try {
                  Object.defineProperty(track, 'stop', {
                    value() {
                      try { oscillator.stop() } catch (_) {}
                      try { ctx.close() } catch (_) {}
                      return originalStop()
                    },
                    configurable: true
                  })
                } catch (_) {}
                return track
              } catch (_) {
                return makeFallbackTrack('audio')
              }
            }

            const makeBlankVideoTrack = () => {
              try {
                const canvas = document.createElement('canvas')
                canvas.width = 640
                canvas.height = 480
                const ctx = canvas.getContext('2d')
                if (ctx) {
                  ctx.fillStyle = '#111827'
                  ctx.fillRect(0, 0, canvas.width, canvas.height)
                }
                const stream = canvas.captureStream ? canvas.captureStream(1) : null
                const track = stream && stream.getVideoTracks()[0]
                if (!track) return makeFallbackTrack('video')
                try {
                  Object.defineProperty(track, '__profileoCanvas', {
                    value: canvas,
                    configurable: true
                  })
                } catch (_) {}
                return track
              } catch (_) {
                return makeFallbackTrack('video')
              }
            }

            const makeFakeStreamObject = (tracks) => ({
              id: 'profileo-media-stream',
              active: true,
              getTracks() { return tracks.slice() },
              getAudioTracks() { return tracks.filter(track => track && track.kind === 'audio') },
              getVideoTracks() { return tracks.filter(track => track && track.kind === 'video') },
              addTrack(track) { tracks.push(track) },
              removeTrack(track) {
                const index = tracks.indexOf(track)
                if (index >= 0) tracks.splice(index, 1)
              },
              clone() {
                return makeFakeStreamObject(tracks.map(track => track && track.clone ? track.clone() : track))
              },
              addEventListener() {},
              removeEventListener() {},
              dispatchEvent() { return true }
            })

            const makeFakeMediaStream = (constraints) => {
              const wantsAudio = constraints === true || Boolean(constraints && constraints.audio)
              const wantsVideo = constraints === true || Boolean(constraints && constraints.video)
              const tracks = []
              if (wantsAudio) tracks.push(makeSilentAudioTrack())
              if (wantsVideo) tracks.push(makeBlankVideoTrack())
              if (!tracks.length) tracks.push(makeBlankVideoTrack())

              try {
                if (typeof MediaStream === 'function' && tracks.every(track => typeof MediaStreamTrack === 'function' && track instanceof MediaStreamTrack)) {
                  return new MediaStream(tracks)
                }
              } catch (_) {}
              return makeFakeStreamObject(tracks)
            }

            const getUserMedia = makeNativeLike(
              (constraints) => Promise.resolve(makeFakeMediaStream(constraints || {})),
              'getUserMedia'
            )

            try {
              Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
                value: getUserMedia,
                configurable: true
              })
            } catch (_) {
              try { navigator.mediaDevices.getUserMedia = getUserMedia } catch (_) {}
            }

            try {
              if (navigator.permissions && navigator.permissions.query) {
                const originalQuery = navigator.permissions.query.bind(navigator.permissions)
                const makePermissionStatus = (name) => ({
                  name,
                  state: 'granted',
                  onchange: null,
                  addEventListener() {},
                  removeEventListener() {},
                  dispatchEvent() { return true }
                })
                const query = makeNativeLike((descriptor) => {
                  const name = String((descriptor && descriptor.name) || '').toLowerCase()
                  if (name === 'camera' || name === 'microphone') {
                    return Promise.resolve(makePermissionStatus(name))
                  }
                  return originalQuery(descriptor)
                }, 'query')

                Object.defineProperty(navigator.permissions, 'query', {
                  value: query,
                  configurable: true
                })
              }
            } catch (_) {}
          }

          if (shouldBlockWebRTC && !window.__profileoPrivacyShield) {
            for (const key of ['RTCPeerConnection', 'webkitRTCPeerConnection']) {
              try {
                Object.defineProperty(window, key, {
                  get: () => undefined,
                  set: () => {},
                  configurable: true
                })
              } catch (_) {
                try { window[key] = undefined } catch (_) {}
              }
            }

            for (const key of ['RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate']) {
              try {
                Object.defineProperty(window, key, {
                  get: () => undefined,
                  configurable: true
                })
              } catch (_) {}
            }

            try {
              Object.defineProperty(window, '__profileoWebRTCDisabled', {
                value: true,
                configurable: false
              })
            } catch (_) {}
          }
        }, blockWebRTC, webGLMask, mediaDeviceMask, fingerprintPrivacyMask)

        // Android: ZERO CDP calls - keep exactly as v1.2.5 (confirmed working)
        // Other OS: override navigator.platform + Client Hints to match user agent
        if (profile.os !== 'Android' && profile.os !== 'iOS') {
          const os = { ...(platformMap[profile.os] || platformMap['Windows']) }

          const cdp = await page.target().createCDPSession()
          await cdp.send('Emulation.setUserAgentOverride', {
            userAgent: userAgent,
            platform: os.nav,
            acceptLanguage: profileLang,
            userAgentMetadata: {
              platform: os.ua,
              platformVersion: os.ver,
              architecture: os.arch,
              model: os.model,
              mobile: os.mobile,
              bitness: '64',
              brands: this._buildClientHintBrands(profileBrowserName, userAgent, userAgentMajor, clientHintFullVersion, false),
              fullVersionList: this._buildClientHintBrands(profileBrowserName, userAgent, userAgentMajor, clientHintFullVersion, true),
              fullVersion: clientHintFullVersion
            }
          })
        }

        // Authenticate proxy if credentials provided
        if (proxyUser && proxyPass) {
          await page.authenticate({ username: proxyUser, password: proxyPass })
        }

      } catch (_) {}
    }

    browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        try {
          const page = await target.page()
          if (page) {
            await setupPage(page)
          }
        } catch (_) {}
      }
    })

    const pages = await browser.pages()
    if (pages.length > 0) {
      await setupPage(pages[0])

      if (isFirstLaunch) {
        // First launch: navigate to start URL or ipfighter.com
        const url = profile.startUrl || 'https://ipfighter.com'
        try { await pages[0].goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }) } catch (_) {}
      } else if (lastSessionUrls.length > 0) {
        // Restore last session: open saved URLs
        try { await pages[0].goto(lastSessionUrls[0], { waitUntil: 'domcontentloaded', timeout: 15000 }) } catch (_) {}
        for (let i = 1; i < lastSessionUrls.length; i++) {
          try {
            const newPage = await browser.newPage()
            await setupPage(newPage)
            await newPage.goto(lastSessionUrls[i], { waitUntil: 'domcontentloaded', timeout: 15000 })
          } catch (_) {}
        }
      } else if (profile.startUrl) {
        // Not first launch, no session, but has start URL
        try { await pages[0].goto(profile.startUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }) } catch (_) {}
      }
      // else: not first launch, no session, no startUrl - stays on new tab
    }

    this.runningBrowsers.set(profileId, browser)
    this._touchProfileActivity(profileId, 'launched')

    // Periodically save session URLs for restore
    const saveSession = async () => {
      try {
        const allPages = await browser.pages()
        const urls = []
        for (const p of allPages) {
          try {
            const url = p.url()
            if (url && url !== 'about:blank' && url !== 'chrome://newtab/' && !url.startsWith('chrome://')) {
              urls.push(url)
            }
          } catch (_) {}
        }
        if (urls.length > 0) {
          fs.writeFileSync(sessionFile, JSON.stringify(urls))
        }
      } catch (_) {}
    }
    const sessionInterval = setInterval(saveSession, 30000)

    browser.on('disconnected', () => {
      clearInterval(sessionInterval)
      this.runningBrowsers.delete(profileId)
      this._touchProfileActivity(profileId, 'stopped')
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
      if (browser.kind === 'native' || browser.kind === 'android-emulator') {
        try { await browser.close() } catch (_) {}
        this.runningBrowsers.delete(profileId)
        this._touchProfileActivity(profileId, 'stopped')
        return { success: true }
      }

      // Save session URLs before closing
      try {
        const allPages = await browser.pages()
        const urls = []
        for (const p of allPages) {
          try {
            const url = p.url()
            if (url && url !== 'about:blank' && url !== 'chrome://newtab/' && !url.startsWith('chrome://')) {
              urls.push(url)
            }
          } catch (_) {}
        }
        if (urls.length > 0) {
          const userDataDir = path.join(this.profilesDir, profileId)
          const sessionFile = path.join(userDataDir, '_lastSession.json')
          fs.writeFileSync(sessionFile, JSON.stringify(urls))
        }
      } catch (_) {}
      try { await browser.close() } catch (_) {}
      this.runningBrowsers.delete(profileId)
      this._touchProfileActivity(profileId, 'stopped')
    }
    return { success: true }
  }

  async stopAllBrowsers() {
    for (const [profileId, browser] of this.runningBrowsers) {
      if (browser.kind === 'native' || browser.kind === 'android-emulator') {
        try { await browser.close() } catch (_) {}
        this._touchProfileActivity(profileId, 'stopped')
        continue
      }

      // Save session URLs before closing
      try {
        const allPages = await browser.pages()
        const urls = []
        for (const p of allPages) {
          try {
            const url = p.url()
            if (url && url !== 'about:blank' && url !== 'chrome://newtab/' && !url.startsWith('chrome://')) {
              urls.push(url)
            }
          } catch (_) {}
        }
        if (urls.length > 0) {
          const userDataDir = path.join(this.profilesDir, profileId)
          const sessionFile = path.join(userDataDir, '_lastSession.json')
          fs.writeFileSync(sessionFile, JSON.stringify(urls))
        }
      } catch (_) {}
      try { await browser.close() } catch (_) {}
      this._touchProfileActivity(profileId, 'stopped')
    }
    this.runningBrowsers.clear()
  }
}
