import React, { useEffect, useMemo, useState } from 'react'
import { BrowserOptionIcon } from './OptionIcons'

const FOLDER_COLORS = ['#4285f4','#e94560','#ffab00','#2ecc71','#9b59b6','#e67e22','#1abc9c','#e74c3c']

const COUNTRY_NAMES = {
  US: 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  CA: 'Canada',
  JP: 'Japan',
  NL: 'Netherlands',
  IT: 'Italy',
  ES: 'Spain',
  BR: 'Brazil',
  MX: 'Mexico',
  AR: 'Argentina',
  TR: 'Turkey',
  RU: 'Russia',
  PL: 'Poland',
  CN: 'China',
  KR: 'South Korea',
  SG: 'Singapore',
  AE: 'United Arab Emirates',
  IN: 'India',
  TH: 'Thailand',
  ID: 'Indonesia',
  PH: 'Philippines',
  AU: 'Australia',
  NZ: 'New Zealand',
  EG: 'Egypt',
  NG: 'Nigeria',
  ZA: 'South Africa',
  AL: 'Albania'
}

const COUNTRY_ALIASES = {
  usa: 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  america: 'US',
  'united states': 'US',
  uk: 'GB',
  england: 'GB',
  britain: 'GB',
  'united kingdom': 'GB',
  germany: 'DE',
  deutschland: 'DE',
  france: 'FR',
  canada: 'CA',
  japan: 'JP',
  netherlands: 'NL',
  holland: 'NL',
  italy: 'IT',
  spain: 'ES',
  brazil: 'BR',
  mexico: 'MX',
  argentina: 'AR',
  turkey: 'TR',
  russia: 'RU',
  poland: 'PL',
  china: 'CN',
  korea: 'KR',
  singapore: 'SG',
  dubai: 'AE',
  uae: 'AE',
  india: 'IN',
  thailand: 'TH',
  indonesia: 'ID',
  philippines: 'PH',
  australia: 'AU',
  zealand: 'NZ',
  egypt: 'EG',
  nigeria: 'NG',
  africa: 'ZA',
  albania: 'AL',
  shqiperi: 'AL',
  shqiperia: 'AL',
  kosovo: 'XK',
  kosova: 'XK'
}

const PROXY_LOOKUP_CACHE_KEY = 'profileo.proxyLookups.v1'
const PROXY_LOOKUP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const IP_API_FIELDS = 'status,country,countryCode,proxy,hosting,mobile,query'

function getProxyParts(proxy) {
  const raw = String(proxy || '').trim()
  if (!raw) return { host: '', port: '', username: '', password: '', raw: '', withoutProtocol: '' }
  const withoutProtocol = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`

  try {
    const url = new URL(withProtocol)
    if (url.hostname) {
      return {
        host: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || '',
        username: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
        raw,
        withoutProtocol
      }
    }
  } catch (_) {}

  const afterAuth = withoutProtocol.includes('@') ? withoutProtocol.split('@').pop() : withoutProtocol
  const parts = String(afterAuth || '').split(':')
  return {
    host: (parts[0] || '').trim(),
    port: (parts[1] || '').trim(),
    username: (parts[2] || '').trim(),
    password: (parts[3] || '').trim(),
    raw,
    withoutProtocol
  }
}

function getProxyHost(proxy) {
  return getProxyParts(proxy).host
}

function normalizeProxyKey(value) {
  return String(value || '').trim().toLowerCase()
}

function getProxyAddressKeys(proxy) {
  const parts = getProxyParts(proxy)
  const keys = new Set()
  const raw = normalizeProxyKey(parts.raw)
  const withoutProtocol = normalizeProxyKey(parts.withoutProtocol)

  if (raw) keys.add(raw)
  if (withoutProtocol) keys.add(withoutProtocol)
  if (parts.host && parts.port) {
    const hostPort = normalizeProxyKey(`${parts.host}:${parts.port}`)
    keys.add(hostPort)
    if (parts.username || parts.password) {
      keys.add(normalizeProxyKey(`${hostPort}:${parts.username}:${parts.password}`))
      keys.add(normalizeProxyKey(`${parts.username}:${parts.password}@${hostPort}`))
    }
  }

  return [...keys].filter(Boolean)
}

function findManagedProxy(profile, proxyByAddress) {
  for (const key of getProxyAddressKeys(profile?.proxy)) {
    const match = proxyByAddress.get(key)
    if (match) return match
  }
  return null
}

function readLookupCache() {
  try {
    if (typeof localStorage === 'undefined') return {}
    return JSON.parse(localStorage.getItem(PROXY_LOOKUP_CACHE_KEY) || '{}') || {}
  } catch (_) {
    return {}
  }
}

function getCachedLookup(cache, host) {
  const item = cache?.[host]
  if (!item) return null
  const cachedAt = Number(item.cachedAt || 0)
  if (!cachedAt || Date.now() - cachedAt > PROXY_LOOKUP_CACHE_TTL) return null
  const { cachedAt: _cachedAt, ...lookup } = item
  return lookup
}

function writeLookupCache(cache) {
  try {
    if (typeof localStorage === 'undefined') return
    const entries = Object.entries(cache || {}).slice(-500)
    localStorage.setItem(PROXY_LOOKUP_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch (_) {}
}

async function fetchProxyLookup(host) {
  const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(host)}?fields=${IP_API_FIELDS}`)
  const data = await response.json()
  return data?.status === 'success' ? data : { status: 'failed' }
}

