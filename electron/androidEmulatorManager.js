import fs from 'fs'
import path from 'path'
import net from 'net'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { HttpProxyRelay } from './httpProxyRelay.js'
import extract from 'extract-zip'

const execFileAsync = promisify(execFile)
const IS_WINDOWS = process.platform === 'win32'
const EXEC_TIMEOUT = 15000
const BOOT_TIMEOUT = 240000
const KICK_ANDROID_PACKAGE = 'com.kick.mobile'
const CHROME_ANDROID_PACKAGES = [
  'com.android.chrome',
  'com.chrome.beta',
  'com.chrome.dev',
  'com.chrome.canary',
  'org.chromium.chrome'
]

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function exists(filePath) {
  try { return Boolean(filePath) && fs.existsSync(filePath) } catch (_) { return false }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function chunks(values, size) {
  const result = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function normalizeOutputList(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

function firstStartUrl(profile) {
  const url = String(profile.startUrl || '')
    .split(/\r?\n/)
    .map(value => value.trim())
    .find(Boolean)
  return url || 'https://ipfighter.com'
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

export class AndroidEmulatorManager {
  constructor({ dataDir }) {
    this.dataDir = dataDir
    this.stateFile = path.join(dataDir, 'android-emulators.json')
    this.runningAvds = new Set()
    this.reservedPorts = new Set()
  }

  _readState() {
    try {
      return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'))
    } catch (_) {
      return { profiles: {} }
    }
  }

  _writeState(state) {
    try {
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true })
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2))
    } catch (_) {}
  }

  _sdkRoots() {
    const roots = [
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '',
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Android', 'Sdk') : '',
      process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Android', 'Sdk') : ''
    ]
    return unique(roots)
  }

  async _findOnPath(command) {
    const lookup = IS_WINDOWS ? 'where.exe' : 'which'
    try {
      const { stdout } = await execFileAsync(lookup, [command], {
        timeout: EXEC_TIMEOUT,
        windowsHide: true
      })
      return normalizeOutputList(stdout).find(exists) || ''
    } catch (_) {
      return ''
    }
  }

  async _resolveTool(tool) {
    const exe = IS_WINDOWS ? `${tool}.exe` : tool
    const roots = this._sdkRoots()
    const candidates = []
    for (const root of roots) {
      if (tool === 'emulator') candidates.push(path.join(root, 'emulator', exe))
      if (tool === 'adb') candidates.push(path.join(root, 'platform-tools', exe))
    }
    candidates.push(await this._findOnPath(exe))
    const found = candidates.find(exists)
    if (!found) {
      const label = tool === 'adb' ? 'ADB' : 'Android Emulator'
      throw new Error(`${label} not found. Install Android Studio/SDK or add ${exe} to PATH.`)
    }
    return found
  }

  async _run(file, args, options = {}) {
    const { stdout, stderr } = await execFileAsync(file, args, {
      timeout: options.timeout || EXEC_TIMEOUT,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || this._sdkRoots()[0] || '',
        ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || this._sdkRoots()[0] || ''
      }
    })
    return `${stdout || ''}${stderr || ''}`
  }

  async _adb(serial, args, options = {}) {
    const adbPath = options.adbPath || await this._resolveTool('adb')
    return this._run(adbPath, ['-s', serial, ...args], options)
  }

  async _adbShell(controller, script, options = {}) {
    return this._adb(controller.serial, ['shell', `sh -c ${shellQuote(script)}`], {
      adbPath: controller.adbPath,
      timeout: options.timeout || EXEC_TIMEOUT
    })
  }

  async listAvds() {
    const emulatorPath = await this._resolveTool('emulator')
    const output = await this._run(emulatorPath, ['-list-avds'])
    return normalizeOutputList(output)
  }

  _profileAvdName(profileId) {
    const safeId = String(profileId || '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+/, '')
      .slice(0, 48)
    return `profileo_${safeId || 'android'}`
  }

  _profileAvdDisplayName(profile = {}) {
    const safeName = String(profile.name || profile.id || 'Android')
      .replace(/[^\w .-]/g, '')
      .trim()
      .slice(0, 40)
    return `Profileo ${safeName || 'Android'}`
  }

  _resolveSkin(preferredName = '') {
    const skinNames = unique([
      preferredName,
      'pixel_8_pro',
      'pixel_10_pro',
      'pixel_6',
      'pixel_7',
      'pixel_5'
    ])

    for (const root of this._sdkRoots()) {
      for (const skinName of skinNames) {
        const skinPath = path.join(root, 'skins', skinName)
        if (exists(skinPath)) return { name: skinName, path: skinPath }
      }
    }

    return null
  }

  _skinHardware(skinName = '') {
    const presets = {
      pixel_10_pro: { deviceName: 'pixel_10_pro', width: '1280', height: '2856', density: '480' },
      pixel_8_pro: { deviceName: 'pixel_8_pro', width: '1344', height: '2992', density: '480' },
      pixel_7: { deviceName: 'pixel_7', width: '1080', height: '2400', density: '420' },
      pixel_6: { deviceName: 'pixel_6', width: '1080', height: '2400', density: '420' },
      pixel_5: { deviceName: 'pixel_5', width: '1080', height: '2340', density: '440' }
    }
    return presets[skinName] || presets.pixel_8_pro
  }

  _withConfigValue(config, key, value) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`^${escapedKey}=.*$`, 'm')
    const line = `${key}=${String(value).replace(/[\r\n]/g, ' ')}`
    if (pattern.test(config)) return config.replace(pattern, line)
    return `${config.replace(/\s*$/, '')}\n${line}\n`
  }

  _repairProfileAvdConfig(profile, avdName) {
    try {
      const configPath = this._avdConfigPath(avdName)
      if (!exists(configPath)) return false

      const original = fs.readFileSync(configPath, 'utf8')
      let config = original
      const currentSkinName = (config.match(/^skin\.name=(.*)$/m)?.[1] || '').trim()
      const skin = this._resolveSkin(currentSkinName)
      const hardware = this._skinHardware(skin?.name)

      config = this._withConfigValue(config, 'avd.ini.displayname', this._profileAvdDisplayName(profile))
      config = this._withConfigValue(config, 'hw.device.manufacturer', 'Google')
      config = this._withConfigValue(config, 'hw.device.name', hardware.deviceName)
      config = this._withConfigValue(config, 'hw.lcd.width', hardware.width)
      config = this._withConfigValue(config, 'hw.lcd.height', hardware.height)
      config = this._withConfigValue(config, 'hw.lcd.density', hardware.density)
      config = this._withConfigValue(config, 'hw.keyboard', 'yes')
      config = this._withConfigValue(config, 'hw.ramSize', '2048')
      config = this._withConfigValue(config, 'disk.dataPartition.size', '6G')

      if (skin) {
        config = this._withConfigValue(config, 'showDeviceFrame', 'yes')
        config = this._withConfigValue(config, 'skin.dynamic', 'yes')
        config = this._withConfigValue(config, 'skin.name', skin.name)
        config = this._withConfigValue(config, 'skin.path', skin.path)
      } else {
        config = this._withConfigValue(config, 'showDeviceFrame', 'no')
        config = this._withConfigValue(config, 'skin.dynamic', 'no')
      }

      if (config !== original) fs.writeFileSync(configPath, config)
      return true
    } catch (_) {
      return false
    }
  }

  _avdRoot() {
    return process.env.ANDROID_AVD_HOME || path.join(process.env.USERPROFILE || '', '.android', 'avd')
  }

  _avdConfigPath(avdName) {
    return path.join(this._avdRoot(), `${avdName}.avd`, 'config.ini')
  }

  _avdIniPath(avdName) {
    return path.join(this._avdRoot(), `${avdName}.ini`)
  }

  _isRootableAvd(avdName) {
    try {
      const config = fs.readFileSync(this._avdConfigPath(avdName), 'utf8')
      const isPlayStore = /PlayStore\.enabled\s*=\s*true/i.test(config) || /tag\.id\s*=\s*google_apis_playstore/i.test(config)
      return !isPlayStore
    } catch (_) {
      return false
    }
  }

  _findSecureSystemImage() {
    const candidates = []
    for (const root of this._sdkRoots()) {
      const systemImagesRoot = path.join(root, 'system-images')
      try {
        const apiDirs = fs.readdirSync(systemImagesRoot, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && /^android-/.test(entry.name))
          .map(entry => entry.name)
          .sort((a, b) => Number(b.replace(/[^\d.]/g, '').split('.')[0] || 0) - Number(a.replace(/[^\d.]/g, '').split('.')[0] || 0))

        for (const apiDir of apiDirs) {
          for (const tag of ['google_apis', 'default']) {
            const tagDir = path.join(systemImagesRoot, apiDir, tag)
            if (!exists(tagDir)) continue
            for (const abi of ['x86_64', 'x86']) {
              if (exists(path.join(tagDir, abi, 'system.img'))) {
                candidates.push({
                  packageId: `system-images;${apiDir};${tag};${abi}`,
                  apiDir,
                  tag,
                  abi,
                  sdkRoot: root
                })
              }
            }
          }
        }
      } catch (_) {}
    }
    return candidates[0] || null
  }

  async _findAvdManager() {
    const bat = IS_WINDOWS ? 'avdmanager.bat' : 'avdmanager'
    const candidates = []
    for (const root of this._sdkRoots()) {
      candidates.push(path.join(root, 'cmdline-tools', 'latest', 'bin', bat))
      candidates.push(path.join(root, 'tools', 'bin', bat))
    }
    candidates.push(await this._findOnPath(bat))
    return candidates.find(exists) || ''
  }

  async _runWithInput(file, args, input, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(file, args, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: options.env || process.env
      })
      let output = ''
      const timeout = setTimeout(() => {
        try { child.kill() } catch (_) {}
        reject(new Error('Command timed out'))
      }, options.timeout || EXEC_TIMEOUT)

      child.stdout.on('data', chunk => { output += chunk.toString() })
      child.stderr.on('data', chunk => { output += chunk.toString() })
      child.once('error', error => {
        clearTimeout(timeout)
        reject(error)
      })
      child.once('exit', code => {
        clearTimeout(timeout)
        if (code === 0) resolve(output)
        else reject(new Error(output || `Command exited with code ${code}`))
      })

      if (input) child.stdin.write(input)
      child.stdin.end()
    })
  }

  async _ensureProfileAvd(profile, avds) {
    const avdName = this._profileAvdName(profile.id)
    if (avds.includes(avdName)) return avdName

    const image = this._findSecureSystemImage()
    if (!image) return ''

    const avdManager = await this._findAvdManager()
    if (!avdManager) return this._createManualSecureAvd(avdName, image, profile)

    try {
      const env = {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || image.sdkRoot,
        ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || image.sdkRoot
      }
      if (process.env.JAVA_HOME) env.JAVA_HOME = process.env.JAVA_HOME

      await this._runWithInput(avdManager, [
        'create',
        'avd',
        '-n',
        avdName,
        '-k',
        image.packageId,
        '-d',
        'pixel_6',
        '--force'
      ], 'no\n', {
        timeout: 60000,
        env
      })

      const configPath = this._avdConfigPath(avdName)
      if (exists(configPath)) {
        let config = fs.readFileSync(configPath, 'utf8')
        const updates = {
          'avd.ini.displayname': this._profileAvdDisplayName(profile),
          'PlayStore.enabled': 'false',
          'showDeviceFrame': 'yes',
          'hw.keyboard': 'yes',
          'hw.ramSize': '2048',
          'disk.dataPartition.size': '6G'
        }
        for (const [key, value] of Object.entries(updates)) {
          const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const pattern = new RegExp(`^${escapedKey}=.*$`, 'm')
          if (pattern.test(config)) config = config.replace(pattern, `${key}=${value}`)
          else config += `\n${key}=${value}`
        }
        fs.writeFileSync(configPath, config)
      }
      return avdName
    } catch (_) {
      return this._createManualSecureAvd(avdName, image, profile)
    }
  }

  _createManualSecureAvd(avdName, image, profile = {}) {
    try {
      const avdRoot = this._avdRoot()
      const avdDir = path.join(avdRoot, `${avdName}.avd`)
      if (!fs.existsSync(avdRoot)) fs.mkdirSync(avdRoot, { recursive: true })
      if (!fs.existsSync(avdDir)) fs.mkdirSync(avdDir, { recursive: true })

      const imageSysdir = `system-images\\${image.apiDir}\\${image.tag}\\${image.abi}\\`
      const androidTarget = image.apiDir
      const cpuArch = image.abi === 'x86' ? 'x86' : 'x86_64'
      const skin = this._resolveSkin('pixel_8_pro')
      const hardware = this._skinHardware(skin?.name)
      const config = [
        `AvdId=${avdName}`,
        'PlayStore.enabled=false',
        `abi.type=${image.abi}`,
        `avd.ini.displayname=${this._profileAvdDisplayName(profile)}`,
        'avd.ini.encoding=UTF-8',
        'disk.dataPartition.size=6G',
        'fastboot.forceColdBoot=yes',
        'fastboot.forceFastBoot=no',
        'hw.accelerometer=yes',
        'hw.audioInput=yes',
        'hw.battery=yes',
        'hw.camera.back=virtualscene',
        'hw.camera.front=emulated',
        `hw.cpu.arch=${cpuArch}`,
        'hw.cpu.ncore=4',
        'hw.dPad=no',
        'hw.device.manufacturer=Google',
        `hw.device.name=${hardware.deviceName}`,
        'hw.gps=yes',
        'hw.gpu.enabled=yes',
        'hw.gpu.mode=auto',
        'hw.gyroscope=yes',
        'hw.initialOrientation=portrait',
        'hw.keyboard=yes',
        `hw.lcd.density=${hardware.density}`,
        `hw.lcd.height=${hardware.height}`,
        `hw.lcd.width=${hardware.width}`,
        'hw.mainKeys=no',
        'hw.ramSize=2048',
        'hw.sdCard=yes',
        'hw.sensors.light=yes',
        'hw.sensors.magnetic_field=yes',
        'hw.sensors.orientation=yes',
        'hw.sensors.pressure=yes',
        'hw.sensors.proximity=yes',
        'hw.trackBall=no',
        `image.sysdir.1=${imageSysdir}`,
        'runtime.network.latency=none',
        'runtime.network.speed=full',
        'sdcard.size=512M',
        `showDeviceFrame=${skin ? 'yes' : 'no'}`,
        `skin.dynamic=${skin ? 'yes' : 'no'}`,
        ...(skin ? [`skin.name=${skin.name}`, `skin.path=${skin.path}`] : []),
        `tag.display=${image.tag === 'google_apis' ? 'Google APIs' : image.tag}`,
        `tag.id=${image.tag}`,
        `target=${androidTarget}`,
        'vm.heapSize=256'
      ].join('\n') + '\n'

      const ini = [
        'avd.ini.encoding=UTF-8',
        `path=${avdDir}`,
        `path.rel=avd\\${avdName}.avd`,
        `target=${androidTarget}`
      ].join('\n') + '\n'

      fs.writeFileSync(this._avdConfigPath(avdName), config)
      fs.writeFileSync(this._avdIniPath(avdName), ini)
      return avdName
    } catch (_) {
      return ''
    }
  }

  _hashIndex(value, length) {
    if (length <= 1) return 0
    let hash = 0
    for (const char of String(value || '')) {
      hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0
    }
    return hash % length
  }

  async _selectAvd(profile) {
    const avds = await this.listAvds()
    const avdName = this._profileAvdName(profile.id)
    if (this.runningAvds.has(avdName)) {
      throw new Error('This Android profile is already running.')
    }

    const selectedAvd = avds.includes(avdName)
      ? avdName
      : await this._ensureProfileAvd(profile, avds)

    if (!selectedAvd) {
      throw new Error('Could not create an isolated Android device for this profile. Install a Google APIs Android Emulator system image from Android Studio > SDK Manager, then run this profile again.')
    }

    if (this.runningAvds.has(selectedAvd)) {
      throw new Error('This Android profile is already running.')
    }

    this._repairProfileAvdConfig(profile, selectedAvd)

    if (profile.webrtc !== 'Real' && !this._isRootableAvd(selectedAvd)) {
      throw new Error('Strict Android WebRTC Lock needs this profile Android device to use a rootable Google APIs image. Delete this profile AVD from Android Studio Device Manager and run the profile again so Profileo can recreate it securely.')
    }

    return {
      avdName: selectedAvd,
      scoped: true,
      available: avds,
      secure: this._isRootableAvd(selectedAvd)
    }
  }

  async _isPortFree(port) {
    return new Promise(resolve => {
      const server = net.createServer()
      server.once('error', () => resolve(false))
      server.once('listening', () => {
        server.close(() => resolve(true))
      })
      server.listen(port, '127.0.0.1')
    })
  }

  async _allocatePort(profileId) {
    const state = this._readState()
    const existing = Number(state.profiles?.[profileId]?.port)
    if (existing >= 5554 && existing <= 5682 && existing % 2 === 0 && !this.reservedPorts.has(existing)) {
      const freeConsole = await this._isPortFree(existing)
      const freeAdb = await this._isPortFree(existing + 1)
      if (freeConsole && freeAdb) {
        this.reservedPorts.add(existing)
        return existing
      }
    }

    for (let port = 5554; port <= 5682; port += 2) {
      if (this.reservedPorts.has(port)) continue
      const freeConsole = await this._isPortFree(port)
      const freeAdb = await this._isPortFree(port + 1)
      if (freeConsole && freeAdb) {
        this.reservedPorts.add(port)
        return port
      }
    }
    throw new Error('No free Android emulator port found between 5554 and 5682.')
  }

  _parseProxy(profile) {
    if (!profile.proxy || profile.proxyType === 'Without Proxy') return null
    if (profile.proxyType !== 'HTTP') {
      throw new Error('Real Android engine currently supports HTTP proxy only. Switch this Android profile proxy type to HTTP or use Without Proxy.')
    }
    const parts = String(profile.proxy).split(':')
    if (parts.length < 2 || !parts[0] || !parts[1]) return null
    return {
      host: parts[0],
      port: parts[1],
      username: parts.length >= 4 ? parts[2] : '',
      password: parts.length >= 4 ? parts[3] : ''
    }
  }

  async _waitForBoot(controller) {
    const started = Date.now()

    while (Date.now() - started < BOOT_TIMEOUT) {
      if (controller.process.exitCode !== null || controller.process.killed) {
        throw new Error('Android emulator stopped before it connected to ADB.')
      }
      try {
        const state = await this._adb(controller.serial, ['get-state'], {
          adbPath: controller.adbPath,
          timeout: 5000
        })
        if (state.trim() === 'device') break
      } catch (_) {}
      await delay(2000)
    }

    while (Date.now() - started < BOOT_TIMEOUT) {
      if (controller.process.exitCode !== null || controller.process.killed) {
        throw new Error('Android emulator stopped before boot completed.')
      }
      try {
        const booted = await this._adb(controller.serial, ['shell', 'getprop', 'sys.boot_completed'], {
          adbPath: controller.adbPath,
          timeout: 5000
        })
        if (booted.trim() === '1') return
      } catch (_) {}
      await delay(2500)
    }

    throw new Error('Android emulator boot timed out.')
  }

  async _applyProxy(profile, controller) {
    const proxy = this._parseProxy(profile)
    if (!proxy) {
      try {
        await this._adb(controller.serial, ['shell', 'settings', 'delete', 'global', 'http_proxy'], {
          adbPath: controller.adbPath,
          timeout: 8000
        })
      } catch (_) {}
      try {
        await this._adb(controller.serial, ['shell', 'settings', 'put', 'global', 'http_proxy', ':0'], {
          adbPath: controller.adbPath,
          timeout: 8000
        })
      } catch (_) {}
      return { proxy: false, proxyAuthWarning: false }
    }

    controller.proxyRelay = new HttpProxyRelay({
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password
    })
    const relayPort = await controller.proxyRelay.start()
    await this._adb(controller.serial, ['shell', 'settings', 'put', 'global', 'http_proxy', `10.0.2.2:${relayPort}`], {
      adbPath: controller.adbPath,
      timeout: 8000
    })
    return { proxy: true, proxyAuthWarning: false, relayHost: '10.0.2.2', relayPort }
  }

  async _getInstalledChromePackages(controller) {
    const output = await this._adb(controller.serial, ['shell', 'pm', 'list', 'packages'], {
      adbPath: controller.adbPath,
      timeout: 10000
    })
    const installed = CHROME_ANDROID_PACKAGES.filter(packageName => output.includes(`package:${packageName}`))
    return installed.length ? installed : ['com.android.chrome']
  }

  _androidAppDropDir() {
    return path.join(path.dirname(this.dataDir), 'android-apps')
  }

  _findAndroidPackageFile(fileNames) {
    const roots = [
      process.resourcesPath ? path.join(process.resourcesPath, 'android-apps') : '',
      this._androidAppDropDir(),
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

  async _hasAndroidPackage(controller, packageName) {
    const safePackage = String(packageName || '').replace(/[^a-zA-Z0-9._]/g, '')
    const output = await this._adb(controller.serial, ['shell', 'pm', 'list', 'packages', safePackage], {
      adbPath: controller.adbPath,
      timeout: 8000
    }).catch(() => '')
    return String(output).includes(`package:${safePackage}`)
  }

  async _installAndroidPackageFile(controller, packagePath) {
    if (path.extname(packagePath).toLowerCase() === '.apkm') {
      await this._installApkm(controller, packagePath)
      return
    }

    await this._adb(controller.serial, ['install', '-r', '-d', packagePath], {
      adbPath: controller.adbPath,
      timeout: 180000
    })
  }

  async _installApkm(controller, apkmPath) {
    const tempDir = path.join(this.dataDir, `tmp-apkm-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    const resolvedDataDir = path.resolve(this.dataDir)
    const resolvedTempDir = path.resolve(tempDir)
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      await extract(apkmPath, { dir: tempDir })
      const apkFiles = fs.readdirSync(tempDir)
        .filter(fileName => fileName.toLowerCase().endsWith('.apk'))
        .map(fileName => path.join(tempDir, fileName))
      const selectedApks = await this._selectApkmSplits(controller, apkFiles)
      await this._adb(controller.serial, ['install-multiple', '-r', '-d', ...selectedApks], {
        adbPath: controller.adbPath,
        timeout: 180000
      })
    } finally {
      try {
        if (resolvedTempDir.startsWith(`${resolvedDataDir}${path.sep}`)) {
          fs.rmSync(resolvedTempDir, { recursive: true, force: true })
        }
      } catch (_) {}
    }
  }

  async _selectApkmSplits(controller, apkFiles) {
    const byName = new Map(apkFiles.map(file => [path.basename(file).toLowerCase(), file]))
    const baseApk = byName.get('base.apk') || apkFiles.find(file => path.basename(file).toLowerCase() === 'base-master.apk')
    if (!baseApk) throw new Error('Android APKM does not contain base.apk.')

    const selected = [baseApk]
    const addIfExists = (name) => {
      const file = byName.get(name.toLowerCase())
      if (file && !selected.includes(file)) selected.push(file)
    }

    const abi = String(await this._adbShell(controller, 'getprop ro.product.cpu.abi', { timeout: 5000 }).catch(() => ''))
      .trim()
      .replace(/-/g, '_')
    const abiNames = ['x86_64', 'x86', 'arm64_v8a', 'armeabi_v7a']
    if (abiNames.some(name => byName.has(`split_config.${name}.apk`))) {
      addIfExists(`split_config.${abi}.apk`)
    }

    const densityOutput = await this._adbShell(controller, 'wm density', { timeout: 5000 }).catch(() => '')
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
      String(await this._adbShell(controller, 'getprop persist.sys.locale', { timeout: 5000 }).catch(() => '')).trim() ||
      String(await this._adbShell(controller, 'getprop ro.product.locale', { timeout: 5000 }).catch(() => '')).trim() ||
      'en'
    )
    addIfExists(`split_config.${locale.split(/[-_]/)[0].toLowerCase()}.apk`)
    addIfExists('split_config.en.apk')
    addIfExists('split_config.nodpi.apk')

    return selected
  }

  async _getInstalledOptionalPackages(controller, packageNames) {
    const installed = []
    for (const packageName of packageNames) {
      if (await this._hasAndroidPackage(controller, packageName)) installed.push(packageName)
    }
    return unique(installed)
  }

  async _ensureBundledAndroidApps(controller) {
    const kickPackage = this._findAndroidPackageFile([
      'kick.apk',
      'kick-mobile.apk',
      'com.kick.mobile.apk',
      'kick.apkm',
      'kick-mobile.apkm',
      'com.kick.mobile.apkm'
    ])

    if (!kickPackage) {
      return {
        kick: await this._hasAndroidPackage(controller, KICK_ANDROID_PACKAGE),
        installedNow: false,
        source: ''
      }
    }

    const alreadyInstalled = await this._hasAndroidPackage(controller, KICK_ANDROID_PACKAGE)
    if (alreadyInstalled) {
      return {
        kick: true,
        installedNow: false,
        source: path.basename(kickPackage)
      }
    }

    await this._installAndroidPackageFile(controller, kickPackage)
    return {
      kick: await this._hasAndroidPackage(controller, KICK_ANDROID_PACKAGE),
      installedNow: true,
      source: path.basename(kickPackage)
    }
  }

  async _forceStopChromePackages(controller, packages) {
    for (const packageName of packages) {
      try {
        await this._adb(controller.serial, ['shell', 'am', 'force-stop', packageName], {
          adbPath: controller.adbPath,
          timeout: 8000
        })
      } catch (_) {}
    }
  }

  async _writeChromeWebRtcCommandLine(controller) {
    const commandLine = [
      'chrome',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      '--webrtc-ip-handling-policy=disable_non_proxied_udp',
      '--enable-features=WebRtcHideLocalIpsWithMdns',
      '--enforce-webrtc-ip-permission-check',
      '--disable-quic'
    ].join(' ')
    const quoted = shellQuote(commandLine)
    await this._adbShell(controller, [
      `printf '%s\\n' ${quoted} > /data/local/tmp/chrome-command-line`,
      `printf '%s\\n' ${quoted} > /data/local/tmp/android-webview-command-line`,
      'chmod 644 /data/local/tmp/chrome-command-line /data/local/tmp/android-webview-command-line'
    ].join(' && '), { timeout: 10000 })
  }

  async _clearChromeWebRtcCommandLine(controller) {
    try {
      await this._adbShell(controller, 'rm -f /data/local/tmp/chrome-command-line /data/local/tmp/android-webview-command-line', {
        timeout: 8000
      })
    } catch (_) {}
  }

  async _enableAdbRoot(controller) {
    try {
      const output = await this._run(controller.adbPath, ['-s', controller.serial, 'root'], { timeout: 10000 })
      if (/cannot run as root|production builds/i.test(output)) return false
      for (let i = 0; i < 15; i += 1) {
        try {
          const state = await this._adb(controller.serial, ['get-state'], {
            adbPath: controller.adbPath,
            timeout: 4000
          })
          if (state.trim() === 'device') return true
        } catch (_) {}
        await delay(1000)
      }
      return true
    } catch (_) {
      return false
    }
  }

  async _getPackageUid(controller, packageName) {
    const safePackage = packageName.replace(/[^a-zA-Z0-9._]/g, '')
    const output = await this._adbShell(controller, `cmd package list packages -U ${shellQuote(safePackage)} 2>/dev/null || dumpsys package ${shellQuote(safePackage)} 2>/dev/null`, {
      timeout: 10000
    })
    const uidMatch = output.match(/\buid:(\d+)\b/) || output.match(/\buserId=(\d+)\b/)
    return uidMatch ? uidMatch[1] : ''
  }

  async _getPackageUidMap(controller) {
    const output = await this._adbShell(controller, 'cmd package list packages -U 2>/dev/null || pm list packages -U', {
      timeout: 12000
    })
    const map = new Map()
    for (const line of normalizeOutputList(output)) {
      const match = line.match(/^package:([^\s]+)\s+uid:(\d+)/)
      if (match) map.set(match[1], match[2])
    }
    return map
  }

  async _getInstalledAndroidAppPackages(controller) {
    const uidMap = await this._getPackageUidMap(controller)
    const packages = []
    for (const [packageName, uid] of uidMap) {
      const numericUid = parseInt(uid, 10)
      if (Number.isFinite(numericUid) && numericUid >= 10000) {
        packages.push(packageName)
      }
    }
    return unique(packages)
  }

  async _clearAndroidWebRtcFirewall(controller, uids = []) {
    for (const uidGroup of chunks(unique(uids), 20)) {
      const uidRules = uidGroup
        .map(uid => [
          `while iptables -D OUTPUT -m owner --uid-owner ${uid} -j PROFILEO_WEBRTC 2>/dev/null; do :; done`,
          `while ip6tables -D OUTPUT -m owner --uid-owner ${uid} -j PROFILEO_WEBRTC 2>/dev/null; do :; done`
        ].join('\n'))
        .join('\n')
      await this._adbShell(controller, uidRules, { timeout: 15000 })
    }

    await this._adbShell(controller, [
      'iptables -F PROFILEO_WEBRTC 2>/dev/null || true',
      'iptables -X PROFILEO_WEBRTC 2>/dev/null || true',
      'ip6tables -F PROFILEO_WEBRTC 2>/dev/null || true',
      'ip6tables -X PROFILEO_WEBRTC 2>/dev/null || true'
    ].join('\n'), { timeout: 15000 })
  }

  async _applyAndroidWebRtcFirewall(controller, packages, proxyStatus = {}) {
    const rooted = await this._enableAdbRoot(controller)
    if (!rooted) return { firewall: false, reason: 'adb-root-unavailable', uids: [] }

    const uidMap = await this._getPackageUidMap(controller).catch(() => new Map())
    const uids = []
    for (const packageName of packages) {
      try {
        const uid = uidMap.get(packageName) || await this._getPackageUid(controller, packageName)
        if (uid) uids.push(uid)
      } catch (_) {}
    }

    const uniqueUids = unique(uids)
    if (!uniqueUids.length) return { firewall: false, reason: 'package-uid-not-found', uids: [] }

    await this._clearAndroidWebRtcFirewall(controller, uniqueUids)
    const hasProxyRelay = Boolean(proxyStatus.proxy && proxyStatus.relayPort)
    const ipv4Rules = hasProxyRelay
      ? [
          `iptables -A PROFILEO_WEBRTC -p tcp -d ${proxyStatus.relayHost} --dport ${proxyStatus.relayPort} -j RETURN`,
          'iptables -A PROFILEO_WEBRTC -p udp -j REJECT',
          'iptables -A PROFILEO_WEBRTC -p tcp -j REJECT',
          'iptables -A PROFILEO_WEBRTC -j REJECT'
        ]
      : [
          'iptables -A PROFILEO_WEBRTC -p udp -j REJECT',
          'iptables -A PROFILEO_WEBRTC -j RETURN'
        ]

    const ipv6Rules = hasProxyRelay
      ? [
          'ip6tables -A PROFILEO_WEBRTC -j REJECT'
        ]
      : [
          'ip6tables -A PROFILEO_WEBRTC -p udp -j REJECT',
          'ip6tables -A PROFILEO_WEBRTC -j RETURN'
        ]

    await this._adbShell(controller, [
      'iptables -N PROFILEO_WEBRTC 2>/dev/null || true',
      'iptables -F PROFILEO_WEBRTC',
      ...ipv4Rules,
      'ip6tables -N PROFILEO_WEBRTC 2>/dev/null || true',
      'ip6tables -F PROFILEO_WEBRTC',
      ...ipv6Rules
    ].join('\n'), { timeout: 15000 })

    for (const uidGroup of chunks(uniqueUids, 20)) {
      const uidRules = uidGroup
        .map(uid => [
          `iptables -I OUTPUT 1 -m owner --uid-owner ${uid} -j PROFILEO_WEBRTC`,
          `ip6tables -I OUTPUT 1 -m owner --uid-owner ${uid} -j PROFILEO_WEBRTC`
        ].join('\n'))
        .join('\n')
      await this._adbShell(controller, uidRules, { timeout: 15000 })
    }

    return { firewall: true, reason: '', uids: uniqueUids }
  }

  async _applyWebRtcProtection(profile, controller, proxyStatus = {}, protectedAppPackages = []) {
    const chromePackages = await this._getInstalledChromePackages(controller)
    const allAndroidAppPackages = await this._getInstalledAndroidAppPackages(controller)
    const androidAppPackages = await this._getInstalledOptionalPackages(controller, protectedAppPackages)
    const packages = unique([...allAndroidAppPackages, ...chromePackages, ...androidAppPackages])
    if (profile.webrtc === 'Real') {
      await this._clearChromeWebRtcCommandLine(controller)
      const rooted = await this._enableAdbRoot(controller)
      if (rooted) {
        const uids = []
        for (const packageName of packages) {
          try {
            const uid = await this._getPackageUid(controller, packageName)
            if (uid) uids.push(uid)
          } catch (_) {}
        }
        await this._clearAndroidWebRtcFirewall(controller, unique(uids))
      }
      return {
        webrtcPolicy: 'real',
        chromePackages,
        protectedPackages: packages,
        androidAppPackages: allAndroidAppPackages,
        protectedScope: 'all-installed-android-apps',
        protectedPackageCount: packages.length,
        firewall: false
      }
    }

    await this._writeChromeWebRtcCommandLine(controller)
    const firewallStatus = await this._applyAndroidWebRtcFirewall(controller, packages, proxyStatus)
    if (!firewallStatus.firewall) {
      throw new Error(`Strict Android WebRTC Lock could not be enabled (${firewallStatus.reason}). Use a rootable Google APIs Android Emulator image or set WebRTC to Real.`)
    }
    await this._forceStopChromePackages(controller, packages)
    return {
      webrtcPolicy: proxyStatus.proxy ? 'android-proxy-network-lock' : 'android-udp-lock',
      chromePackages,
      protectedPackages: packages,
      androidAppPackages: allAndroidAppPackages,
      protectedScope: 'all-installed-android-apps',
      protectedPackageCount: packages.length,
      firewall: true,
      uids: firewallStatus.uids
    }
  }

  async _openStartUrl(profile, controller, browserPackage = 'com.android.chrome') {
    const url = firstStartUrl(profile)
    await this._adb(controller.serial, ['shell', 'input', 'keyevent', '82'], {
      adbPath: controller.adbPath,
      timeout: 8000
    }).catch(() => {})
    await this._adb(controller.serial, [
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-p',
      browserPackage,
      '-d',
      url
    ], {
      adbPath: controller.adbPath,
      timeout: 15000
    })
    return url
  }

  async launchProfile(profile, options = {}) {
    const emulatorPath = await this._resolveTool('emulator')
    const adbPath = await this._resolveTool('adb')
    const hidden = Boolean(options.hidden)
    this._parseProxy(profile)
    const selected = await this._selectAvd(profile)
    this.runningAvds.add(selected.avdName)
    let port
    try {
      port = await this._allocatePort(profile.id)
      const serial = `emulator-${port}`
      const state = this._readState()
      state.profiles = state.profiles || {}
      state.profiles[profile.id] = {
        avdName: selected.avdName,
        port,
        scoped: selected.scoped,
        updatedAt: new Date().toISOString()
      }
      this._writeState(state)

      const args = [
        '-avd', selected.avdName,
        '-port', String(port),
        '-netdelay', 'none',
        '-netspeed', 'full',
        '-no-boot-anim'
      ]
      if (hidden) {
        args.push('-qt-hide-window')
      }

      const child = spawn(emulatorPath, args, {
        windowsHide: hidden,
        stdio: 'ignore',
        env: {
          ...process.env,
          ANDROID_HOME: process.env.ANDROID_HOME || this._sdkRoots()[0] || '',
          ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || this._sdkRoots()[0] || ''
        }
      })

      let controller
      const releaseAvd = () => {
        this.runningAvds.delete(selected.avdName)
        this.reservedPorts.delete(port)
        controller?.proxyRelay?.close()
      }
      child.once('exit', releaseAvd)
      child.once('error', releaseAvd)

      controller = {
        kind: 'android-emulator',
        process: child,
        adbPath,
        emulatorPath,
        avdName: selected.avdName,
        serial,
        port,
        scoped: selected.scoped,
        hidden,
        ready: null,
        proxyRelay: null,
        close: async () => {
          try {
            await this._run(adbPath, ['-s', serial, 'emu', 'kill'], { timeout: 8000 })
          } catch (_) {}
          controller.proxyRelay?.close()
          if (!child.killed && child.exitCode === null) child.kill()
          releaseAvd()
        }
      }

      controller.ready = (async () => {
        await this._waitForBoot(controller)
        const proxyStatus = await this._applyProxy(profile, controller)
        const bundledApps = await this._ensureBundledAndroidApps(controller).catch(error => ({
          kick: false,
          installedNow: false,
          source: '',
          error: error.message || 'Android app install failed'
        }))
        const protectedAppPackages = await this._getInstalledOptionalPackages(controller, [KICK_ANDROID_PACKAGE])
        const webrtcStatus = await this._applyWebRtcProtection(profile, controller, proxyStatus, protectedAppPackages)
        const url = await this._openStartUrl(profile, controller, webrtcStatus.chromePackages?.[0])
        return {
          url,
          bundledApps,
          ...webrtcStatus,
          ...proxyStatus
        }
      })()

      return controller
    } catch (error) {
      this.runningAvds.delete(selected.avdName)
      if (port) this.reservedPorts.delete(port)
      throw error
    }
  }
}
