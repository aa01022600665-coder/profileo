// Automation script execution engine for Profileo
// Runs declarative automation scripts via puppeteer on profile browsers

import { AUTOMATION_SCRIPTS } from './automationScripts.js'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

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
    const totalSteps = this._countSteps(scriptDef.steps)
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

      // Ensure browser is running
      let browser = this.profileManager.getBrowser(profileId)
      if (!browser) {
        // Launching browser for automation
        await this.profileManager.launchBrowser(profileId)
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
