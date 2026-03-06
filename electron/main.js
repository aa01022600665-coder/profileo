import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import http from 'http'
import { fileURLToPath } from 'url'
import { createTransport } from 'nodemailer'
import { ProfileManager } from './profileManager.js'
import { AutomationEngine } from './automationEngine.js'

const __filename2 = fileURLToPath(import.meta.url)
const __dirname2 = path.dirname(__filename2)

// Decode obfuscated strings
const _k = 'Pr0f1le0_S3cr3t'
function _d(encoded) {
  const buf = Buffer.from(encoded, 'base64')
  let r = ''
  for (let i = 0; i < buf.length; i++) r += String.fromCharCode(buf[i] ^ _k.charCodeAt(i % _k.length))
  return r
}

// Backend proxy (all secrets stored on Cloudflare Worker)
const WORKER_URL = _d('OAZEFkJWSh8vIVwFG18RP19RFlhCBFFvYgNRQAVEYEQGUx8bCkI0NkEQXFcRJg==')
const APP_SECRET = _d('IABWOUlbCAkuYWwQQVAGYwZvVAFeUw==')

function workerFetch(path, options = {}) {
  return fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'x-app-secret': APP_SECRET,
      'Content-Type': 'application/json',
      ...options.headers
    }
  }).then(r => r.json())
}

// Prevent app from crashing on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err)
})