async function fetchProxyLookupBatch(hosts) {
  const response = await fetch(`http://ip-api.com/batch?fields=${IP_API_FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hosts)
  })
  if (!response.ok) throw new Error('Proxy lookup batch failed')
  const data = await response.json()
  const list = Array.isArray(data) ? data : []
  return hosts.map((host, index) => {
    const item = list.find(entry => entry?.query === host) || list[index]
    return [host, item?.status === 'success' ? item : { status: 'failed' }]
  })
}

function isSpecificProxyKind(kind) {
  return /(mobile|residential|datacenter|isp)/i.test(String(kind || ''))
}

function needsProxyLookup(profile, managedProxy) {
  const { countryCode } = normalizeCountry(profile, managedProxy, null)
  const kind = normalizeProxyKind(profile, managedProxy, null)
  return !countryCode || !isSpecificProxyKind(kind)
}

function hasUsableProxy(profile) {
  return Boolean(profile?.proxy && profile?.proxyType && profile.proxyType !== 'Without Proxy')
}

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

function CountryFlagIcon({ countryCode, fallback }) {
  const code = String(countryCode || '').toUpperCase()
  if (!code && !fallback) return null
  if (code === 'AL') return <AlbaniaFlagIcon />

  return <span className="flag-emoji" aria-hidden="true">{fallback || countryFlag(code)}</span>
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countryFromText(...parts) {
  const text = parts.filter(Boolean).join(' ').replace(/[_,-]+/g, ' ').toLowerCase()
  if (!text) return ''

  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    const pattern = new RegExp(`(^|[^a-z])${escapeRegex(alias)}([^a-z]|$)`, 'i')
    if (pattern.test(text)) return code
  }

  for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
    if (code === 'UK') continue
    const codePattern = new RegExp(`(^|[^a-z])${escapeRegex(code.toLowerCase())}([^a-z]|$)`, 'i')
    const namePattern = new RegExp(`(^|[^a-z])${escapeRegex(String(name).toLowerCase())}([^a-z]|$)`, 'i')
    if (codePattern.test(text) || namePattern.test(text)) return code
  }

  return ''
}

function normalizeCountry(profile, managedProxy, lookup) {
  const explicitCode = (
    profile?.proxyCountryCode ||
    profile?.countryCode ||
    profile?.locationCountryCode ||
    managedProxy?.countryCode ||
    managedProxy?.proxyCountryCode ||
    lookup?.countryCode ||
    ''
  ).toString().toUpperCase()

  const textCode = countryFromText(
    profile?.proxyCountry,
    profile?.country,
    profile?.location,
    managedProxy?.country,
    managedProxy?.countryName,
    managedProxy?.location,
    managedProxy?.tags,
    managedProxy?.notes,
    profile?.tags,
    profile?.notes
  )

  const countryCode = explicitCode || textCode
  const countryName = (
    profile?.proxyCountry ||
    profile?.country ||
    managedProxy?.country ||
    managedProxy?.countryName ||
    lookup?.country ||
    COUNTRY_NAMES[countryCode] ||
    ''
  )

  return { countryCode, countryName }
}

function normalizeProxyKind(profile, managedProxy, lookup) {
  const text = [
    profile?.proxyNetworkType,
    profile?.proxyCategory,
    profile?.proxyKind,
    managedProxy?.networkType,
    managedProxy?.proxyNetworkType,
    managedProxy?.category,
    managedProxy?.kind,
    managedProxy?.tags,
    managedProxy?.notes,
    profile?.tags,
    profile?.notes
  ].filter(Boolean).join(' ').toLowerCase()

  if (/(mobile|4g|5g|lte)/.test(text)) return 'Mobile'
  if (/(residential|resi|resident)/.test(text)) return 'Residential'
  if (/(datacenter|data center|hosting|server|\bdc\b)/.test(text)) return 'Datacenter'
  if (/(isp|static)/.test(text)) return 'ISP'

  if (lookup?.status === 'success') {
    if (lookup.mobile) return 'Mobile'
    if (lookup.hosting) return 'Datacenter'
    return lookup.proxy ? 'Residential' : 'Residential'
  }

  const connectionType = String(profile?.proxyType || managedProxy?.type || '').toUpperCase()
  if (connectionType.startsWith('SOCKS')) return 'SOCKS Proxy'
  if (connectionType === 'HTTP') return 'HTTP Proxy'
  return 'Proxy'
}

function proxyIconType(kind) {
  const lower = String(kind || '').toLowerCase()
  if (lower.includes('datacenter')) return 'datacenter'
  if (lower.includes('mobile')) return 'mobile'
  if (lower.includes('direct')) return 'direct'
  return 'residential'
}

function ProxyIcon({ type }) {
  if (type === 'datacenter') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="3" width="16" height="5.2" rx="1.5" fill="url(#datacenterRackA)"/>
        <rect x="4" y="9.4" width="16" height="5.2" rx="1.5" fill="url(#datacenterRackB)"/>
        <rect x="4" y="15.8" width="16" height="5.2" rx="1.5" fill="url(#datacenterRackC)"/>
        <circle cx="7" cy="5.6" r=".8" fill="#c9f2ff"/>
        <circle cx="7" cy="12" r=".8" fill="#c9f2ff"/>
        <circle cx="7" cy="18.4" r=".8" fill="#c9f2ff"/>
        <path d="M10 5.6h6M10 12h6M10 18.4h6" stroke="#dff8ff" strokeWidth="1.15" strokeLinecap="round" opacity=".9"/>
        <defs>
          <linearGradient id="datacenterRackA" x1="4" y1="3" x2="20" y2="8.2" gradientUnits="userSpaceOnUse">
            <stop stopColor="#42d8ff"/>
            <stop offset="1" stopColor="#246bff"/>
          </linearGradient>
          <linearGradient id="datacenterRackB" x1="4" y1="9.4" x2="20" y2="14.6" gradientUnits="userSpaceOnUse">
            <stop stopColor="#36bfff"/>
            <stop offset="1" stopColor="#194ed1"/>
          </linearGradient>
          <linearGradient id="datacenterRackC" x1="4" y1="15.8" x2="20" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2a9fff"/>
            <stop offset="1" stopColor="#1139a4"/>
          </linearGradient>
        </defs>
      </svg>
    )
  }

  if (type === 'mobile') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="8" y="2.5" width="8" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M10.5 5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="12" cy="18.2" r=".8" fill="currentColor"/>
      </svg>
    )
  }

  if (type === 'direct') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 12h16M14 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5L12 5l8 6.5v8a1 1 0 01-1 1h-4.5v-5h-5v5H5a1 1 0 01-1-1v-8z" fill="currentColor"/>
    </svg>
  )
}

function BrowserIcon({ browser }) {
  const name = String(browser || 'Chrome').toLowerCase()
  const size = 22

  if (name.includes('edge')) {
    return (
      <svg className="browser-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21.3 14.1c-.8 4.2-4.6 7.4-9.1 7.4-4.9 0-8.9-3.7-9.3-8.5 1.4 2 3.6 3 6.2 3h.1c1.5 0 2.8-.4 3.8-1.1.8-.6 1.7-.9 2.7-.9 1.4 0 2.5.5 3.2 1.2 1.2 1.2 2.2.3 2.4-1.1z" fill="#19c7a5"/>
        <path d="M3 13.1c.3-5.9 4.9-10.6 10.5-10.6 4.6 0 8.2 2.8 8.2 6.7 0 2.4-1.4 4.1-3.3 4.8-.8-.7-1.8-1.1-3.1-1.1-1.3 0-2.4.4-3.4 1.1-.8.5-1.7.8-2.8.8-2.7 0-4.8-1-6.1-1.7z" fill="#0a8ee8"/>
        <path d="M21.7 9.2c0 2.9-2.4 4.9-5.5 4.9-1.2 0-2.1.3-3 .9.7-1.5.6-3.1-.5-4.3-1.5-1.6-4.2-1.5-6.2-.4C7.6 5.9 10.5 2.5 14 2.5c4.4 0 7.7 2.8 7.7 6.7z" fill="#35d6ff"/>
      </svg>
    )
  }

  if (name.includes('brave')) {
    return (
      <svg className="browser-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.3 4.2L9.2 2h5.6l2.9 2.2 2 5.1-1.2 7.4L12 22l-6.5-5.3-1.2-7.4 2-5.1z" fill="#f06b23"/>
        <path d="M8.1 8.2l2.2 1.1L12 7.2l1.7 2.1 2.2-1.1-.5 4.1L12 16l-3.4-3.7-.5-4.1z" fill="#fff2df"/>
      </svg>
    )
  }

  if (name.includes('opera')) {
    return (
      <svg className="browser-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse cx="12" cy="12" rx="7.2" ry="9.2" stroke="#ff1b2d" strokeWidth="4.2"/>
      </svg>
    )
  }

  if (name.includes('yandex')) {
    return (
      <svg className="browser-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2" fill="#fff"/>
        <path d="M12 5.5v13" stroke="#e31d1c" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    )
  }

  if (name.includes('firefox')) {
    return (
      <svg className="browser-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20.5 13.2c0 4.7-3.8 8.3-8.5 8.3S3.5 17.8 3.5 13.1c0-2.9 1.4-5.1 3.4-6.6-.3 1.4.3 2.5 1.2 3.1.7-2.5 2.5-4.7 5.1-6.5-.2 1.7.4 2.9 1.5 3.8 2.8.3 5.8 2.5 5.8 6.3z" fill="#ff8a00"/>
        <path d="M18.4 14c0 3.2-2.7 5.6-6.1 5.6-3.2 0-5.8-2.2-5.8-5.3 0-1.4.6-2.7 1.5-3.6.3 2 1.9 3.5 4.4 3.5 1.5 0 2.6-.4 3.3-1.2.9.1 1.8.4 2.7 1z" fill="#7b42ff"/>
      </svg>
    )
  }

  return (
    <svg className="browser-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#fbbc05"/>
      <path d="M12 12h9.8A10 10 0 005.4 4.6L12 12z" fill="#ea4335"/>
      <path d="M12 12l-5 8.7A10 10 0 0021.8 12H12z" fill="#34a853"/>
      <path d="M12 12L5.4 4.6A10 10 0 007 20.7L12 12z" fill="#fbbc05"/>
      <circle cx="12" cy="12" r="4.2" fill="#4285f4" stroke="#fff" strokeWidth="1.6"/>
    </svg>
  )
}

function formatActivity(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  const time = date.getTime()
  if (!Number.isFinite(time)) return 'Never'

  const diff = Math.max(0, Date.now() - time)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'Just now'
  if (diff < hour) {
    const minutes = Math.max(1, Math.floor(diff / minute))
    return `${minutes} min ago`
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(diff / day)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}

function buildProxyDisplay(profile, managedProxy, lookup) {
  if (!hasUsableProxy(profile)) {
    return {
      kind: 'Direct',
      detail: 'Without proxy',
      iconType: 'direct',
      location: 'Local device',
      flag: ''
    }
  }

  const kind = normalizeProxyKind(profile, managedProxy, lookup)
  const connectionType = profile.proxyType || managedProxy?.type || 'Proxy'
  const { countryCode, countryName } = normalizeCountry(profile, managedProxy, lookup)
  const loading = lookup?.status === 'loading'

  return {
    kind,
    detail: connectionType,
    iconType: proxyIconType(kind),
    location: countryName || (loading ? 'Checking...' : 'Unknown'),
    countryCode,
    flag: countryFlag(countryCode)
  }
}

function OsIcon({ os }) {
  const size = 16
  switch (os) {
    case 'Windows':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M3 12.5h8v8.2L3 19.5v-7zm0-9.2L11 2v8.2H3V3.3zm9.5-1.5L22 1v10.2h-9.5V1.8zm0 20.4V12.8H22V23l-9.5-0.8z" fill="#00adef"/>
        </svg>
      )
    case 'MacOS':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#a2aaad"/>
        </svg>
      )
    case 'Linux':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12.5 2C10 2 8.2 4.1 8.2 7c0 1.3.4 2.5 1 3.5L7 14c-.8 1-1.5 2.2-1.5 3.5 0 .8.3 1.5.8 2 .5.6 1.2 1 2 1.2.7.2 1.5.3 2.2.3h3c.7 0 1.5-.1 2.2-.3.8-.2 1.5-.6 2-1.2.5-.5.8-1.2.8-2 0-1.3-.7-2.5-1.5-3.5l-2.2-3.5c.6-1 1-2.2 1-3.5 0-2.9-1.8-5-4.3-5z" fill="#f0c040"/>
          <circle cx="10.5" cy="6.5" r="1" fill="#333"/>
          <circle cx="14.5" cy="6.5" r="1" fill="#333"/>
          <path d="M10.5 9c0 0 .7 1.2 2 1.2s2-1.2 2-1.2" stroke="#333" strokeWidth=".8" fill="none"/>
        </svg>
      )
    case 'Android':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" fill="#3ddc84"/>
        </svg>
      )
    case 'iOS':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#8e8e93"/>
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      )
  }
}

function FolderMarker({ folder }) {
  const name = String(folder?.name || '').trim().toLowerCase()
  const size = 14

  if (folder?.id === 'all' || name === 'all profiles') return null

  if (name === 'iphone' || name === 'ios') {
    return (
      <svg className="folder-os-icon folder-os-icon-iphone" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="3" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M10.4 4.6h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="12" cy="18.7" r="0.9" fill="currentColor"/>
      </svg>
    )
  }

  if (name === 'android') {
    return (
      <svg className="folder-os-icon folder-os-icon-android" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 9h10v7.5c0 .83-.67 1.5-1.5 1.5h-7A1.5 1.5 0 017 16.5V9z" fill="currentColor"/>
        <path d="M8.5 7.8A3.9 3.9 0 0112 5.7a3.9 3.9 0 013.5 2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M9 4.3l1.1 1.9M15 4.3l-1.1 1.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="10.1" cy="7.8" r=".55" fill="#06101f"/>
        <circle cx="13.9" cy="7.8" r=".55" fill="#06101f"/>
        <path d="M5 10v5.3M19 10v5.3M10 18v2.8M14 18v2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    )
  }

  if (name === 'windows') {
    return (
      <svg className="folder-os-icon folder-os-icon-windows" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 5.2l7.3-1v7H3v-6zM11.5 4l9.5-1.4v8.6h-9.5V4zM3 12.7h7.3v7.1L3 18.8v-6.1zM11.5 12.7H21v8.7l-9.5-1.4v-7.3z" fill="currentColor"/>
      </svg>
    )
  }

  return <span className="folder-dot" style={{ background: folder.color }} />
}

function FolderHeaderIcon() {
  return (
    <svg className="folder-header-icon" width="17" height="15" viewBox="0 0 17 15" fill="none" aria-hidden="true">
      <path d="M1.4 3.1c0-.72.58-1.3 1.3-1.3h4.1c.42 0 .82.2 1.07.55l.72.98h5.72c.71 0 1.29.58 1.29 1.29v1.04H1.4V3.1z" fill="#38a4ff"/>
      <path d="M1.4 5.05h14.2c.77 0 1.35.7 1.22 1.46l-.9 5.25c-.1.62-.64 1.08-1.27 1.08H2.35c-.63 0-1.17-.46-1.27-1.08L.18 6.51C.05 5.75.63 5.05 1.4 5.05z" fill="url(#folderHeaderBlue)"/>
      <path d="M1.7 5.48h13.2" stroke="#7fd0ff" strokeWidth=".7" strokeLinecap="round" opacity=".65"/>
      <defs>
        <linearGradient id="folderHeaderBlue" x1="2.1" y1="4.9" x2="12.7" y2="14.1" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4fb7ff"/>
          <stop offset=".52" stopColor="#248cff"/>
          <stop offset="1" stopColor="#0d5fd0"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function DuplicateDialog({ profile, onDuplicate, onClose }) {
  const [count, setCount] = useState(1)
  const [options, setOptions] = useState({
    fingerprint: true,
    userAgents: true,
    webrtcGeo: true,
    proxy: true,
  })
  const toggle = k => setOptions(p => ({ ...p, [k]: !p[k] }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Duplicate Profile</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p className="modal-hint">Duplicating: <strong>{profile.name}</strong></p>
          <div className="form-group">
            <label>Number of copies</label>
            <input type="number" className="np-input" min={1} max={50} value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} />
          </div>
          <div className="form-group">
            <label>Include in duplicate:</label>
            <div className="dup-options">
              <label className="dup-check"><input type="checkbox" checked={options.fingerprint} onChange={() => toggle('fingerprint')} /> Fingerprint</label>
              <label className="dup-check"><input type="checkbox" checked={options.userAgents} onChange={() => toggle('userAgents')} /> User Agents</label>
              <label className="dup-check"><input type="checkbox" checked={options.webrtcGeo} onChange={() => toggle('webrtcGeo')} /> WebRTC & Geolocation</label>
              <label className="dup-check"><input type="checkbox" checked={options.proxy} onChange={() => toggle('proxy')} /> Proxy</label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onDuplicate(profile.id, count, options); onClose() }}>Create {count} copies</button>
        </div>
      </div>
    </div>
  )
}

function NewFolderDialog({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#4285f4')
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Folder</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Folder Name</label>
            <input type="text" className="np-input" placeholder="Enter folder name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-picks">
              {FOLDER_COLORS.map(c => (
                <button key={c} className={`color-dot ${color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if (name.trim()) { onSave({ name, color }); onClose() } }}>Create</button>
        </div>
      </div>
    </div>
  )
}

