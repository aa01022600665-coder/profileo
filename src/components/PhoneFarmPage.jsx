import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MAX_VISIBLE_CAPTURE = 8
const THUMBNAIL_INTERVAL_MS = 9000
const FOCUS_INTERVAL_MS = 1800
const TILE_MIN_WIDTH = 142
const TILE_HEIGHT = 304
const TILE_GAP = 14
const GRID_OVERSCAN_ROWS = 2
const SCREENSHOT_CACHE_LIMIT = 48

const CONTROL_KEYS = [
  { key: 'back', label: 'Back', icon: 'back' },
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'recent', label: 'Recent', icon: 'recent' },
  { key: 'wake', label: 'Wake', icon: 'power' }
]

const APP_SHORTCUTS = [
  { app: 'youtube', label: 'YouTube' },
  { app: 'kick', label: 'Kick' },
  { app: 'chrome', label: 'Chrome' }
]

async function runInBatches(items, worker, size = 4) {
  const results = []
  for (let index = 0; index < items.length; index += size) {
    const batch = items.slice(index, index + size)
    results.push(...await Promise.all(batch.map(worker)))
  }
  return results
}

function FarmIcon({ type }) {
  switch (type) {
    case 'phone':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="7" y="2" width="10" height="20" rx="2.4"/>
          <line x1="10" y1="18" x2="14" y2="18"/>
        </svg>
      )
    case 'grid':
      return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
      )
    case 'refresh':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 0 1-15.3 6.4"/>
          <path d="M3 12A9 9 0 0 1 18.3 5.6"/>
          <path d="M18 2v4h-4"/>
          <path d="M6 22v-4h4"/>
        </svg>
      )
    case 'back':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5"/>
          <path d="M12 19l-7-7 7-7"/>
        </svg>
      )
    case 'home':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 11l9-8 9 8"/>
          <path d="M5 10v10h14V10"/>
        </svg>
      )
    case 'recent':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="5" width="14" height="14" rx="2"/>
          <path d="M9 5V3h12v12h-2"/>
        </svg>
      )
    case 'power':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v10"/>
          <path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>
        </svg>
      )
    default:
      return null
  }
}

function PhoneTile({ device, screenshot, selected, onSelect, onTap, onKey, onLaunchApp, onStop, registerTile }) {
  const imageRef = useRef(null)

  const handleTap = (event) => {
    const rect = imageRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return
    onTap(device.profileId, {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    })
  }

  return (
    <article className={`phone-tile ${selected ? 'selected' : ''}`} ref={node => registerTile(device.profileId, node)}>
      <button className="phone-preview-shell" onClick={onSelect} title={`Open ${device.name}`}>
        <div className="phone-preview-frame">
          {screenshot?.image ? (
            <img
              ref={imageRef}
              className="phone-preview"
              src={screenshot.image}
              alt={`${device.name} screen`}
              onClick={(event) => {
                event.stopPropagation()
                handleTap(event)
              }}
              draggable={false}
            />
          ) : (
            <div className="phone-preview-empty">
              <FarmIcon type="phone" />
              <span>Waiting</span>
            </div>
          )}
        </div>
      </button>

      <div className="phone-tile-info">
        <div>
          <div className="phone-name">{device.name}</div>
          <div className="phone-meta">{device.serial} · {device.proxyType}</div>
        </div>
        <span className="phone-live-dot">Live</span>
      </div>

      <div className="phone-controls">
        {CONTROL_KEYS.map(item => (
          <button key={item.key} className="phone-control-btn" title={item.label} onClick={() => onKey(device.profileId, item.key)}>
            <FarmIcon type={item.icon} />
          </button>
        ))}
        <button className="phone-control-btn phone-stop-btn" title="Stop profile" onClick={() => onStop(device.profileId)}>
          Stop
        </button>
      </div>

      <div className="phone-app-row">
        {APP_SHORTCUTS.map(item => (
          <button key={item.app} className="phone-app-btn" onClick={() => onLaunchApp(device.profileId, item.app)}>
            {item.label}
          </button>
        ))}
      </div>
    </article>
  )
}

