// Automation script execution engine for Profileo
// Runs declarative automation scripts via puppeteer on profile browsers

import { AUTOMATION_SCRIPTS } from './automationScripts.js'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import extract from 'extract-zip'

const KICK_ANDROID_PACKAGE = 'com.kick.mobile'
const KICK_PLAY_STORE_MARKET_URL = 'market://details?id=com.kick.mobile'
const KICK_PLAY_STORE_WEB_URL = 'https://play.google.com/store/apps/details?id=com.kick.mobile&hl=de'

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

export class AutomationEngine {
  constructor(profileManager) {
    this.profileManager = profileManager
    this.runningScripts = new Map() // profileId -> { scriptId, status, currentStep, totalSteps, error, cancel }
    this.mainWindow = null
  }

  setMainWindow(win) {
    this.mainWindow = win
  }

  _readUserScripts() {
    try {
      const dataDir = path.join(app.getPath('userData'), 'data')
      const file = path.join(dataDir, 'userScripts.json')
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'))
      }
    } catch (e) {
      console.error('Read user scripts error:', e)
    }
    return []
  }

  getScripts() {
    const systemScripts = AUTOMATION_SCRIPTS.map(s => ({
      id: s.id,
      platform: s.platform,
      name: s.name,
      description: s.description,
      price: s.price,
      type: s.type,
      params: s.params
    }))
    return systemScripts
  }

  getAllStatuses() {
    const result = {}
    for (const [pid, info] of this.runningScripts) {
      result[pid] = { scriptId: info.scriptId, status: info.status, currentStep: info.currentStep, totalSteps: info.totalSteps, error: info.error }
    }
    return result
  }

  getProfileState(scriptId, profileId) {
    return this._readAutomationProfileState(profileId, scriptId)
  }

  saveProfileState(scriptId, profileId, data) {
    this._writeAutomationProfileState(profileId, scriptId, {
      ...this._readAutomationProfileState(profileId, scriptId),
      ...(data || {}),
      updatedAt: new Date().toISOString()
    })
    return { success: true }
  }

  async runScript(profileId, scriptId, params) {
    if (this.runningScripts.has(profileId)) {
      return { success: false, error: 'Script already running on this profile' }
    }

    let scriptDef = AUTOMATION_SCRIPTS.find(s => s.id === scriptId)
    // If not a system script, search user scripts
    if (!scriptDef) {
      const userScripts = this._readUserScripts()
      scriptDef = userScripts.find(s => s.id === scriptId)
    }
    if (!scriptDef) return { success: false, error: 'Script not found' }

    // Count total steps for progress
    const countSteps = this._resolveParams(JSON.parse(JSON.stringify(scriptDef.steps)), params)
    const totalSteps = this._countSteps(countSteps)
    let cancelled = false
    const cancelRef = { get: () => cancelled, set: () => { cancelled = true } }

    this.runningScripts.set(profileId, {
      scriptId,
      status: 'running',
      currentStep: 0,
      totalSteps,
      error: null,
      cancel: cancelRef
    })
    this._emitProgress(profileId)

    // Run in background
    this._executeScript(profileId, scriptDef, params, cancelRef, totalSteps).catch(err => {
      console.error(`[Automation] Script execution failed for profile ${profileId}:`, err.message)
      const info = this.runningScripts.get(profileId)
      if (info && info.status === 'running') {
        info.status = 'error'
        info.error = err.message || 'Unknown error'
        this._emitProgress(profileId)
        setTimeout(() => this.runningScripts.delete(profileId), 10000)
      }
    })
    return { success: true }
  }

  async stopScript(profileId) {
    const info = this.runningScripts.get(profileId)
    if (info && info.cancel) {
      info.cancel.set()
      info.status = 'stopped'
      this._emitProgress(profileId)
      setTimeout(() => this.runningScripts.delete(profileId), 3000)
    }
    return { success: true }
  }

  async _executeScript(profileId, scriptDef, params, cancelRef, totalSteps) {
    let stepCounter = { value: 0 }

    try {
      // Script started
      const profile = this.profileManager.getProfile(profileId)
      if (!profile) throw new Error('Profile not found')

      if (profile.os === 'Android' && scriptDef.id === 'youtube-watch-live-search') {
        await this._executeAndroidYouTubeSearchWatch(profile, params, cancelRef, profileId, stepCounter, totalSteps)
        if (!cancelRef.get()) {
          const info = this.runningScripts.get(profileId)
          if (info) {
            info.status = 'completed'
            info.currentStep = totalSteps
            this._emitProgress(profileId)
          }
          setTimeout(() => this.runningScripts.delete(profileId), 5000)
        }
        return
      }

      if (profile.os === 'Android' && scriptDef.id === 'kick-watch-follow') {
        await this._executeAndroidKickPrepare(profile, cancelRef, profileId, stepCounter, totalSteps)
        if (!cancelRef.get()) {
          const info = this.runningScripts.get(profileId)
          if (info) {
            info.status = 'completed'
            info.currentStep = totalSteps
            this._emitProgress(profileId)
          }
          setTimeout(() => this.runningScripts.delete(profileId), 5000)
        }
        return
      }

      if (profile.os === 'Android' && scriptDef.id === 'kick-watch-comment') {
        await this._executeAndroidKickSearchWatch(profile, params, cancelRef, profileId, stepCounter, totalSteps)
        return
      }

      // Ensure browser is running
      let browser = this.profileManager.getBrowser(profileId)
      if (browser && browser.kind === 'native') {
        throw new Error('Close the standard browser before running an automation script on this profile.')
      }
      if (!browser) {
        // Launching browser for automation
        await this.profileManager.launchBrowser(profileId, { mode: 'automation' })
        browser = this.profileManager.getBrowser(profileId)
        // Wait for browser to be fully ready after launch
        await new Promise(r => setTimeout(r, 2000))
      }
      if (!browser) throw new Error('Failed to launch browser')

      const pages = await browser.pages()
      const page = pages[0] || await browser.newPage()
      // Page ready

      // Small delay to ensure page is interactive
      await new Promise(r => setTimeout(r, 500))

      // Resolve params in steps
      const resolvedSteps = this._resolveParams(JSON.parse(JSON.stringify(scriptDef.steps)), params)

      // Override first navigate step URL if targetUrl is provided
      if (params.targetUrl && params.targetUrl.trim()) {
        const firstNav = resolvedSteps.find(s => s.action === 'navigate')
        if (firstNav) {
          firstNav.url = params.targetUrl.trim()
        }
      }

      // Execute steps
      await this._executeSteps(page, resolvedSteps, cancelRef, profileId, stepCounter, totalSteps)

      if (!cancelRef.get()) {
        const info = this.runningScripts.get(profileId)
        if (info) {
          info.status = 'completed'
          info.currentStep = totalSteps
          this._emitProgress(profileId)
        }
        setTimeout(() => this.runningScripts.delete(profileId), 5000)
      }
    } catch (err) {
      const info = this.runningScripts.get(profileId)
      if (info && info.status === 'running') {
        info.status = 'error'
        info.error = err.message || 'Unknown error'
        this._emitProgress(profileId)
        setTimeout(() => this.runningScripts.delete(profileId), 10000)
      }
    }
  }

  async _executeSteps(page, steps, cancelRef, profileId, stepCounter, totalSteps) {
    for (const step of steps) {
      if (cancelRef.get()) return

      try {
        await this._executeStep(page, step, cancelRef, profileId, stepCounter, totalSteps)
      } catch (err) {
        // If step is optional, skip errors
        if (step.optional) continue
        // For non-critical errors (timeout, selector not found), log and continue
        if (err.message?.includes('timeout') || err.message?.includes('Waiting for selector') || err.message?.includes('No element found')) {
          continue
        }
        throw err
      }

      stepCounter.value++
      const info = this.runningScripts.get(profileId)
      if (info) {
        info.currentStep = Math.min(stepCounter.value, totalSteps)
        this._emitProgress(profileId)
      }
    }
  }

  async _executeStep(page, step, cancelRef, profileId, stepCounter, totalSteps) {
    switch (step.action) {
      case 'navigate': {
        let navUrl = step.url || ''
        if (navUrl && !navUrl.startsWith('http://') && !navUrl.startsWith('https://')) {
          navUrl = 'https://' + navUrl
        }
        if (navUrl) {
          await page.goto(navUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch((err) => {
            console.error(`[Automation] Navigate error for ${navUrl}:`, err.message)
          })
        }
        break
      }

      case 'click': {
        const selectors = step.selector.split(',').map(s => s.trim())
        let clicked = false
        for (const sel of selectors) {
          try {
            await page.waitForSelector(sel, { timeout: 10000 })
            try {
              await page.click(sel)
              clicked = true
              break
            } catch (clickErr) {
              // Fallback: click via JavaScript
              const jsClicked = await page.evaluate((s) => {
                const el = document.querySelector(s)
                if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true }
                return false
              }, sel)
              if (jsClicked) {
                clicked = true
                break
              }
            }
          } catch (err) {
            // Selector not found, try next
          }
        }
        if (!clicked && !step.optional) throw new Error(`No element found: ${step.selector}`)
        break
      }

      case 'type': {
        const selectors = step.selector.split(',').map(s => s.trim())
        let typed = false
        for (const sel of selectors) {
          try {
            await page.waitForSelector(sel, { timeout: 10000 })
            // Found element, trying to type
            // Try 1: Normal click + type
            try {
              await page.click(sel, { clickCount: 3 })
              await page.type(sel, step.text || '', { delay: step.delay || 50 })
              // Typed successfully
              typed = true
              break
            } catch (clickErr) {
              // Click+type failed, trying keyboard fallback
              // Try 2: Focus via JS + keyboard.type
              try {
                await page.evaluate((s) => {
                  const el = document.querySelector(s)
                  if (el) {
                    el.scrollIntoView({ block: 'center' })
                    el.focus()
                    el.click()
                    el.value = ''
                    el.dispatchEvent(new Event('focus', { bubbles: true }))
                  }
                }, sel)
                await new Promise(r => setTimeout(r, 300))
                await page.keyboard.type(step.text || '', { delay: step.delay || 50 })
                // Keyboard fallback succeeded
                typed = true
                break
              } catch (kbErr) {
                // Keyboard fallback failed
              }
            }
          } catch (err) {
            // Type selector not found, try next
          }
        }
        if (!typed) {
          // Last resort: type with keyboard wherever focus is
          await page.keyboard.type(step.text || '', { delay: step.delay || 50 })
        }
        break
      }

      case 'waitForSelector':
        await page.waitForSelector(step.selector, { timeout: step.timeout || 10000 })
        break

      case 'waitForNavigation':
        await page.waitForNavigation({ timeout: step.timeout || 15000 }).catch((err) => {
          console.log(`[Automation] Wait for navigation timeout: ${err.message}`)
        })
        break

      case 'wait': {
        const ms = this._parseDuration(step.duration)
        await new Promise(r => setTimeout(r, ms))
        break
      }

      case 'youtubeSearchWatchLive': {
        await this._runYouTubeSearchWatchLive(page, step, cancelRef)
        break
      }

      case 'scroll': {
        const amount = typeof step.amount === 'string' ? parseInt(step.amount) || 3 : (step.amount || 3)
        for (let i = 0; i < amount; i++) {
          if (cancelRef.get()) return
          await page.evaluate((dir) => {
            window.scrollBy(0, dir === 'up' ? -window.innerHeight * 0.8 : window.innerHeight * 0.8)
          }, step.direction || 'down')
          await new Promise(r => setTimeout(r, 300))
        }
        break
      }

      case 'scrollToElement':
        try {
          await page.evaluate((sel) => {
            document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, step.selector)
          await new Promise(r => setTimeout(r, 500))
        } catch (_) {}
        break

      case 'goBack':
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch((err) => {
          console.log(`[Automation] Go back error: ${err.message}`)
        })
        break

      case 'evaluate':
        try {
          await page.evaluate(step.script)
        } catch (err) {
          console.log(`[Automation] Evaluate error: ${err.message}`)
        }
        break

      case 'clickText': {
        const searchText = step.text || ''
        const isOptional = step.optional || false
        console.log('[Automation] clickText: looking for "' + searchText + '"')
        try {
          let found = false

          // Method 1: Find buttons/links with matching text (most precise)
          const clickables = await page.$$('button, a, [role="button"]')
          console.log('[Automation] clickText: checking ' + clickables.length + ' clickable elements')
          for (const el of clickables) {
            const txt = await page.evaluate(b => b.textContent && b.textContent.trim(), el).catch(() => '')
            if (txt === searchText) {
              await el.click()
              console.log('[Automation] clickText: CLICKED button with exact text "' + searchText + '"')
              found = true
              break
            }
          }

          // Method 2: Partial match on buttons
          if (!found) {
            for (const el of clickables) {
              const txt = await page.evaluate(b => b.textContent, el).catch(() => '')
              if (txt && txt.includes(searchText) && txt.length < searchText.length + 20) {
                await el.click()
                console.log('[Automation] clickText: CLICKED button containing "' + searchText + '"')
                found = true
                break
              }
            }
          }

          // Method 3: Check iframes for buttons
          if (!found) {
            const frames = page.frames()
            for (const frame of frames) {
              try {
                const frameBtns = await frame.$$('button, a, [role="button"]')
                for (const el of frameBtns) {
                  const txt = await frame.evaluate(b => b.textContent && b.textContent.trim(), el).catch(() => '')
                  if (txt === searchText || (txt && txt.includes(searchText) && txt.length < searchText.length + 20)) {
                    await el.click()
                    console.log('[Automation] clickText: CLICKED in iframe "' + searchText + '"')
                    found = true
                    break
                  }
                }
                if (found) break
              } catch (_) {}
            }
          }

          // Method 4: Fallback to text/ selector (any element)
          if (!found) {
            try {
              const el = await page.waitForSelector('text/' + searchText, { timeout: 5000 })
              if (el) {
                await el.click()
                console.log('[Automation] clickText: CLICKED via text/ selector fallback')
                found = true
              }
            } catch (_) {}
          }

          if (!found) {
            console.log('[Automation] clickText: NOT FOUND "' + searchText + '"')
            if (!isOptional) throw new Error('No element with text "' + searchText + '" found')
          }
        } catch (err) {
          console.log('[Automation] clickText ERROR: ' + err.message)
          if (!isOptional) throw err
        }
        break
      }

      case 'keypress':
        try {
          await page.keyboard.press(step.key || 'Enter')
        } catch (err) {
          console.log(`[Automation] Keypress error: ${err.message}`)
        }
        break

      case 'closeTab':
        try {
          await page.close()
        } catch (err) {
          console.log(`[Automation] Close tab error: ${err.message}`)
        }
        break

      case 'reloadTab':
        try {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
        } catch (err) {
          console.log(`[Automation] Reload error: ${err.message}`)
        }
        break

      case 'setVariable':
        // Variables are resolved at param level; this is a no-op step marker
        break

      case 'stopLoop':
        // Signal to break out of current loop — handled by loop executor
        break

      case 'condition':
        // Check if selector exists; skip next steps if not found
        try {
          await page.waitForSelector(step.selector, { timeout: 3000 })
        } catch (_) {
          // Selector not found — condition failed, skip
        }
        break

      case 'loop': {
        const elements = await page.$$(step.selector)
        const max = typeof step.maxIterations === 'string' ? parseInt(step.maxIterations) || 5 : (step.maxIterations || 5)
        const count = Math.min(elements.length, max)

        for (let i = 0; i < count; i++) {
          if (cancelRef.get()) return
          // Replace __current__ in child steps with nth-child selector
          const childSteps = this._resolveCurrentElement(step.steps, step.selector, i)
          await this._executeSteps(page, childSteps, cancelRef, profileId, stepCounter, totalSteps)
        }
        break
      }

      case 'repeatBlock': {
        const count = typeof step.count === 'string' ? parseInt(step.count) || 1 : (step.count || 1)
        for (let i = 0; i < count; i++) {
          if (cancelRef.get()) return
          await this._executeSteps(page, step.steps, cancelRef, profileId, stepCounter, totalSteps)
        }
        break
      }

      default:
        break
    }
  }

  async _runYouTubeSearchWatchLive(page, step, cancelRef) {
    const keyword = String(step.keyword || '').trim()
    const maxStreams = Math.max(1, Math.min(parseInt(step.maxStreams, 10) || 5, 20))
    const watchMin = Math.max(10, parseInt(step.watchMin, 10) || 30)
    const watchMax = Math.max(watchMin, parseInt(step.watchMax, 10) || 120)
    const rawTarget = String(step.targetUrl || '').trim()
    const directTarget = rawTarget && !/^\{\{.+\}\}$/.test(rawTarget) ? rawTarget : ''
    const targetUrl = directTarget && !/^https?:\/\//i.test(directTarget) ? `https://${directTarget}` : directTarget
    const searchUrl = targetUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`

    if (!directTarget && !keyword) {
      throw new Error('Search keyword is required.')
    }

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await this._settlePage(page, cancelRef, 3500)
    await this._dismissYouTubePopups(page)
    await this._settlePage(page, cancelRef, 1200)

    const visited = new Set()
    for (let i = 0; i < maxStreams; i += 1) {
      if (cancelRef.get()) return

      const videoUrls = await this._collectYouTubeVideoUrls(page, visited)
      if (!videoUrls.length) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.8)).catch(() => {})
        await this._settlePage(page, cancelRef, 1800)
        const moreUrls = await this._collectYouTubeVideoUrls(page, visited)
        if (!moreUrls.length) break
        videoUrls.push(...moreUrls)
      }

      const nextUrl = videoUrls[0]
      visited.add(nextUrl)
      await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
      await this._settlePage(page, cancelRef, 4500)
      await this._dismissYouTubePopups(page)
      await this._startYouTubePlayback(page)
      await this._humanWatch(page, cancelRef, watchMin, watchMax)

      if (cancelRef.get()) return
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await this._settlePage(page, cancelRef, 1800)
    }
  }

  async _settlePage(page, cancelRef, ms) {
    const started = Date.now()
    while (Date.now() - started < ms) {
      if (cancelRef.get()) return
      await new Promise(r => setTimeout(r, Math.min(500, ms - (Date.now() - started))))
    }
  }

  async _dismissYouTubePopups(page) {
    await page.evaluate(() => {
      const texts = ['accept all', 'i agree', 'got it', 'skip trial', 'no thanks', 'not now']
      const clickables = Array.from(document.querySelectorAll('button, tp-yt-paper-button, yt-button-renderer button, [role="button"]'))
      for (const el of clickables) {
        const text = (el.textContent || '').trim().toLowerCase()
        if (texts.some(t => text.includes(t))) {
          el.click()
          return true
        }
      }
      return false
    }).catch(() => false)
  }

  async _collectYouTubeVideoUrls(page, visited) {
    const urls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/watch"]'))
      return anchors
        .map(anchor => {
          const href = anchor.href || ''
          const videoId = new URL(href, location.href).searchParams.get('v')
          return videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''
        })
        .filter(Boolean)
    }).catch(() => [])

    return [...new Set(urls)].filter(url => !visited.has(url))
  }

  async _startYouTubePlayback(page) {
    await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'))
      for (const video of videos) {
        try {
          video.muted = true
          const playResult = video.play()
          if (playResult && typeof playResult.catch === 'function') playResult.catch(() => {})
        } catch (_) {}
      }

      const buttons = Array.from(document.querySelectorAll('button, .ytp-large-play-button, .ytp-play-button'))
      for (const button of buttons) {
        const label = `${button.getAttribute('aria-label') || ''} ${button.title || ''}`.toLowerCase()
        if (label.includes('play') || button.classList.contains('ytp-large-play-button')) {
          button.click()
          break
        }
      }
    }).catch(() => {})
  }

  async _humanWatch(page, cancelRef, minSec, maxSec) {
    const duration = (Math.random() * (maxSec - minSec) + minSec) * 1000
    const started = Date.now()
    while (Date.now() - started < duration) {
      if (cancelRef.get()) return
      await page.evaluate(() => {
        const video = document.querySelector('video')
        if (video) {
          try {
            video.muted = true
            if (video.paused) video.play().catch(() => {})
          } catch (_) {}
        }
      }).catch(() => {})
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  async _executeAndroidYouTubeSearchWatch(profile, params, cancelRef, profileId, stepCounter, totalSteps) {
    const keyword = String(params?.keyword || '').trim()
    if (!keyword) throw new Error('Search keyword is required.')

    let controller = this.profileManager.getBrowser(profile.id)
    if (controller && controller.kind !== 'android-emulator') {
      throw new Error('Close the standard browser before running Android YouTube automation on this profile.')
    }

    if (!controller) {
      await this.profileManager.launchBrowser(profile.id, { mode: 'automation' })
      controller = this.profileManager.getBrowser(profile.id)
    }
    if (!controller || controller.kind !== 'android-emulator') {
      throw new Error('Failed to launch Android profile.')
    }

    await controller.ready.catch(error => {
      throw new Error(error.message || 'Android profile was not ready.')
    })

    await this._androidOpenYouTubeSearch(controller, keyword)
    await this._androidWaitForYouTubeResults(controller, keyword, 10000)
    await this._markStep(profileId, stepCounter, totalSteps)

    if (cancelRef.get()) return
    await this._androidTapYouTubeResult(controller, keyword, 0)
    await this._markStep(profileId, stepCounter, totalSteps)
  }

  async _executeAndroidKickPrepare(profile, cancelRef, profileId, stepCounter, totalSteps) {
    let controller = this.profileManager.getBrowser(profile.id)
    if (controller && controller.kind !== 'android-emulator') {
      throw new Error('Close the standard browser before running Android Kick automation on this profile.')
    }

    if (!controller) {
      await this.profileManager.launchBrowser(profile.id, { mode: 'automation' })
      controller = this.profileManager.getBrowser(profile.id)
    }
    if (!controller || controller.kind !== 'android-emulator') {
      throw new Error('Failed to launch Android profile.')
    }

    await controller.ready.catch(error => {
      throw new Error(error.message || 'Android profile was not ready.')
    })

    await this._androidEnsureKickInstalled(controller)
    await this._markStep(profileId, stepCounter, totalSteps)

    if (cancelRef.get()) return
    await this._androidOpenKickApp(controller)
    await this._markStep(profileId, stepCounter, totalSteps)
  }

  _automationProfileDataDir(profileId) {
    const safeProfileId = String(profileId || 'profile').replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(app.getPath('userData'), 'data', 'automation', safeProfileId)
  }

  _automationProfileStateFile(profileId, scriptId) {
    const safeScriptId = String(scriptId || 'script').replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(this._automationProfileDataDir(profileId), `${safeScriptId}.json`)
  }

  _readAutomationProfileState(profileId, scriptId) {
    try {
      const file = this._automationProfileStateFile(profileId, scriptId)
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (_) {}
    return {}
  }

  _writeAutomationProfileState(profileId, scriptId, data) {
    try {
      const dir = this._automationProfileDataDir(profileId)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this._automationProfileStateFile(profileId, scriptId), JSON.stringify(data, null, 2))
    } catch (_) {}
  }

  _readKeywordFromFile(filePath) {
    if (!filePath) return ''
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      return String(content)
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(Boolean) || ''
    } catch (_) {
      return ''
    }
  }

  _readLinesFromFile(filePath) {
    if (!filePath) return []
    try {
      return fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
    } catch (_) {
      return []
    }
  }

  _resolveProfileKeyword(profileId, scriptId, params) {
    const state = this._readAutomationProfileState(profileId, scriptId)
    const keywordFile = String(params?.keywordFile || '').trim() || state.keywordFile || ''
    const keyword = String(params?.keyword || '').trim() || this._readKeywordFromFile(keywordFile) || state.keyword || ''
    this._writeAutomationProfileState(profileId, scriptId, {
      ...state,
      keyword,
      keywordFile,
      commentFile: String(params?.commentFile || '').trim() || state.commentFile || '',
      updatedAt: new Date().toISOString()
    })
    return { keyword, keywordFile }
  }

  async _executeAndroidKickSearchWatch(profile, params, cancelRef, profileId, stepCounter, totalSteps) {
    const { keyword } = this._resolveProfileKeyword(profile.id, 'kick-watch-comment', params)

    let controller = this.profileManager.getBrowser(profile.id)
    if (controller && controller.kind !== 'android-emulator') {
      throw new Error('Close the standard browser before running Android Kick automation on this profile.')
    }

    if (!controller) {
      await this.profileManager.launchBrowser(profile.id, { mode: 'automation' })
      controller = this.profileManager.getBrowser(profile.id)
    }
    if (!controller || controller.kind !== 'android-emulator') {
      throw new Error('Failed to launch Android profile.')
    }

    await controller.ready.catch(error => {
      throw new Error(error.message || 'Android profile was not ready.')
    })

    await this._androidEnsureKickInstalled(controller)
    await this._markStep(profileId, stepCounter, totalSteps)

    if (cancelRef.get()) return
    await this._androidOpenKickApp(controller)
    await this._markStep(profileId, stepCounter, totalSteps)

    if (!keyword) {
      await this._androidKeepOpen(controller, cancelRef)
      return
    }

    if (cancelRef.get()) return
    await this._androidKickOpenSearch(controller, keyword)
    await this._markStep(profileId, stepCounter, totalSteps)

    if (cancelRef.get()) return
    await this._androidKickOpenBestResult(controller, keyword)
    await this._markStep(profileId, stepCounter, totalSteps)

    await this._androidKickCommentLoop(profile.id, controller, params, cancelRef)
  }

  async _androidAdb(controller, args, timeout = 15000) {
    return this.profileManager.androidEmulatorManager._adb(controller.serial, args, {
      adbPath: controller.adbPath,
      timeout
    })
  }

  async _androidShell(controller, command, timeout = 15000) {
    return this.profileManager.androidEmulatorManager._adbShell(controller, command, { timeout })
  }

  async _androidOpenYouTubeSearch(controller, keyword) {
    const encoded = encodeURIComponent(keyword)
    const webUrl = `https://www.youtube.com/results?search_query=${encoded}`
    const intentUri = `intent://www.youtube.com/results?search_query=${encoded}#Intent;scheme=https;package=com.google.android.youtube;end`
    const hasYouTubeApp = await this._androidHasPackage(controller, 'com.google.android.youtube')

    if (hasYouTubeApp) {
      await this._androidAdb(controller, ['shell', 'am', 'force-stop', 'com.google.android.youtube'], 8000).catch(() => {})
      await this._androidAdb(controller, [
        'shell',
        'monkey',
        '-p',
        'com.google.android.youtube',
        '-c',
        'android.intent.category.LAUNCHER',
        '1'
      ], 15000).catch(() => {})
    }

    await new Promise(r => setTimeout(r, 3500))
    if (hasYouTubeApp) {
      try {
        await this._waitForAndroidPackage(controller, 'com.google.android.youtube', 12000)
        await this._androidShell(controller, `am start -a android.intent.action.SEARCH -p com.google.android.youtube --es query ${shellQuote(keyword)}`, 15000)
        await new Promise(r => setTimeout(r, 2500))
        await this._androidSubmitYouTubeSearch(controller, keyword, webUrl)
      } catch (_) {
        await this._androidAdb(controller, [
          'shell',
          'am',
          'start',
          '-a',
          'android.intent.action.VIEW',
          '-d',
          intentUri
        ], 15000)
      }
    } else {
      await this._androidAdb(controller, [
        'shell',
        'am',
        'start',
        '-a',
        'android.intent.action.VIEW',
        '-d',
        webUrl
      ], 15000)
    }

    await new Promise(r => setTimeout(r, 5000))
    await this._androidDismissYouTubePopups(controller)
  }

  async _androidSubmitYouTubeSearch(controller, keyword, fallbackUrl = '') {
    const expected = String(keyword || '').trim()
    if (!expected) return

    if (await this._androidWaitForYouTubeResults(controller, expected, 4500)) return

    for (const key of ['ENTER', 'KEYCODE_SEARCH']) {
      await this._androidAdb(controller, ['shell', 'input', 'keyevent', key], 5000).catch(() => {})
      if (await this._androidWaitForYouTubeResults(controller, expected, 3500)) return
    }

    const screen = await this._androidScreenSize(controller)
    await this._androidAdb(controller, [
      'shell',
      'input',
      'tap',
      String(Math.round(screen.width * 0.9)),
      String(Math.round(screen.height * 0.91))
    ], 8000).catch(() => {})
    if (await this._androidWaitForYouTubeResults(controller, expected, 3500)) return

    if (fallbackUrl) {
      await this._androidAdb(controller, [
        'shell',
        'am',
        'start',
        '-a',
        'android.intent.action.VIEW',
        '-d',
        fallbackUrl
      ], 15000).catch(() => {})
      await this._androidWaitForYouTubeResults(controller, expected, 6000)
    }
  }

  async _androidWaitForYouTubeResults(controller, keyword = '', timeout = 8000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await this._androidIsYouTubeResultsOpen(controller)) return true
      const point = await this._androidFindYouTubeResultPoint(controller, keyword, 0)
      if (point) return true
      await new Promise(r => setTimeout(r, 700))
    }
    return false
  }

  async _androidInputText(controller, text) {
    const escaped = String(text || '')
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/\s+/g, '%s')
      .replace(/"/g, '\\"')
      .replace(/[;&|<>`$]/g, '')
    await this._androidAdb(controller, ['shell', 'input', 'text', escaped], 10000)
  }

  async _waitForAndroidPackage(controller, packageName, timeout = 15000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      const output = await this._androidShell(controller, 'dumpsys window windows 2>/dev/null | grep -E "mCurrentFocus|mFocusedApp|topApp" || true', 5000).catch(() => '')
      if (String(output).includes(packageName)) return true
      await new Promise(r => setTimeout(r, 700))
    }
    return false
  }

  async _androidHasPackage(controller, packageName) {
    const safePackage = String(packageName || '').replace(/[^a-zA-Z0-9._]/g, '')
    const output = await this._androidAdb(controller, ['shell', 'pm', 'list', 'packages', safePackage], 8000).catch(() => '')
    return String(output).includes(`package:${safePackage}`)
  }

  _findBundledAndroidApk(fileNames) {
    const roots = [
      process.resourcesPath ? path.join(process.resourcesPath, 'android-apps') : '',
      this._androidAppDropDir(),
      path.join(app.getAppPath(), 'resources', 'android-apps'),
      path.join(process.cwd(), 'resources', 'android-apps')
    ].filter(Boolean)

    for (const root of roots) {
      for (const fileName of fileNames) {
        const candidate = path.join(root, fileName)
        try {
          if (fs.existsSync(candidate)) return candidate
        } catch (_) {}
      }
    }
    return ''
  }

  _findBundledAndroidPackage(fileNames) {
    const apkPath = this._findBundledAndroidApk(fileNames)
    if (apkPath) return { path: apkPath, type: path.extname(apkPath).toLowerCase() }
    return null
  }

  _androidAppDropDir() {
    return path.join(app.getPath('userData'), 'android-apps')
  }

  _ensureAndroidAppDropDir() {
    const dir = this._androidAppDropDir()
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const readmePath = path.join(dir, 'README.txt')
      if (!fs.existsSync(readmePath)) {
        fs.writeFileSync(readmePath, [
          'Profileo Android app installer',
          '',
          'Put the Kick APK here with this exact file name:',
          'kick.apk',
          '',
          'Then run the Kick Android automation again.'
        ].join('\n'))
      }
    } catch (_) {}
    return dir
  }

  async _androidEnsureKickInstalled(controller) {
    if (await this._androidHasPackage(controller, KICK_ANDROID_PACKAGE)) return true

    const installerPackage = this._findBundledAndroidPackage([
      'kick.apk',
      'kick-mobile.apk',
      'com.kick.mobile.apk',
      'kick.apkm',
      'kick-mobile.apkm',
      'com.kick.mobile.apkm'
    ])

    if (installerPackage) {
      if (installerPackage.type === '.apkm') {
        await this._androidInstallApkm(controller, installerPackage.path)
      } else {
        await this._androidAdb(controller, ['install', '-r', '-d', installerPackage.path], 180000)
      }
      if (await this._androidHasPackage(controller, KICK_ANDROID_PACKAGE)) return true
      throw new Error('Kick APK install finished, but com.kick.mobile was not found on Android.')
    }

    if (await this._androidCanOpenPlayStore(controller)) {
      await this._androidOpenKickPlayStore(controller)
      throw new Error('Kick app is not installed. The Google Play Store app was opened; install Kick once, then run this automation again.')
    }

    const dropDir = this._ensureAndroidAppDropDir()
    throw new Error(`Kick app is not installed and this Android profile does not have a real Google Play Store. Put Kick APK/APKM here as kick.apk or kick.apkm, then run again: ${dropDir}`)
  }

  async _androidInstallApkm(controller, apkmPath) {
    const tempDir = path.join(app.getPath('temp'), `profileo-apkm-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      await extract(apkmPath, { dir: tempDir })
      const apkFiles = fs.readdirSync(tempDir)
        .filter(fileName => fileName.toLowerCase().endsWith('.apk'))
        .map(fileName => path.join(tempDir, fileName))
      const selectedApks = await this._selectApkmSplits(controller, apkFiles)
      await this._androidAdb(controller, ['install-multiple', '-r', '-d', ...selectedApks], 180000)
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch (_) {}
    }
  }

  async _selectApkmSplits(controller, apkFiles) {
    const byName = new Map(apkFiles.map(file => [path.basename(file).toLowerCase(), file]))
    const baseApk = byName.get('base.apk') || apkFiles.find(file => path.basename(file).toLowerCase() === 'base-master.apk')
    if (!baseApk) throw new Error('Kick APKM does not contain base.apk.')

    const selected = [baseApk]
    const addIfExists = (name) => {
      const file = byName.get(name.toLowerCase())
      if (file && !selected.includes(file)) selected.push(file)
    }

    const abi = String(await this._androidShell(controller, 'getprop ro.product.cpu.abi', 5000).catch(() => ''))
      .trim()
      .replace(/-/g, '_')
    const abiNames = ['x86_64', 'x86', 'arm64_v8a', 'armeabi_v7a']
    if (abiNames.some(name => byName.has(`split_config.${name}.apk`))) {
      addIfExists(`split_config.${abi}.apk`)
    }

    const densityOutput = await this._androidShell(controller, 'wm density', 5000).catch(() => '')
    const density = parseInt(String(densityOutput).match(/\d+/)?.[0] || '0', 10)
    const densityBuckets = [
      { name: 'ldpi', value: 120 },
      { name: 'mdpi', value: 160 },
      { name: 'hdpi', value: 240 },
      { name: 'xhdpi', value: 320 },
      { name: 'xxhdpi', value: 480 },
      { name: 'xxxhdpi', value: 640 }
    ]
    if (densityBuckets.some(bucket => byName.has(`split_config.${bucket.name}.apk`))) {
      const best = densityBuckets
        .slice()
        .sort((a, b) => Math.abs((density || 480) - a.value) - Math.abs((density || 480) - b.value))[0]
      addIfExists(`split_config.${best.name}.apk`)
    }

    const locale = (
      String(await this._androidShell(controller, 'getprop persist.sys.locale', 5000).catch(() => '')).trim() ||
      String(await this._androidShell(controller, 'getprop ro.product.locale', 5000).catch(() => '')).trim() ||
      'en'
    )
    const lang = locale.split(/[-_]/)[0].toLowerCase()
    addIfExists(`split_config.${lang}.apk`)
    addIfExists('split_config.en.apk')
    addIfExists('split_config.nodpi.apk')

    return selected
  }

  async _androidCanOpenPlayStore(controller) {
    const output = await this._androidAdb(controller, [
      'shell',
      'cmd',
      'package',
      'resolve-activity',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      KICK_PLAY_STORE_MARKET_URL
    ], 10000).catch(() => '')
    const text = String(output || '')
    return !/No activit(?:y|ies) found/i.test(text) && /com\.android\.vending/i.test(text)
  }

  async _androidOpenKickPlayStore(controller) {
    await this._androidAdb(controller, [
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      KICK_PLAY_STORE_MARKET_URL
    ], 15000).catch(() => {})

    await new Promise(r => setTimeout(r, 1500))

    await this._androidAdb(controller, [
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      KICK_PLAY_STORE_WEB_URL
    ], 15000).catch(() => {})
  }

  async _androidOpenKickApp(controller) {
    await this._androidAdb(controller, ['shell', 'am', 'force-stop', KICK_ANDROID_PACKAGE], 8000).catch(() => {})
    await this._androidAdb(controller, [
      'shell',
      'monkey',
      '-p',
      KICK_ANDROID_PACKAGE,
      '-c',
      'android.intent.category.LAUNCHER',
      '1'
    ], 15000)
    await this._waitForAndroidPackage(controller, KICK_ANDROID_PACKAGE, 15000)
  }

  async _androidTapText(controller, matcher, timeout = 10000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      const xml = await this._androidDumpUi(controller)
      const nodes = this._parseAndroidUiNodes(xml)
      const target = nodes.find(node => {
        const text = `${node.attrs.text || ''} ${node.attrs['content-desc'] || ''}`.trim()
        return matcher(text, node)
      })
      if (target) {
        await this._androidAdb(controller, ['shell', 'input', 'tap', String(target.bounds.centerX), String(target.bounds.centerY)], 8000)
        return true
      }
      await new Promise(r => setTimeout(r, 700))
    }
    return false
  }

  async _androidKickOpenSearch(controller, keyword) {
    const screen = await this._androidScreenSize(controller)
    await this._androidTapText(controller, text => {
      const normalized = text.toLowerCase()
      return normalized === 'search' || normalized.includes('search')
    }, 7000).catch(() => false)

    await new Promise(r => setTimeout(r, 1200))
    let xml = await this._androidDumpUi(controller)
    if (!String(xml).toLowerCase().includes('close') && !String(xml).toLowerCase().includes('channels')) {
      await this._androidAdb(controller, [
        'shell',
        'input',
        'tap',
        String(Math.round(screen.width * 0.88)),
        String(Math.round(screen.height * 0.93))
      ], 8000).catch(() => {})
      await new Promise(r => setTimeout(r, 1200))
    }

    await this._androidAdb(controller, [
      'shell',
      'input',
      'tap',
      String(Math.round(screen.width * 0.34)),
      String(Math.round(screen.height * 0.075))
    ], 8000).catch(() => {})
    await new Promise(r => setTimeout(r, 600))
    await this._androidAdb(controller, ['shell', 'input', 'keyevent', 'KEYCODE_CTRL_A'], 5000).catch(() => {})
    await this._androidAdb(controller, ['shell', 'input', 'keyevent', 'KEYCODE_DEL'], 5000).catch(() => {})
    await this._androidInputText(controller, keyword)
    await new Promise(r => setTimeout(r, 2500))
  }

  async _androidKickOpenBestResult(controller, keyword) {
    const normalizedKeyword = this._normalizeAndroidSearchText(keyword)
    if (!normalizedKeyword) throw new Error('Kick search keyword is empty.')

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const xml = await this._androidDumpUi(controller)
      const screen = await this._androidScreenSize(controller)
      const nodes = this._parseAndroidUiNodes(xml)
        .map(node => {
          const text = `${node.attrs.text || ''} ${node.attrs['content-desc'] || ''}`.trim()
          const normalized = this._normalizeAndroidSearchText(text)
          const score = this._androidSearchMatchScore(text, keyword)
          return { ...node, text, normalized, score }
        })
        .filter(node => {
          if (!node.text || node.bounds.top < screen.height * 0.1) return false
          if (node.bounds.bottom > screen.height * 0.88) return false
          if (['search', 'close', 'home', 'browse', 'following'].includes(node.normalized)) return false
          return node.normalized.includes(normalizedKeyword) || node.score >= 70
        })
        .sort((a, b) => b.score - a.score || a.bounds.top - b.bounds.top)

      const exact = nodes.find(node => node.normalized === normalizedKeyword) || nodes[0]
      if (exact) {
        await this._androidAdb(controller, ['shell', 'input', 'tap', String(exact.bounds.centerX), String(exact.bounds.centerY)], 8000)
        await new Promise(r => setTimeout(r, 3500))
        await this._androidKickDismissPopups(controller)
        await this._androidKickOpenVisibleStream(controller)
        return
      }

      await new Promise(r => setTimeout(r, 800))
    }

    throw new Error(`No Kick result matched "${keyword}".`)
  }

  async _androidKickOpenVisibleStream(controller) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const [xml, screen] = await Promise.all([
        this._androidDumpUi(controller),
        this._androidScreenSize(controller)
      ])
      const pageText = String(xml).toLowerCase()
      if (!pageText.includes('stream') && !pageText.includes('live')) {
        await new Promise(r => setTimeout(r, 900))
        continue
      }

      const liveNode = this._parseAndroidUiNodes(xml)
        .map(node => {
          const text = `${node.attrs.text || ''} ${node.attrs['content-desc'] || ''}`.trim()
          return { ...node, text, normalized: this._normalizeAndroidSearchText(text) }
        })
        .filter(node => {
          if (node.bounds.top < screen.height * 0.18 || node.bounds.bottom > screen.height * 0.82) return false
          return node.normalized === 'live' || node.normalized.includes('live')
        })
        .sort((a, b) => a.bounds.top - b.bounds.top)[0]

      if (liveNode) {
        const x = Math.max(Math.round(screen.width * 0.28), liveNode.bounds.centerX)
        const y = Math.min(Math.round(screen.height * 0.45), liveNode.bounds.centerY + 80)
        await this._androidAdb(controller, ['shell', 'input', 'tap', String(x), String(y)], 8000).catch(() => {})
        await new Promise(r => setTimeout(r, 3000))
        return
      }

      const streamVideosNode = this._parseAndroidUiNodes(xml)
        .find(node => this._normalizeAndroidSearchText(`${node.attrs.text || ''} ${node.attrs['content-desc'] || ''}`) === 'stream videos')
      if (streamVideosNode) {
        await this._androidAdb(controller, [
          'shell',
          'input',
          'tap',
          String(Math.round(screen.width * 0.35)),
          String(Math.min(screen.height * 0.75, streamVideosNode.bounds.bottom + 140))
        ], 8000).catch(() => {})
        await new Promise(r => setTimeout(r, 3000))
        return
      }

      await new Promise(r => setTimeout(r, 900))
    }
  }

  async _androidKickDismissPopups(controller) {
    const labels = ['Accept', 'Accept all', 'I agree', 'Got it', 'Not now', 'Maybe later', 'Close']
    for (const label of labels) {
      await this._androidTapText(controller, text => text.toLowerCase().trim() === label.toLowerCase(), 1200).catch(() => {})
    }
  }

  _pickCommentLine(lines, mode, state) {
    if (!lines.length) return ''
    const normalizedMode = String(mode || 'Mix').toLowerCase()

    if (normalizedMode === 'random') {
      return lines[Math.floor(Math.random() * lines.length)]
    }

    if (normalizedMode === 'sequential') {
      const index = Math.max(0, state.commentIndex || 0) % lines.length
      state.commentIndex = index + 1
      return lines[index]
    }

    if (!Array.isArray(state.mixQueue) || !state.mixQueue.length) {
      state.mixQueue = lines.map((_, index) => index)
      for (let index = state.mixQueue.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[state.mixQueue[index], state.mixQueue[swapIndex]] = [state.mixQueue[swapIndex], state.mixQueue[index]]
      }
    }
    const pickedIndex = state.mixQueue.shift()
    return lines[pickedIndex] || ''
  }

  _commentDelayMs(params) {
    const min = Math.max(1, parseInt(params?.commentDelayMin, 10) || 60)
    const max = Math.max(min, parseInt(params?.commentDelayMax, 10) || min)
    return Math.round((min + Math.random() * (max - min)) * 1000)
  }

  async _androidKickTapChatInput(controller) {
    const screen = await this._androidScreenSize(controller)
    const tappedByText = await this._androidTapText(controller, text => {
      const normalized = text.toLowerCase()
      return normalized.includes('send a message') || normalized.includes('message') || normalized.includes('chat')
    }, 2500).catch(() => false)
    if (tappedByText) return true

    await this._androidAdb(controller, [
      'shell',
      'input',
      'tap',
      String(Math.round(screen.width * 0.38)),
      String(Math.round(screen.height * 0.94))
    ], 8000).catch(() => {})
    await new Promise(r => setTimeout(r, 700))
    return true
  }

  async _androidKickSendComment(controller, text) {
    const message = String(text || '').trim()
    if (!message) return false
    await this._androidKickTapChatInput(controller)
    await this._androidAdb(controller, ['shell', 'input', 'keyevent', 'KEYCODE_CTRL_A'], 5000).catch(() => {})
    await this._androidAdb(controller, ['shell', 'input', 'keyevent', 'KEYCODE_DEL'], 5000).catch(() => {})
    await this._androidInputText(controller, message)
    await new Promise(r => setTimeout(r, 600))
    await this._androidAdb(controller, ['shell', 'input', 'keyevent', 'KEYCODE_ENTER'], 5000).catch(() => {})
    return true
  }

  async _androidKickCommentLoop(profileId, controller, params, cancelRef) {
    const scriptId = 'kick-watch-comment'
    const state = this._readAutomationProfileState(profileId, scriptId)
    const commentFile = String(params?.commentFile || '').trim() || state.commentFile || ''
    const lines = this._readLinesFromFile(commentFile)
    if (!lines.length) {
      this._writeAutomationProfileState(profileId, scriptId, {
        ...state,
        commentFile,
        updatedAt: new Date().toISOString()
      })
      await this._androidKeepOpen(controller, cancelRef)
      return
    }

    const runtimeState = {
      commentIndex: Number(state.commentIndex) || 0,
      mixQueue: Array.isArray(state.mixQueue) ? state.mixQueue : []
    }

    while (!cancelRef.get()) {
      await this._androidAdb(controller, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], 5000).catch(() => {})
      const comment = this._pickCommentLine(lines, params?.commentOrder, runtimeState)
      if (comment) {
        await this._androidKickSendComment(controller, comment).catch(() => {})
        this._writeAutomationProfileState(profileId, scriptId, {
          ...state,
          commentFile,
          commentIndex: runtimeState.commentIndex,
          mixQueue: runtimeState.mixQueue,
          lastComment: comment,
          lastCommentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      }

      const waitUntil = Date.now() + this._commentDelayMs(params)
      while (!cancelRef.get() && Date.now() < waitUntil) {
        await this._androidAdb(controller, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], 5000).catch(() => {})
        await new Promise(r => setTimeout(r, Math.min(10000, waitUntil - Date.now())))
      }
    }
  }

  async _androidKeepOpen(controller, cancelRef) {
    while (!cancelRef.get()) {
      await this._androidAdb(controller, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], 5000).catch(() => {})
      await new Promise(r => setTimeout(r, 10000))
    }
  }

  async _androidDismissYouTubePopups(controller) {
    const words = ['Accept all', 'I agree', 'Got it', 'Skip', 'Not now', 'No thanks']
    for (const word of words) {
      await this._androidShell(controller, `input tap $(uiautomator dump /dev/tty 2>/dev/null | grep -o 'text="${word}"[^>]*bounds="[^"]*"' | sed -n 's/.*bounds="\\[\\([0-9]*\\),\\([0-9]*\\)\\].*/\\1 \\2/p' | head -n 1)`, 3000).catch(() => {})
    }
  }

  async _androidDumpUi(controller) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const output = await this._androidShell(
        controller,
        'uiautomator dump /sdcard/profileo-window.xml >/dev/null 2>&1 && cat /sdcard/profileo-window.xml',
        12000
      ).catch(() => '')
      if (String(output).includes('<hierarchy')) return String(output)
      await new Promise(r => setTimeout(r, 700))
    }
    return ''
  }

  async _androidScreenSize(controller) {
    const output = await this._androidShell(controller, 'wm size 2>/dev/null || true', 5000).catch(() => '')
    const match = String(output).match(/Physical size:\s*(\d+)x(\d+)/i)
    if (!match) return { width: 1080, height: 2400 }
    return {
      width: parseInt(match[1], 10) || 1080,
      height: parseInt(match[2], 10) || 2400
    }
  }

  _decodeAndroidXml(value = '') {
    return String(value)
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  }

  _parseAndroidBounds(bounds = '') {
    const match = String(bounds).match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/)
    if (!match) return null
    const left = parseInt(match[1], 10)
    const top = parseInt(match[2], 10)
    const right = parseInt(match[3], 10)
    const bottom = parseInt(match[4], 10)
    if (![left, top, right, bottom].every(Number.isFinite)) return null
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      centerX: Math.round((left + right) / 2),
      centerY: Math.round((top + bottom) / 2)
    }
  }

  _parseAndroidUiNodes(xml = '') {
    const nodes = []
    for (const match of String(xml).matchAll(/<node\b[^>]*>/g)) {
      const tag = match[0]
      const attrs = {}
      for (const attr of tag.matchAll(/([^\s=]+)="([^"]*)"/g)) {
        attrs[attr[1]] = this._decodeAndroidXml(attr[2])
      }
      const bounds = this._parseAndroidBounds(attrs.bounds)
      if (bounds) nodes.push({ attrs, bounds })
    }
    return nodes
  }

  _normalizeAndroidSearchText(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&#\d+;|&[a-z]+;/gi, ' ')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  }

  _extractAndroidYouTubeTitle(label = '') {
    const cleaned = String(label || '').replace(/\s+/g, ' ').trim()
    if (!cleaned) return ''

    const markers = [
      /\s-\s\d+\s+(?:second|seconds|minute|minutes|hour|hours)\b/i,
      /,\s*[\d.,]+\s*(?:thousand|million|billion)?\s*views?\b/i,
      /\s-\sgo to channel\b/i
    ]
    const markerIndexes = markers
      .map(pattern => {
        const match = cleaned.match(pattern)
        return match ? match.index : -1
      })
      .filter(index => index > 0)

    if (!markerIndexes.length) return cleaned
    return cleaned.slice(0, Math.min(...markerIndexes)).trim()
  }

  _androidRequiredTitleMatchScore(keyword = '') {
    const tokens = this._normalizeAndroidSearchText(keyword)
      .split(' ')
      .filter(token => token.length > 1)

    if (tokens.length >= 6) return 80
    if (tokens.length >= 3) return 70
    return 60
  }

  _androidSearchMatchScore(label = '', keyword = '') {
    const normalizedLabel = this._normalizeAndroidSearchText(label)
    const normalizedKeyword = this._normalizeAndroidSearchText(keyword)
    if (!normalizedLabel || !normalizedKeyword) return 0
    if (normalizedLabel.includes(normalizedKeyword)) return 100 + Math.min(normalizedKeyword.length, 60)

    const keywordTokens = normalizedKeyword.split(' ').filter(token => token.length > 1)
    if (!keywordTokens.length) return 0

    const labelTokens = new Set(normalizedLabel.split(' ').filter(Boolean))
    let matchedTokens = 0
    for (const token of keywordTokens) {
      if (labelTokens.has(token) || normalizedLabel.includes(token)) {
        matchedTokens += 1
      }
    }

    const ratio = matchedTokens / keywordTokens.length
    if (matchedTokens === 0) return 0
    return Math.round(ratio * 70) + (matchedTokens * 3)
  }

  async _androidFindYouTubeResultPoint(controller, keyword = '', index = 0) {
    const [xml, screen] = await Promise.all([
      this._androidDumpUi(controller),
      this._androidScreenSize(controller)
    ])
    if (!xml) return null
    const pageText = String(xml).toLowerCase()
    if (this._isAndroidYouTubeWatchText(pageText)) return null

    const exactBlockedWords = [
      'home',
      'shorts',
      'subscriptions',
      'you',
      'back',
      'close',
      'filter'
    ]

    const blockedPhrases = [
      'voice search',
      'cast',
      'more options',
      'showing results',
      'search instead',
      'search youtube',
      'search or type web address'
    ]

    const resultWords = [
      'views',
      'view',
      'ago',
      'seconds',
      'minutes',
      'hours',
      'subscribers',
      'subscriber'
    ]

    const candidates = this._parseAndroidUiNodes(xml)
      .map(node => {
        const text = `${node.attrs.text || ''} ${node.attrs['content-desc'] || ''}`.trim()
        const lower = text.toLowerCase()
        const clickable = node.attrs.clickable === 'true'
        const area = node.bounds.width * node.bounds.height
        const videoTitle = this._extractAndroidYouTubeTitle(text)
        const titleMatchScore = Math.max(
          this._androidSearchMatchScore(videoTitle, keyword),
          Math.max(0, this._androidSearchMatchScore(text, keyword) - 20)
        )
        const score = [
          clickable ? 4 : 0,
          node.attrs['content-desc'] ? 4 : 0,
          resultWords.some(word => lower.includes(word)) ? 4 : 0,
          node.bounds.width > screen.width * 0.45 ? 2 : 0,
          node.bounds.height > 90 ? 2 : 0,
          area > screen.width * 80 ? 1 : 0,
          titleMatchScore
        ].reduce((sum, value) => sum + value, 0)
        return { ...node, text, lower, clickable, area, score, titleMatchScore, videoTitle }
      })
      .filter(node => {
        const hasVideoMetadata = resultWords.some(word => node.lower.includes(word))
        if (!node.text || node.text.length < 8) return false
        if (!hasVideoMetadata) return false
        if (exactBlockedWords.includes(node.lower.trim())) return false
        if (blockedPhrases.some(word => node.lower.includes(word))) return false
        if (node.bounds.top < Math.max(180, screen.height * 0.08)) return false
        if (node.bounds.bottom > screen.height * 0.94) return false
        if (node.bounds.width < screen.width * 0.2) return false
        if (node.bounds.height < 35) return false
        return node.score >= 4
      })
      .sort((a, b) => {
        if (Math.abs(a.bounds.top - b.bounds.top) > 80) return a.bounds.top - b.bounds.top
        return b.score - a.score || b.area - a.area
      })

    const rows = []
    for (const candidate of candidates) {
      const existingIndex = rows.findIndex(row => Math.abs(row.bounds.centerY - candidate.bounds.centerY) < 90)
      if (existingIndex === -1) {
        rows.push(candidate)
      } else {
        const current = rows[existingIndex]
        if (
          candidate.titleMatchScore > current.titleMatchScore ||
          (candidate.titleMatchScore === current.titleMatchScore && candidate.score > current.score) ||
          (candidate.titleMatchScore === current.titleMatchScore && candidate.score === current.score && candidate.area > current.area)
        ) {
          rows[existingIndex] = candidate
        }
      }
    }

    const hasSearchTitle = Boolean(this._normalizeAndroidSearchText(keyword))
    const requiredScore = this._androidRequiredTitleMatchScore(keyword)
    const matchedRows = hasSearchTitle
      ? rows
        .filter(row => row.titleMatchScore >= requiredScore)
        .sort((a, b) => {
          const shortBias = Number(a.lower.includes('play short')) - Number(b.lower.includes('play short'))
          return b.titleMatchScore - a.titleMatchScore || shortBias || a.bounds.top - b.bounds.top
        })
      : []
    const nonShortMatches = matchedRows.filter(row => !row.lower.includes('play short'))
    const availableRows = hasSearchTitle
      ? (nonShortMatches.length ? nonShortMatches : matchedRows)
      : rows
    const target = availableRows[Math.min(Math.max(index, 0), Math.max(availableRows.length - 1, 0))]
    if (!target) return null

    const titleY = target.bounds.height > screen.height * 0.18
      ? Math.round(target.bounds.bottom - Math.min(170, target.bounds.height * 0.22))
      : target.bounds.centerY
    const titleX = target.bounds.width > screen.width * 0.75
      ? Math.round(target.bounds.left + target.bounds.width * 0.42)
      : target.bounds.centerX

    return {
      x: titleX,
      y: titleY,
      label: (target.videoTitle || target.text).slice(0, 120),
      matchScore: target.titleMatchScore
    }
  }

  async _androidIsYouTubeWatchOpen(controller) {
    const xml = await this._androidDumpUi(controller)
    const text = String(xml).toLowerCase()
    return this._isAndroidYouTubeWatchText(text)
  }

  _isAndroidYouTubeWatchText(text = '') {
    return (
      (
        text.includes('video player') ||
        text.includes('expand mini player') ||
        text.includes('comment...') ||
        text.includes('comments')
      ) &&
      (
        text.includes('subscribe') ||
        text.includes('subscribed') ||
        text.includes('subscribers')
      ) &&
      (
        text.includes('share') ||
        text.includes('like') ||
        text.includes('dislike')
      )
    )
  }

  async _androidIsYouTubeResultsOpen(controller) {
    const xml = await this._androidDumpUi(controller)
    const text = String(xml).toLowerCase()
    if (this._isAndroidYouTubeWatchText(text)) return false
    return (
      text.includes('showing results') ||
      text.includes('search instead') ||
      text.includes('did you mean') ||
      (text.includes('voice search') && text.includes('more options') && text.includes('views'))
    )
  }

  async _androidTapYouTubeResult(controller, keyword = '', index = 0) {
    await new Promise(r => setTimeout(r, 1500))
    if (await this._androidIsYouTubeWatchOpen(controller)) return

    const searchTitle = this._normalizeAndroidSearchText(keyword)
    const maxAttempts = searchTitle ? 5 : 1
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const point = await this._androidFindYouTubeResultPoint(controller, keyword, index)
      if (point) {
        await this._androidAdb(controller, ['shell', 'input', 'tap', String(point.x), String(point.y)], 8000).catch(() => {})
        await new Promise(r => setTimeout(r, 3500))
        return
      }

      if (!searchTitle || !(await this._androidIsYouTubeResultsOpen(controller)) || attempt === maxAttempts - 1) {
        break
      }
      await this._androidScrollResults(controller, 1)
      await new Promise(r => setTimeout(r, 1200))
    }

    if (searchTitle) {
      throw new Error(`No exact YouTube result matched "${keyword}".`)
    }

    if (!(await this._androidIsYouTubeResultsOpen(controller))) return
    const screen = await this._androidScreenSize(controller)
    const fallbackX = Math.round(screen.width * 0.5)
    const fallbackY = Math.round(screen.height * 0.32)
    await this._androidAdb(controller, ['shell', 'input', 'tap', String(fallbackX), String(fallbackY)], 8000).catch(() => {})
    await new Promise(r => setTimeout(r, 3500))
  }

  async _androidScrollResults(controller, count = 1) {
    const swipes = Math.min(Math.max(count, 0), 4)
    const screen = await this._androidScreenSize(controller)
    const x = String(Math.round(screen.width * 0.5))
    const startY = String(Math.round(screen.height * 0.74))
    const endY = String(Math.round(screen.height * 0.34))
    for (let i = 0; i < swipes; i += 1) {
      await this._androidAdb(controller, ['shell', 'input', 'swipe', x, startY, x, endY, '600'], 8000).catch(() => {})
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  async _androidWatch(controller, cancelRef, minSec, maxSec) {
    const duration = (Math.random() * (maxSec - minSec) + minSec) * 1000
    const started = Date.now()
    while (Date.now() - started < duration) {
      if (cancelRef.get()) return
      await this._androidAdb(controller, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'], 5000).catch(() => {})
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  async _markStep(profileId, stepCounter, totalSteps) {
    stepCounter.value++
    const info = this.runningScripts.get(profileId)
    if (info) {
      info.currentStep = Math.min(stepCounter.value, totalSteps)
      this._emitProgress(profileId)
    }
  }

  _resolveCurrentElement(steps, parentSelector, index) {
    return steps.map(step => {
      const resolved = { ...step }
      if (resolved.selector && resolved.selector.includes('__current__')) {
        // Use nth-of-type or a positional selector
        resolved.selector = resolved.selector.replace('__current__', `${parentSelector}:nth-child(${index + 1})`)
      } else if (resolved.selector === '__current__') {
        resolved.selector = `${parentSelector}:nth-child(${index + 1})`
      }
      if (resolved.steps) {
        resolved.steps = this._resolveCurrentElement(resolved.steps, parentSelector, index)
      }
      return resolved
    })
  }

  _resolveParams(steps, params) {
    const paramMap = {}
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        paramMap[`{{${key}}}`] = String(val)
      }
    }

    return steps.map(step => {
      const resolved = { ...step }
      for (const [key, val] of Object.entries(resolved)) {
        if (typeof val === 'string') {
          for (const [tpl, replacement] of Object.entries(paramMap)) {
            resolved[key] = resolved[key].replace(tpl, replacement)
          }
        }
      }
      if (resolved.steps) {
        resolved.steps = this._resolveParams(resolved.steps, params)
      }
      return resolved
    })
  }

  _parseDuration(duration) {
    if (typeof duration === 'number') return duration * 1000
    const str = String(duration)
    if (str.includes('-')) {
      const [min, max] = str.split('-').map(Number)
      return (Math.random() * (max - min) + min) * 1000
    }
    return (parseFloat(str) || 2) * 1000
  }

  _countSteps(steps) {
    let count = 0
    for (const step of steps) {
      count++
      if (step.action === 'youtubeSearchWatchLive') {
        const streams = typeof step.maxStreams === 'string' ? parseInt(step.maxStreams, 10) || 5 : (step.maxStreams || 5)
        count += Math.max(1, Math.min(streams, 20)) * 2
      }
      if (step.steps) {
        const inner = this._countSteps(step.steps)
        const iterations = step.maxIterations ? (typeof step.maxIterations === 'string' ? 5 : step.maxIterations) : (step.count ? (typeof step.count === 'string' ? 5 : step.count) : 1)
        count += inner * iterations
      }
    }
    return count
  }

  _emitProgress(profileId) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    const info = this.runningScripts.get(profileId)
    if (!info) return
    try {
      this.mainWindow.webContents.send('automation:progress', {
        profileId,
        scriptId: info.scriptId,
        status: info.status,
        currentStep: info.currentStep,
        totalSteps: info.totalSteps,
        error: info.error
      })
    } catch (_) {}
  }
}
