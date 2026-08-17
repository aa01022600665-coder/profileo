import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'

const RULE_NAME = 'Profileo Strict Proxy Lock'

function psLiteral(value) {
  return String(value).replace(/'/g, "''")
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => resolve({ code, stdout, stderr }))
  })
}

export class WindowsProxyLock {
  async isEnabledFor(programPath) {
    if (process.platform !== 'win32') return false

    const ruleName = psLiteral(RULE_NAME)
    const program = psLiteral(path.resolve(programPath))
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `$rules = @(Get-NetFirewallRule -DisplayName '${ruleName}' -ErrorAction SilentlyContinue)`,
      'foreach ($rule in $rules) {',
      '  $filter = $rule | Get-NetFirewallApplicationFilter',
      `  if ($filter.Program -eq '${program}') { Write-Output 'enabled'; exit 0 }`,
      '}',
      'exit 0'
    ].join('\n')
    const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script])
    return result.code === 0 && result.stdout.trim() === 'enabled'
  }

  async enableFor(programPath) {
    if (process.platform !== 'win32') {
      throw new Error('Strict Proxy Lock is currently available only on Windows.')
    }
    if (!fs.existsSync(programPath)) {
      throw new Error('Could not find the Profileo browser needed for Strict Proxy Lock.')
    }
    if (await this.isEnabledFor(programPath)) return { changed: false }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profileo-proxy-lock-'))
    const scriptPath = path.join(tempDir, 'enable.ps1')
    const ruleName = psLiteral(RULE_NAME)
    const program = psLiteral(path.resolve(programPath))
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `$ruleName = '${ruleName}'`,
      `$programPath = '${program}'`,
      '$existing = @(Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)',
      'if ($existing.Count -gt 0) { $existing | Remove-NetFirewallRule }',
      'New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Action Block -Program $programPath -RemoteAddress Internet -Profile Any -Enabled True | Out-Null'
    ].join('\r\n')

    fs.writeFileSync(scriptPath, script, 'utf8')
    const escapedPath = psLiteral(scriptPath)
    const elevate = [
      "$ErrorActionPreference = 'Stop'",
      `$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""${escapedPath}""'`,
      "$process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -Wait -PassThru",
      'exit $process.ExitCode'
    ].join('; ')

    try {
      const result = await run('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        elevate
      ])
      if (result.code !== 0) {
        const reason = (result.stderr || result.stdout || 'Windows did not enable the firewall rule.').trim()
        throw new Error(reason)
      }
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch (_) {}
    }

    if (!await this.isEnabledFor(programPath)) {
      throw new Error('Windows did not confirm the Strict Proxy Lock rule.')
    }
    return { changed: true }
  }

  async disableFor(programPath) {
    if (process.platform !== 'win32') return { changed: false }
    if (!await this.isEnabledFor(programPath)) return { changed: false }

    const ruleName = psLiteral(RULE_NAME)
    const program = psLiteral(path.resolve(programPath))
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `$rules = @(Get-NetFirewallRule -DisplayName '${ruleName}' -ErrorAction SilentlyContinue)`,
      '$removed = $false',
      'foreach ($rule in $rules) {',
      '  $filter = $rule | Get-NetFirewallApplicationFilter',
      `  if ($filter.Program -eq '${program}') { $rule | Remove-NetFirewallRule; $removed = $true }`,
      '}',
      "if ($removed) { Write-Output 'removed' }"
    ].join('\r\n')

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profileo-proxy-unlock-'))
    const scriptPath = path.join(tempDir, 'disable.ps1')
    fs.writeFileSync(scriptPath, script, 'utf8')

    const escapedPath = psLiteral(scriptPath)
    const elevate = [
      "$ErrorActionPreference = 'Stop'",
      `$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""${escapedPath}""'`,
      "$process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -Wait -PassThru",
      'exit $process.ExitCode'
    ].join('; ')

    try {
      const result = await run('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        elevate
      ])
      if (result.code !== 0) {
        const reason = (result.stderr || result.stdout || 'Windows did not remove the firewall rule.').trim()
        throw new Error(reason)
      }
      return { changed: result.stdout.trim() === 'removed' }
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch (_) {}
    }
  }
}