function PhoneFarmPage({ onStopProfile }) {
  const [devices, setDevices] = useState([])
  const [screenshots, setScreenshots] = useState({})
  const [focusShot, setFocusShot] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [broadcastTap, setBroadcastTap] = useState(false)
  const [gridMetrics, setGridMetrics] = useState({ scrollTop: 0, height: 0, width: 0 })
  const refreshingRef = useRef(false)
  const focusRefreshingRef = useRef(false)
  const scrollFrameRef = useRef(0)
  const tileRefs = useRef(new Map())
  const visibleIdsRef = useRef(new Set())
  const gridRef = useRef(null)

  const selectedDevice = useMemo(
    () => devices.find(device => device.profileId === selectedId) || devices[0] || null,
    [devices, selectedId]
  )

  const virtualGrid = useMemo(() => {
    const width = Math.max(1, gridMetrics.width || 1)
    const columns = Math.max(1, Math.floor((width + TILE_GAP) / (TILE_MIN_WIDTH + TILE_GAP)))
    const rowCount = Math.ceil(devices.length / columns)
    const rowHeight = TILE_HEIGHT + TILE_GAP
    const firstRow = Math.max(0, Math.floor((gridMetrics.scrollTop || 0) / rowHeight) - GRID_OVERSCAN_ROWS)
    const visibleRows = Math.ceil((gridMetrics.height || 640) / rowHeight) + GRID_OVERSCAN_ROWS * 2 + 1
    const lastRow = Math.min(rowCount, firstRow + visibleRows)
    const startIndex = firstRow * columns
    const endIndex = Math.min(devices.length, lastRow * columns)
    return {
      columns,
      rowCount,
      rowHeight,
      top: firstRow * rowHeight,
      height: Math.max(0, rowCount * rowHeight),
      devices: devices.slice(startIndex, endIndex)
    }
  }, [devices, gridMetrics])

  const refreshDevices = useCallback(async () => {
    try {
      setError('')
      const list = await window.electronAPI.listPhoneFarmDevices()
      const nextList = Array.isArray(list) ? list : []
      setDevices(nextList)
      setSelectedId(current => {
        if (current && nextList.some(device => device.profileId === current)) return current
        return nextList[0]?.profileId || ''
      })
      return nextList
    } catch (err) {
      setError(err.message || 'Could not load Android devices')
      setDevices([])
      setFocusShot(null)
      return []
    }
  }, [])

  const registerTile = useCallback((profileId, node) => {
    if (node) tileRefs.current.set(profileId, node)
    else tileRefs.current.delete(profileId)
  }, [])

  const updateGridMetrics = useCallback(() => {
    const node = gridRef.current
    if (!node) return
    setGridMetrics(current => {
      const next = {
        scrollTop: node.scrollTop,
        height: node.clientHeight,
        width: node.clientWidth
      }
      if (
        Math.abs(current.scrollTop - next.scrollTop) < 4 &&
        current.height === next.height &&
        current.width === next.width
      ) {
        return current
      }
      return next
    })
  }, [])

  const getVisibleDevices = useCallback((deviceList = devices) => {
    if (!deviceList.length) return []
    const visible = visibleIdsRef.current
    const selectedDeviceForCapture = selectedId
      ? deviceList.find(device => device.profileId === selectedId)
      : null
    const candidates = deviceList.filter(device => visible.has(device.profileId))
    const candidateIds = new Set(candidates.map(device => device.profileId))
    const virtualIds = new Set(virtualGrid.devices.map(device => device.profileId))
    const virtualCandidates = deviceList.filter(device => virtualIds.has(device.profileId))
    const selectedFirst = [
      ...(selectedDeviceForCapture ? [selectedDeviceForCapture] : []),
      ...candidates.filter(device => device.profileId !== selectedDeviceForCapture?.profileId),
      ...virtualCandidates.filter(device =>
        device.profileId !== selectedDeviceForCapture?.profileId &&
        !candidateIds.has(device.profileId)
      )
    ]
    return selectedFirst.slice(0, MAX_VISIBLE_CAPTURE)
  }, [devices, selectedId, virtualGrid.devices])

  const refreshScreenshots = useCallback(async (deviceList = devices, options = {}) => {
    if (!deviceList.length || refreshingRef.current) return
    refreshingRef.current = true
    setLoading(true)
    try {
      const captureDevices = getVisibleDevices(deviceList)

      const entries = await runInBatches(captureDevices, async device => {
        try {
          const shot = await window.electronAPI.getPhoneFarmScreenshot(device.profileId)
          return [device.profileId, shot]
        } catch (err) {
          return [device.profileId, { error: err.message || 'Screenshot failed' }]
        }
      }, 3)
      const nextShots = Object.fromEntries(entries)
      const keepIds = new Set(captureDevices.map(device => device.profileId))
      if (selectedDevice?.profileId) keepIds.add(selectedDevice.profileId)
      setScreenshots(prev => {
        const next = {}
        for (const id of keepIds) {
          if (nextShots[id] || prev[id]) next[id] = nextShots[id] || prev[id]
        }
        for (const [id, shot] of Object.entries(prev)) {
          if (Object.keys(next).length >= SCREENSHOT_CACHE_LIMIT) break
          if (!next[id] && shot) next[id] = shot
        }
        return next
      })
    } finally {
      refreshingRef.current = false
      setLoading(false)
    }
  }, [devices, getVisibleDevices, selectedDevice?.profileId])

  const refreshFocusShot = useCallback(async (device = selectedDevice) => {
    if (!device || focusRefreshingRef.current) return
    focusRefreshingRef.current = true
    try {
      const shot = await window.electronAPI.getPhoneFarmScreenshot(device.profileId)
      setFocusShot(shot)
      setScreenshots(prev => ({ ...prev, [device.profileId]: shot }))
    } catch (err) {
      setFocusShot({ error: err.message || 'Focused screenshot failed' })
    } finally {
      focusRefreshingRef.current = false
    }
  }, [selectedDevice])

  useEffect(() => {
    refreshDevices()
  }, [refreshDevices])

  useEffect(() => {
    if (!devices.length) return
    const observer = new IntersectionObserver((entries) => {
      const nextVisible = new Set(visibleIdsRef.current)
      for (const entry of entries) {
        const profileId = entry.target.getAttribute('data-profile-id')
        if (!profileId) continue
        if (entry.isIntersecting) nextVisible.add(profileId)
        else nextVisible.delete(profileId)
      }
      visibleIdsRef.current = nextVisible
    }, {
      root: gridRef.current,
      threshold: 0.08,
      rootMargin: '280px'
    })

    for (const device of virtualGrid.devices) {
      const node = tileRefs.current.get(device.profileId)
      if (node) {
        node.setAttribute('data-profile-id', device.profileId)
        observer.observe(node)
      }
    }

    return () => observer.disconnect()
  }, [devices, virtualGrid.devices])

  useEffect(() => {
    updateGridMetrics()
    const node = gridRef.current
    if (!node) return undefined
    const onScroll = () => {
      if (scrollFrameRef.current) return
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = 0
        updateGridMetrics()
      })
    }
    const resizeObserver = new ResizeObserver(updateGridMetrics)
    node.addEventListener('scroll', onScroll, { passive: true })
    resizeObserver.observe(node)
    return () => {
      if (scrollFrameRef.current) window.cancelAnimationFrame(scrollFrameRef.current)
      node.removeEventListener('scroll', onScroll)
      resizeObserver.disconnect()
    }
  }, [updateGridMetrics])

  useEffect(() => {
    if (!devices.length) return
    const timeout = setTimeout(() => {
      updateGridMetrics()
      refreshScreenshots(devices)
      refreshFocusShot()
    }, 120)
    return () => clearTimeout(timeout)
  }, [devices, updateGridMetrics, refreshScreenshots, refreshFocusShot])

  useEffect(() => {
    if (!devices.length) return undefined
    const frame = window.requestAnimationFrame(updateGridMetrics)
    return () => window.cancelAnimationFrame(frame)
  }, [devices.length, updateGridMetrics])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const timer = setInterval(async () => {
      const list = await window.electronAPI.listPhoneFarmDevices().catch(() => devices)
      if (Array.isArray(list)) {
        setDevices(list)
        await refreshScreenshots(list)
      }
    }, THUMBNAIL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [autoRefresh, devices, refreshScreenshots])

  useEffect(() => {
    if (!autoRefresh || !selectedDevice) return undefined
    const timer = setInterval(() => {
      refreshFocusShot(selectedDevice)
    }, FOCUS_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [autoRefresh, selectedDevice, refreshFocusShot])

  const tapDevice = async (profileId, point) => {
    try {
      const targets = broadcastTap ? devices.map(device => device.profileId) : [profileId]
      await runInBatches(targets, id => window.electronAPI.tapPhoneFarmDevice(id, point), 8)
      setTimeout(() => {
        refreshFocusShot()
        refreshScreenshots(devices)
      }, 180)
    } catch (err) {
      setError(err.message || 'Tap failed')
    }
  }

  const sendKey = async (profileId, key, all = false) => {
    try {
      const targets = all ? devices.map(device => device.profileId) : [profileId]
      await runInBatches(targets, id => window.electronAPI.sendPhoneFarmKey(id, key), 8)
      setTimeout(() => {
        refreshFocusShot()
        refreshScreenshots(devices)
      }, 220)
    } catch (err) {
      setError(err.message || 'Command failed')
    }
  }

  const launchApp = async (profileId, appName, all = false) => {
    try {
      const targets = all ? devices.map(device => device.profileId) : [profileId]
      await runInBatches(targets, id => window.electronAPI.launchPhoneFarmApp(id, appName), 6)
      setTimeout(() => {
        refreshFocusShot()
        refreshScreenshots(devices)
      }, 700)
    } catch (err) {
      setError(err.message || 'App launch failed')
    }
  }

  const stopProfile = async (profileId) => {
    await onStopProfile(profileId)
    setTimeout(refreshDevices, 500)
  }

  const handleSelect = (profileId) => {
    setSelectedId(profileId)
    const device = devices.find(item => item.profileId === profileId)
    setFocusShot(screenshots[profileId] || null)
    setTimeout(() => refreshFocusShot(device), 60)
  }

  return (
    <div className="phone-farm-page">
      <header className="phone-farm-header">
        <div className="phone-farm-title">
          <span className="phone-farm-title-icon"><FarmIcon type="grid" /></span>
          <div>
            <h1>PHONE FARM</h1>
            <p>{devices.length} Android phone{devices.length === 1 ? '' : 's'} running</p>
          </div>
        </div>
        <div className="phone-farm-stats">
          <span><strong>{Math.min(virtualGrid.devices.length, MAX_VISIBLE_CAPTURE)}</strong> visible</span>
          <span><strong>{selectedDevice ? '1' : '0'}</strong> focused</span>
          <span><strong>{autoRefresh ? 'ON' : 'OFF'}</strong> live</span>
        </div>
        <div className="phone-farm-actions">
          <button className={`phone-toggle ${broadcastTap ? 'active' : ''}`} onClick={() => setBroadcastTap(v => !v)}>
            {broadcastTap ? 'Broadcast taps' : 'Single tap'}
          </button>
          <button className={`phone-toggle ${autoRefresh ? 'active' : ''}`} onClick={() => setAutoRefresh(v => !v)}>
            {autoRefresh ? 'Live refresh' : 'Paused'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            const list = await refreshDevices()
            await refreshScreenshots(list, { full: true })
          }}>
            <FarmIcon type="refresh" />
            Refresh
          </button>
        </div>
      </header>

      {error && <div className="phone-farm-error">{error}</div>}

      {devices.length === 0 ? (
        <div className="phone-farm-empty">
          <FarmIcon type="phone" />
          <h2>No Android phones running</h2>
          <p>Run Android profiles first, then this view will show them here.</p>
        </div>
      ) : (
        <div className="phone-farm-layout">
          <section className="phone-farm-grid" ref={gridRef}>
            <div className="phone-broadcast-bar">
              <span>Control all phones</span>
              <button onClick={() => sendKey('', 'back', true)}>Back</button>
              <button onClick={() => sendKey('', 'home', true)}>Home</button>
              <button onClick={() => sendKey('', 'wake', true)}>Wake</button>
              <button onClick={() => launchApp('', 'youtube', true)}>YouTube</button>
              <button onClick={() => launchApp('', 'kick', true)}>Kick</button>
              <button onClick={() => launchApp('', 'chrome', true)}>Chrome</button>
            </div>
            <div className="phone-virtual-spacer" style={{ height: virtualGrid.height }}>
              <div
                className="phone-virtual-items"
                style={{
                  transform: `translateY(${virtualGrid.top}px)`,
                  gridTemplateColumns: `repeat(${virtualGrid.columns}, minmax(0, 1fr))`
                }}
              >
                {virtualGrid.devices.map(device => (
                  <PhoneTile
                    key={device.profileId}
                    device={device}
                    screenshot={screenshots[device.profileId]}
                    selected={selectedDevice?.profileId === device.profileId}
                    onSelect={() => handleSelect(device.profileId)}
                    onTap={tapDevice}
                    onKey={sendKey}
                    onLaunchApp={launchApp}
                    onStop={stopProfile}
                    registerTile={registerTile}
                  />
                ))}
              </div>
            </div>
          </section>

          <aside className="phone-focus-panel">
            <div className="phone-focus-head">
              <div>
                <span>Selected</span>
                <strong>{selectedDevice?.name}</strong>
              </div>
              <span className={`phone-capture-state ${loading ? 'busy' : ''}`}>{loading ? 'Updating' : 'Ready'}</span>
            </div>
            <div className="phone-focus-frame">
              {selectedDevice && (focusShot?.image || screenshots[selectedDevice.profileId]?.image) ? (
                <img
                  className="phone-focus-screen"
                  src={focusShot?.image || screenshots[selectedDevice.profileId].image}
                  alt={`${selectedDevice.name} focused screen`}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    tapDevice(selectedDevice.profileId, {
                      x: (event.clientX - rect.left) / rect.width,
                      y: (event.clientY - rect.top) / rect.height
                    })
                  }}
                  draggable={false}
                />
              ) : (
                <div className="phone-preview-empty large">
                  <FarmIcon type="phone" />
                  <span>No preview yet</span>
                </div>
              )}
            </div>
            {selectedDevice && (
              <div className="phone-focus-controls">
                {CONTROL_KEYS.map(item => (
                  <button key={item.key} className="btn btn-ghost btn-sm" onClick={() => sendKey(selectedDevice.profileId, item.key)}>
                    <FarmIcon type={item.icon} />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

export default PhoneFarmPage
