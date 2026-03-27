import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

const checks = []
const warnings = []

function addCheck(name, fn) {
  checks.push({ name, fn })
}

function resolveNpmCommand() {
  if (spawnSync('/bin/bash', ['-lc', 'command -v npm'], { cwd: root, stdio: 'ignore', env: process.env }).status === 0) {
    return 'npm'
  }

  const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME || '', '.nvm')
  const nvmScript = path.join(nvmDir, 'nvm.sh')
  if (existsSync(nvmScript)) {
    return `source '${nvmScript}' && npm`
  }

  throw new Error('npm is not available in PATH and no nvm installation was found')
}

function runCommand(command) {
  execSync(command, {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    shell: '/bin/bash',
    env: process.env,
  })
}

function runShell(command) {
  return spawnSync('/bin/bash', ['-lc', command], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  })
}

function fileContains(file, text) {
  return readFileSync(path.join(root, file), 'utf8').includes(text)
}

const npmCommand = resolveNpmCommand()

addCheck('Build succeeds', () => {
  runCommand(`${npmCommand} run build`)
})

addCheck('Typecheck succeeds', () => {
  runCommand(`${npmCommand} run typecheck`)
})

addCheck('Electron native rebuild hook exists', () => {
  if (packageJson.scripts?.postinstall !== 'npm run rebuild:native') {
    throw new Error('package.json postinstall is missing the rebuild:native hook')
  }
  if (!String(packageJson.scripts?.['rebuild:native'] || '').includes('electron-rebuild')) {
    throw new Error('package.json rebuild:native does not use electron-rebuild')
  }
})

addCheck('Renderer fail-loud path exists', () => {
  if (!existsSync(path.join(root, 'src/renderer/components/ErrorBoundary.tsx'))) {
    throw new Error('ErrorBoundary.tsx is missing')
  }
  if (!fileContains('src/renderer/main.tsx', '<ErrorBoundary>')) {
    throw new Error('Renderer root is not wrapped in ErrorBoundary')
  }
})

addCheck('Preload bridge contract exists', () => {
  if (!fileContains('src/preload/index.ts', "contextBridge.exposeInMainWorld('agentOffice', api)")) {
    throw new Error('agentOffice preload bridge is missing')
  }
  if (!fileContains('src/renderer/lib/agent-office.ts', 'window.agentOffice is unavailable')) {
    throw new Error('renderer guard for missing preload bridge is missing')
  }
})

addCheck('Settings panel loads persisted agent configs', () => {
  if (!fileContains('src/renderer/components/SettingsPanel.tsx', 'getAgentOffice().getAgentConfigs()')) {
    throw new Error('SettingsPanel does not load saved agent configs')
  }
  if (!fileContains('src/main/ipc-handlers.ts', "ipcMain.handle('agent:get-configs'")) {
    throw new Error('agent:get-configs IPC handler is missing')
  }
})

addCheck('Settings panel persists and validates configs', () => {
  const settings = readFileSync(path.join(root, 'src/renderer/components/SettingsPanel.tsx'), 'utf8')
  if (!settings.includes('remote target requires host, user, and remote workspace path')) {
    throw new Error('remote target validation is missing')
  }
  if (!settings.includes('configureAgent({')) {
    throw new Error('SettingsPanel does not persist configs')
  }
})

addCheck('At least one built-in agent CLI is discoverable', () => {
  const available = ['claude', 'codex'].filter((cmd) => runShell(`command -v ${cmd}`).status === 0)
  if (available.length === 0) {
    throw new Error('Neither `claude` nor `codex` is installed')
  }
})

addCheck('Preferred provider fallback exists', () => {
  if (!fileContains('src/main/system/runtime-diagnostics.ts', 'preferredProvider')) {
    throw new Error('preferred provider fallback is missing')
  }
})

addCheck('Electron host runtime dependencies are reported', () => {
  const electronBin = path.join(root, 'node_modules/electron/dist/electron')
  if (!existsSync(electronBin)) {
    throw new Error('Electron binary is missing')
  }

  const ldd = runShell(`ldd '${electronBin}'`)
  if (ldd.status !== 0) {
    throw new Error(ldd.stderr.trim() || 'ldd failed for Electron binary')
  }

  const missing = ldd.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('not found'))

  if (missing.length > 0) {
    warnings.push(`Electron host libraries missing in this shell: ${missing.join('; ')}`)
  }
})

let failed = 0

for (const check of checks) {
  try {
    check.fn()
    console.log(`PASS  ${check.name}`)
  } catch (error) {
    failed += 1
    console.log(`FAIL  ${check.name}`)
    console.log(`      ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed > 0) {
  console.log(`\nService readiness failed: ${failed}/${checks.length} checks failed.`)
  process.exit(1)
}

if (warnings.length > 0) {
  console.log('\nWarnings:')
  for (const warning of warnings) {
    console.log(`WARN  ${warning}`)
  }
}

console.log(`\nService readiness passed: ${checks.length}/${checks.length} checks passed.`)