let mainWindow
let profileManager
let automationEngine

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    icon: path.join(__dirname2, '../../build/icon.ico'),
    backgroundColor: '#0a0e1a',
    webPreferences: {
      preload: path.join(__dirname2, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname2, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const dataDir = path.join(app.getPath('userData'), 'data')
  const profilesDir = path.join(app.getPath('userData'), 'profiles')
  profileManager = new ProfileManager({ dataDir, profilesDir })
  profileManager.onBrowserStopped = (profileId) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('profile:stopped', profileId)
    }
  }
  automationEngine = new AutomationEngine(profileManager)

  // Profile CRUD
  ipcMain.handle('profiles:getAll', () => profileManager.getAll())
  ipcMain.handle('profiles:create', (_, profile) => profileManager.create(profile))
  ipcMain.handle('profiles:createBatch', (_, arr) => profileManager.createBatch(arr))
  ipcMain.handle('profiles:update', (_, id, data) => profileManager.update(id, data))
  ipcMain.handle('profiles:delete', (_, id) => profileManager.delete(id))
  ipcMain.handle('profiles:deleteMultiple', (_, ids) => profileManager.deleteMultiple(ids))
  ipcMain.handle('profiles:duplicate', (_, id, count, options) => profileManager.duplicate(id, count, options))
  ipcMain.handle('profiles:launch', (_, id) => profileManager.launchBrowser(id))
  ipcMain.handle('profiles:stop', (_, id) => profileManager.stopBrowser(id))

  // Folders
  ipcMain.handle('folders:getAll', () => profileManager.getFolders())
  ipcMain.handle('folders:create', (_, data) => profileManager.createFolder(data))
  ipcMain.handle('folders:update', (_, id, data) => profileManager.updateFolder(id, data))
  ipcMain.handle('folders:delete', (_, id) => profileManager.deleteFolder(id))

  // Proxies
  ipcMain.handle('proxies:getAll', () => profileManager.getProxies())
  ipcMain.handle('proxies:add', (_, data) => profileManager.addProxies(data))
  ipcMain.handle('proxies:delete', (_, id) => profileManager.deleteProxy(id))
  ipcMain.handle('proxies:deleteMultiple', (_, ids) => profileManager.deleteProxies(ids))

  // Automation
  ipcMain.handle('automation:getScripts', () => automationEngine.getScripts())
  ipcMain.handle('automation:runScript', (_, profileId, scriptId, params) => automationEngine.runScript(profileId, scriptId, params))
  ipcMain.handle('automation:stopScript', (_, profileId) => automationEngine.stopScript(profileId))
  ipcMain.handle('automation:getStatuses', () => automationEngine.getAllStatuses())

  // User Scripts (custom scripts CRUD)
  const userScriptsFile = path.join(dataDir, 'userScripts.json')

  function readUserScripts() {
    try {
      if (fs.existsSync(userScriptsFile)) {
        return JSON.parse(fs.readFileSync(userScriptsFile, 'utf8'))
      }
    } catch (e) { console.error('Read user scripts error:', e) }
    return []
  }

  function writeUserScripts(scripts) {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(userScriptsFile, JSON.stringify(scripts, null, 2))
  }

  ipcMain.handle('userScripts:getAll', () => readUserScripts())
  ipcMain.handle('userScripts:get', (_, id) => {
    const scripts = readUserScripts()
    return scripts.find(s => s.id === id) || null
  })
  ipcMain.handle('userScripts:save', (_, script) => {
    const scripts = readUserScripts()
    const index = scripts.findIndex(s => s.id === script.id)
    if (index >= 0) scripts[index] = script
    else scripts.push(script)
    writeUserScripts(scripts)
    return { success: true }
  })
  ipcMain.handle('userScripts:delete', (_, id) => {
    let scripts = readUserScripts()
    scripts = scripts.filter(s => s.id !== id)
    writeUserScripts(scripts)
    return { success: true }
  })

  // ===== Google OAuth via BrowserWindow =====
  ipcMain.handle('auth:google', async (_, clientId) => {
    return new Promise((resolve, reject) => {
      let resolved = false
      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        parent: mainWindow,
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      authWindow.setMenuBarVisibility(false)

      const redirectUri = 'http://localhost'
      const scope = encodeURIComponent('email profile openid')
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}&prompt=select_account`

      function handleUrl(url) {
        if (!url || resolved) return
        try {
          if (url.startsWith('http://localhost')) {
            const hashStr = new URL(url).hash.substring(1)
            const params = new URLSearchParams(hashStr)
            const accessToken = params.get('access_token')
            if (accessToken) {
              resolved = true
              resolve({ accessToken })
              setImmediate(() => { try { authWindow.close() } catch (_) {} })
            }
          }
        } catch (e) { /* ignore parse errors */ }
      }

      // Multiple listeners for maximum compatibility with Electron 40
      authWindow.webContents.on('will-navigate', (event, url) => {
        handleUrl(typeof url === 'string' ? url : event?.url)
      })
      authWindow.webContents.on('did-navigate', (event, url) => {
        handleUrl(url)
      })
      authWindow.webContents.on('will-redirect', (event, url) => {
        handleUrl(typeof url === 'string' ? url : event?.url)
      })
      authWindow.webContents.on('did-redirect-navigation', (event, url) => {
        handleUrl(typeof url === 'string' ? url : event?.url)
      })
      // Fallback: when http://localhost fails to load, check the URL
      authWindow.webContents.on('did-fail-load', () => {
        try { handleUrl(authWindow.webContents.getURL()) } catch (_) {}
      })

      authWindow.loadURL(authUrl)

      authWindow.on('closed', () => {
        if (!resolved) reject(new Error('Auth window closed'))
      })
    })
  })

  // ===== OTP Email Verification (via Worker) =====
  ipcMain.handle('auth:sendCode', async (_, email) => {
    try {
      const result = await workerFetch('/send-code', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      // Fallback: if Worker email sending failed, send locally
      if (result.fallback && result.code) {
        const transporter = createTransport({
          service: 'gmail',
          auth: { user: _d('JBdfBANfXAZqE1QOE1oYfhFfCw=='), pass: _d('KB1cF10LEkc7PUEEF0MAJQ==') }
        })
        await transporter.sendMail({
          from: 'Profileo <noreply@getprofileo.com>',
          to: email,
          subject: 'Your Profileo Verification Code',
          html: `<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px;background:#0f1525;color:#d4d8e8;border-radius:10px;">
            <h2 style="text-align:center;color:#4285f4;margin-bottom:20px;">Profileo</h2>
            <p style="text-align:center;font-size:14px;margin-bottom:20px;">Your verification code is:</p>
            <div style="text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#fff;background:#1a2340;padding:16px;border-radius:8px;margin-bottom:20px;">${result.code}</div>
            <p style="text-align:center;font-size:12px;color:#8892a8;">This code expires in 2 minutes. Do not share it with anyone.</p>
          </div>`
        })
      }
      return { success: result.success !== false }
    } catch (e) {
      console.error('Send code failed:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('auth:verifyCode', async (_, email, code) => {
    try {
      return await workerFetch('/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code })
      })
    } catch (e) {
      return { verified: false, error: e.message }
    }
  })

  // ===== Billing (per-user) =====

  function getBillingFile(userKey) {
    if (!userKey) return null
    const safe = userKey.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    return path.join(dataDir, `billing_${safe}.json`)
  }

  ipcMain.handle('billing:getPlan', (_, userId) => {
    try {
      const file = getBillingFile(userId)
      if (!file) return null
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'))
      }
      // Migration: if old shared billing.json exists, migrate to this user
      const oldFile = path.join(dataDir, 'billing.json')
      if (fs.existsSync(oldFile)) {
        const oldData = JSON.parse(fs.readFileSync(oldFile, 'utf8'))
        fs.writeFileSync(file, JSON.stringify(oldData, null, 2))
        fs.unlinkSync(oldFile) // Remove old shared file
        return oldData
      }
      return null
    } catch { return null }
  })

  ipcMain.handle('billing:savePlan', (_, { userId, plan }) => {
    try {
      const file = getBillingFile(userId)
      if (!file) return { success: false, error: 'No user ID' }
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(plan, null, 2))
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // Local callback server for NOWPayments success redirect
  let callbackServer = null
  let callbackPort = 17432
  let pendingPaymentId = null

  function startCallbackServer() {
    return new Promise((resolve) => {
      if (callbackServer) { resolve(callbackPort); return }
      callbackServer = http.createServer((req, res) => {
        const url = new URL(req.url, `http://localhost:${callbackPort}`)
        if (url.pathname === '/success') {
          const npId = url.searchParams.get('NP_id')
          if (npId) {
            pendingPaymentId = npId
            console.log('NOWPayments callback received, payment_id:', npId)
          }
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body style="background:#1a1a2e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Payment Received!</h1><p>You can close this tab and return to Profileo.</p></div></body></html>')
        } else {
          res.writeHead(200); res.end('ok')
        }
      })
      callbackServer.listen(callbackPort, () => {
        console.log('Callback server started on port', callbackPort)
        resolve(callbackPort)
      })
      callbackServer.on('error', () => {
        callbackPort++
        callbackServer = null
        startCallbackServer().then(resolve)
      })
    })
  }

  ipcMain.handle('billing:createPayment', async (_, data) => {
    try {
      const port = await startCallbackServer()
      pendingPaymentId = null
      const result = await workerFetch('/create-invoice', {
        method: 'POST',
        body: JSON.stringify({
          price_amount: data.amount,
          price_currency: data.currency || 'usd',
          order_id: data.orderId,
          order_description: data.description,
          success_url: `http://localhost:${port}/success`,
          cancel_url: `http://localhost:${port}/success`
        })
      })
      console.log('Create invoice result:', JSON.stringify(result))
      return result
    } catch (e) {
      console.error('Create invoice failed:', e)
      return { error: e.message }
    }
  })

  ipcMain.handle('billing:getPaymentStatus', async (_, invoiceId) => {
    try {
      // 1. If we got a payment_id from the callback redirect, check it directly
      if (pendingPaymentId) {
        const pData = await workerFetch(`/payment/${pendingPaymentId}`)
        console.log('Payment status (by callback ID):', JSON.stringify(pData))
        if (pData.payment_id) {
          return { data: [pData], fromCallback: true }
        }
      }

      // 2. Fallback: try query by invoiceId
      try {
        const result = await workerFetch(`/payments-by-invoice?invoiceId=${invoiceId}`)
        if (result.data && result.data.length > 0) return result
      } catch (_) {}

      return { data: [] }
    } catch (e) {
      return { error: e.message }
    }
  })

  // Restore purchase - list recent payments
  ipcMain.handle('billing:listPayments', async () => {
    try {
      return await workerFetch('/list-payments')
    } catch (e) {
      return { error: e.message }
    }
  })

  // Open external URL in system browser
  ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url))

  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.handle('window:close', () => mainWindow.close())

  createWindow()
  automationEngine.setMainWindow(mainWindow)
})

app.on('window-all-closed', async () => {
  if (profileManager) {
    await profileManager.stopAllBrowsers()
  }
  app.quit()
})
