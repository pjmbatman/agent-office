import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const configPath = process.argv[2]

if (!configPath) {
  process.stderr.write('Missing runner config path\n')
  process.exit(1)
}

let config

try {
  config = JSON.parse(readFileSync(configPath, 'utf8'))
} catch (error) {
  process.stderr.write(`Failed to read runner config: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

const env = createChildEnv()
const child = spawn('python3', [getPtyRunnerPath(), configPath], {
  cwd: config.cwd || process.cwd(),
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
})

let stdout = ''
let stderr = ''

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString()
})

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString()
})

child.on('error', (error) => {
  const result = {
    exitCode: 1,
    error: error.message,
    stderr: filterCodexWarnings(stderr),
    outputText: readOutputText(config.outputFile),
    stdout,
  }
  writeDebugArtifacts(config.debugDir, result)
  writeResult(result)
})

child.on('close', (code) => {
  const result = {
    exitCode: code ?? 1,
    stderr: filterCodexWarnings(stderr),
    outputText: readOutputText(config.outputFile),
    stdout,
  }
  writeDebugArtifacts(config.debugDir, result)
  writeResult(result)
})

function createChildEnv() {
  const nextEnv = { ...process.env }

  for (const key of Object.keys(nextEnv)) {
    if (
      key.startsWith('ELECTRON_') ||
      key.startsWith('npm_') ||
      key.startsWith('VITE_')
    ) {
      delete nextEnv[key]
    }
  }

  delete nextEnv.NODE_ENV
  delete nextEnv.NODE_ENV_ELECTRON_VITE
  delete nextEnv.NODE_OPTIONS
  delete nextEnv.INIT_CWD

  return nextEnv
}

function getPtyRunnerPath() {
  return fileURLToPath(new URL('./codex-pty-runner.py', import.meta.url))
}

function readOutputText(outputFile) {
  if (!outputFile) return ''

  try {
    return readFileSync(outputFile, 'utf8').trim()
  } catch {
    return ''
  }
}

function filterCodexWarnings(stderrText) {
  if (!stderrText) return ''

  return stderrText
    .split('\n')
    .filter((line) => {
      if (!line.trim()) return false
      if (line.includes("Accessing non-existent property 'lineno' of module exports inside circular dependency")) return false
      if (line.includes("Accessing non-existent property 'filename' of module exports inside circular dependency")) return false
      if (line.includes('(Use `node --trace-warnings ...` to show where the warning was created)')) return false
      return true
    })
    .join('\n')
}

function writeResult(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

function writeDebugArtifacts(debugDir, result) {
  if (!debugDir) return

  try {
    mkdirSync(debugDir, { recursive: true })
    const stamp = `${Date.now()}-${process.pid}`
    writeFileSync(join(debugDir, `codex-runner-${stamp}.json`), JSON.stringify({
      ...result,
      runnerCwd: process.cwd(),
      config,
      env: pickDebugEnv(process.env),
    }, null, 2))
    if (config.outputFile) {
      writeFileSync(join(debugDir, `codex-runner-output-path-${stamp}.txt`), String(config.outputFile))
    }
  } catch {
    // ignore debug write failures
  }
}

function pickDebugEnv(env) {
  const keys = [
    'HOME',
    'PATH',
    'SHELL',
    'LANG',
    'TERM',
    'COLORTERM',
    'TMPDIR',
    'SSH_AUTH_SOCK',
    'TERM_PROGRAM',
    'TERM_PROGRAM_VERSION',
    'TERM_SESSION_ID',
    'ITERM_SESSION_ID',
    'NODE',
    'NODE_ENV',
    'ELECTRON_RUN_AS_NODE',
    'ELECTRON_NO_ATTACH_CONSOLE',
    'ELECTRON_ENABLE_LOGGING',
    'ELECTRON_ENABLE_STACK_DUMPING',
    'npm_lifecycle_event',
    'npm_command',
  ]

  return Object.fromEntries(keys.map((key) => [key, env[key] ?? null]))
}