function ProfilesPage({
  profiles, allProfiles, folders, proxies = [], activeFolder, billingPlan,
  automationStatuses,
  onFolderSelect, onEdit, onDelete, onDeleteMultiple, onDuplicate,
  onLaunch, onStop, onCreateNew, onCreateMulti,
  onCreateFolder, onDeleteFolder
}) {
  const planActive = billingPlan && billingPlan.isActive
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [dupProfile, setDupProfile] = useState(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [proxyLookups, setProxyLookups] = useState({})

  const proxyByAddress = useMemo(() => {
    const index = new Map()
    for (const proxy of proxies || []) {
      for (const key of getProxyAddressKeys(proxy?.address)) {
        if (!index.has(key)) index.set(key, proxy)
      }
    }
    return index
  }, [proxies])

  const filtered = profiles.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.notes || '').toLowerCase().includes(search.toLowerCase())
  )

  const lookupHosts = useMemo(() => {
    const hosts = new Set()
    for (const profile of filtered) {
      if (!hasUsableProxy(profile)) continue
      const managedProxy = findManagedProxy(profile, proxyByAddress)
      if (!needsProxyLookup(profile, managedProxy)) continue
      const host = getProxyHost(profile.proxy)
      if (host) hosts.add(host)
    }
    return [...hosts].sort()
  }, [filtered, proxyByAddress])

  const lookupHostsKey = lookupHosts.join('|')

  useEffect(() => {
    const missing = lookupHosts.filter(host => !proxyLookups[host])
    if (!missing.length) return

    let cancelled = false
    const cache = readLookupCache()
    const cached = {}
    const toFetch = []

    for (const host of missing) {
      const cachedLookup = getCachedLookup(cache, host)
      if (cachedLookup) cached[host] = cachedLookup
      else toFetch.push(host)
    }

    if (Object.keys(cached).length) {
      setProxyLookups(prev => ({ ...prev, ...cached }))
    }

    if (!toFetch.length) return

    setProxyLookups(prev => {
      const next = { ...prev }
      for (const host of toFetch) next[host] = { status: 'loading' }
      return next
    })

    const runLookups = async () => {
      const nextCache = { ...cache }
      for (let i = 0; i < toFetch.length; i += 100) {
        const chunk = toFetch.slice(i, i + 100)
        let results
        try {
          results = await fetchProxyLookupBatch(chunk)
        } catch (_) {
          results = await Promise.all(chunk.map(async host => {
            try {
              return [host, await fetchProxyLookup(host)]
            } catch (_) {
              return [host, { status: 'failed' }]
            }
          }))
        }

        if (cancelled) return
        const updates = {}
        for (const [host, lookup] of results) {
          updates[host] = lookup
          nextCache[host] = { ...lookup, cachedAt: Date.now() }
        }
        setProxyLookups(prev => ({ ...prev, ...updates }))
        writeLookupCache(nextCache)

        if (i + 100 < toFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 800))
          if (cancelled) return
        }
      }
    }

    runLookups()
    return () => { cancelled = true }
  }, [lookupHostsKey])

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
    if (!window.confirm(`Delete ${selected.size} selected profile(s)? This cannot be undone.`)) return
    onDeleteMultiple([...selected])
    setSelected(new Set())
  }

  const handleBulkRun = async () => {
    const ids = [...selected]
    setSelected(new Set())
    for (let i = 0; i < ids.length; i++) {
      onLaunch(ids[i])
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 3000))
    }
  }

  const getFolderCount = (fId) => {
    if (fId === 'all') return allProfiles.length
    return allProfiles.filter(p => p.folder === fId).length
  }

  return (
    <div className="profiles-page">
      <div className="profiles-layout">
        {/* Folder Panel */}
        <div className="folder-panel">
          <div className="folder-header">
            <FolderHeaderIcon />
            <span className="folder-title">FOLDERS</span>
            <button className="folder-add-btn" onClick={() => setShowNewFolder(true)} title="New Folder">+</button>
          </div>
          <div className="folder-list">
            {folders.map(f => (
              <button
                key={f.id}
                className={`folder-item ${activeFolder === f.id ? 'active' : ''}`}
                onClick={() => onFolderSelect(f.id)}
              >
                <FolderMarker folder={f} />
                <span className="folder-name">{f.name}</span>
                <span className="folder-count">{getFolderCount(f.id)}</span>
                {!f.isDefault && (
                  <button className="folder-del" onClick={e => { e.stopPropagation(); if (window.confirm(`Delete folder "${f.name}"? Profiles will be moved to All.`)) onDeleteFolder(f.id) }} title="Delete folder">&times;</button>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Table */}
        <div className="profiles-main">
          <div className="profiles-toolbar">
            <div className="profiles-toolbar-left">
              {selected.size > 0 ? (
                <>
                  <button className="btn btn-sm btn-success" onClick={handleBulkRun} disabled={!planActive}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    Run ({selected.size})
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={handleBulkDelete}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg>
                    Delete ({selected.size})
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
                </>
              ) : (
                <span className="toolbar-label">{filtered.length} profile{filtered.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="profiles-toolbar-right">
              <div className="search-wrapper">
                <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" className="search-bar" placeholder="Search profiles..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {!planActive && profiles.length > 0 && (
            <div className="plan-expired-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>Your plan has expired. Renew to launch profiles.</span>
            </div>
          )}

          <div className="profile-table-wrapper">
            <table className="profile-table">
              <thead>
                <tr>
                  <th className="col-check"><input type="checkbox" onChange={selectAll} checked={selected.size === filtered.length && filtered.length > 0} /></th>
                  <th className="col-num">#</th>
                  <th className="col-name">Profile Name</th>
                  <th className="col-browser">Browser</th>
                  <th className="col-status">Status</th>
                  <th className="col-proxy">Proxy</th>
                  <th className="col-location">Location</th>
                  <th className="col-activity">Last Activity</th>
                  <th className="col-action"></th>
                  <th className="col-more"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((profile, i) => {
                  const automationStatus = automationStatuses?.[profile.id]?.status
                  const isAutomationRunning = automationStatus === 'running'
                  const isRunning = profile.status === 'active' || isAutomationRunning
                  const proxyHost = getProxyHost(profile.proxy)
                  const managedProxy = findManagedProxy(profile, proxyByAddress)
                  const proxyDisplay = buildProxyDisplay(profile, managedProxy, proxyLookups[proxyHost])
                  const lastActivity = profile.lastActivityAt || profile.lastLaunchedAt || profile.lastStoppedAt
                  return (
                    <tr key={profile.id} className={selected.has(profile.id) ? 'row-selected' : ''}>
                      <td className="col-check"><input type="checkbox" checked={selected.has(profile.id)} onChange={() => toggleSelect(profile.id)} /></td>
                      <td className="col-num">{i + 1}</td>
                      <td className="col-name">
                        <span className="profile-name-text">{profile.name}</span>
                        <OsIcon os={profile.os} />
                        {isRunning && <span className="name-dot dot-active" />}
                      </td>
                      <td className="col-browser">
                        <span className="browser-cell">
                          <BrowserOptionIcon browser={profile.browser || 'Chrome'} />
                          <span>{profile.browser || 'Chrome'}</span>
                        </span>
                      </td>
                      <td className="col-status">
                        <span className={`status-tag ${isRunning ? 'tag-active' : 'tag-ready'}`}>
                          {isRunning ? 'Running' : 'Ready'}
                        </span>
                      </td>
                      <td className="col-proxy">
                        <span className={`proxy-display proxy-${proxyDisplay.iconType}`}>
                          <span className="proxy-display-icon"><ProxyIcon type={proxyDisplay.iconType} /></span>
                          <span className="proxy-display-text">
                            <span className="proxy-display-kind">{proxyDisplay.kind}</span>
                            <span className="proxy-display-detail">{proxyDisplay.detail}</span>
                          </span>
                        </span>
                      </td>
                      <td className="col-location">
                        <span className="location-cell">
                          {(proxyDisplay.countryCode || proxyDisplay.flag) && (
                            <span className="location-flag">
                              <CountryFlagIcon countryCode={proxyDisplay.countryCode} fallback={proxyDisplay.flag} />
                            </span>
                          )}
                          <span className="location-name">{proxyDisplay.location}</span>
                        </span>
                      </td>
                      <td className="col-activity">
                        <span className="last-activity-text" title={lastActivity ? new Date(lastActivity).toLocaleString() : 'No activity yet'}>
                          {formatActivity(lastActivity)}
                        </span>
                      </td>
                      <td className="col-action">
                        {isRunning
                          ? (
                            <button className="run-btn run-stop" onClick={() => onStop(profile.id)}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                              Stop
                            </button>
                          ) : (
                            <button className="run-btn" onClick={() => onLaunch(profile.id)} disabled={!planActive}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                              Run
                            </button>
                          )
                        }
                      </td>
                      <td className="col-more">
                        <div className="more-menu">
                          <button className="more-btn" title="Edit" onClick={() => onEdit(profile)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="more-btn" title="Duplicate" onClick={() => setDupProfile(profile)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                          </button>
                          <button className="more-btn more-delete" title="Delete" onClick={() => { if (window.confirm(`Delete "${profile.name}"?`)) onDelete(profile.id) }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="table-empty">
                      <div className="empty-state">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                        <p>No profiles found</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary" onClick={onCreateNew}>+ New Profile</button>
                          <button className="btn btn-success" onClick={onCreateMulti}>++ Multi Profiles</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {dupProfile && <DuplicateDialog profile={dupProfile} onDuplicate={onDuplicate} onClose={() => setDupProfile(null)} />}
      {showNewFolder && <NewFolderDialog onSave={onCreateFolder} onClose={() => setShowNewFolder(false)} />}
    </div>
  )
}

export default ProfilesPage
