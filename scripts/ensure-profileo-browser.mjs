import fs from 'fs'
import path from 'path'
import {
  Browser,
  BrowserTag,
  detectBrowserPlatform,
  install,
  resolveBuildId
} from '@puppeteer/browsers'

const cacheDir = path.resolve('.profileo-browsers-test')
const chromiumCacheDir = path.join(cacheDir, 'chromium')

function findChromeExecutable(rootDir, maxDepth = 5) {
  if (!fs.existsSync(rootDir) || maxDepth < 0) return null

  const entries = fs.readdirSync(rootDir, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name)
    if (entry.isFile() && entry.name.toLowerCase() === (process.platform === 'win32' ? 'chrome.exe' : 'chrome')) {
      return entryPath
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = findChromeExecutable(path.join(rootDir, entry.name), maxDepth - 1)
    if (found) return found
  }

  return null
}

const existingBrowser = findChromeExecutable(chromiumCacheDir)
if (existingBrowser) {
  console.log(`Profileo browser already available: ${existingBrowser}`)
  process.exit(0)
}

const platform = detectBrowserPlatform()
if (!platform) {
  throw new Error('Unsupported platform for Profileo browser')
}

const buildId = await resolveBuildId(Browser.CHROMIUM, platform, BrowserTag.LATEST)
const installedBrowser = await install({
  browser: Browser.CHROMIUM,
  buildId,
  buildIdAlias: 'profileo-stable',
  cacheDir,
  platform
})

console.log(`Profileo browser installed: ${installedBrowser.executablePath}`)
