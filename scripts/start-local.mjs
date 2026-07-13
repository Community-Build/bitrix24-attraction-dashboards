import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import { prepareLocalDev } from './prepare-local-dev.mjs'

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NODE_MODULES_PATH = resolve(ROOT_DIR, 'node_modules')
const DEV_PORTS = [5173, 5174, 8787]
const EXPECTED_PNPM_MAJOR = 10

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: 'inherit',
    ...options,
  })
}

function getPnpmRunner() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath],
    }
  }

  return {
    command: 'pnpm',
    args: [],
  }
}

function runPnpm(args, options = {}) {
  const runner = getPnpmRunner()

  return runCommand(runner.command, [...runner.args, ...args], options)
}

function ensurePnpm() {
  const result = runPnpm(['--version'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  })

  if (result.error || result.status !== 0) {
    console.error('[launcher] pnpm is required but was not found.')
    process.exit(result.status ?? 1)
  }

  const version = result.stdout.trim()
  const major = Number(version.split('.')[0] ?? 0)

  if (major !== EXPECTED_PNPM_MAJOR) {
    console.error(
      `[launcher] pnpm ${EXPECTED_PNPM_MAJOR}.x is required, got ${version}. Start with: corepack pnpm@10.9.0 start:local`,
    )
    process.exit(1)
  }
}

function parseMajorMinor(version) {
  const [major = '0', minor = '0'] = version.replace(/^v/u, '').split('.')
  return {
    major: Number(major),
    minor: Number(minor),
  }
}

function ensureNodeVersion() {
  const current = parseMajorMinor(process.version)
  const supported =
    current.major > 20 ||
    (current.major === 20 && current.minor >= 19) ||
    current.major >= 22

  if (!supported) {
    console.warn(
      `[launcher] Node ${process.version} is below the Vite recommendation (20.19+ or 22.12+). The stack may still start, but upgrading Node is recommended.`,
    )
  }
}

function ensureDependencies() {
  if (existsSync(NODE_MODULES_PATH)) {
    return
  }

  console.log('[launcher] Installing dependencies with pnpm...')
  const result = runPnpm(['install'])

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function getListeningPids(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  })

  if (result.error || (!result.stdout && result.status !== 0)) {
    return []
  }

  return result.stdout
    .split('\n')
    .filter((line) => line.startsWith('p'))
    .map((line) => Number(line.slice(1)))
    .filter((pid) => Number.isInteger(pid) && pid > 0)
}

function getProcessCommand(pid) {
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  })

  if (result.error || result.status !== 0) {
    return ''
  }

  return result.stdout.trim()
}

function isProjectDevProcess(command) {
  return (
    command.includes(ROOT_DIR) &&
    (command.includes('vite') ||
      command.includes('tsx watch') ||
      (command.includes('tsx') && command.includes('watch src/index.ts')) ||
      command.includes('bitrix24-reporting-local@ start'))
  )
}

function cleanupProjectPorts() {
  for (const port of DEV_PORTS) {
    const pids = getListeningPids(port)

    for (const pid of pids) {
      if (pid === process.pid) {
        continue
      }

      const command = getProcessCommand(pid)

      if (!isProjectDevProcess(command)) {
        continue
      }

      try {
        process.kill(pid, 'SIGTERM')
        console.log(`[launcher] Stopped stale project process on port ${port} (pid ${pid}).`)
      } catch {
        // Ignore already-closed processes.
      }
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (getListeningPids(port).length === 0) {
        break
      }

      sleep(100)
    }
  }
}

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-9;]*m/gu, '')
}

function pipeOutput(stream, prefix, onLine) {
  const reader = readline.createInterface({ input: stream })

  reader.on('line', (line) => {
    const cleanLine = stripAnsi(line)
    console.log(`${prefix} ${cleanLine}`)
    onLine?.(cleanLine)
  })

  return reader
}

function spawnPrefixedProcess(name, args, onLine) {
  const runner = getPnpmRunner()
  const child = spawn(runner.command, [...runner.args, ...args], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  pipeOutput(child.stdout, `[${name}]`, onLine)
  pipeOutput(child.stderr, `[${name}]`, onLine)

  return child
}

function openBrowser(url) {
  if (process.platform !== 'darwin' || process.env.NO_BROWSER === '1') {
    return
  }

  spawn('open', [url], {
    cwd: ROOT_DIR,
    detached: true,
    stdio: 'ignore',
  }).unref()
}

ensurePnpm()
ensureNodeVersion()
ensureDependencies()
cleanupProjectPorts()

const setup = prepareLocalDev()

console.log(`[launcher] Local env is ready. API will be available at ${setup.apiBaseUrl}.`)
if (!setup.bitrixConfigured) {
  console.log(
    '[launcher] Bitrix24 webhook is not configured yet. The app will launch locally, but Refresh will not sync live CRM data until .env is updated.',
  )
}
console.log(`[launcher] API health: ${setup.apiBaseUrl}/api/health`)
console.log('[launcher] Web UI URL will be printed by Vite below.')
console.log('[launcher] Refresh inside the UI starts the manual sync flow.')

let browserOpened = false
let shuttingDown = false
const processes = [
  spawnPrefixedProcess('api', ['--filter', '@bitrix24-reporting/api', 'dev']),
  spawnPrefixedProcess('web', ['--filter', '@bitrix24-reporting/web', 'dev'], (line) => {
    if (browserOpened) {
      return
    }

    const match = line.match(/https?:\/\/[^\s]+/u)

    if (match) {
      browserOpened = true
      openBrowser(match[0])
    }
  }),
]

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  for (const child of processes) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => {
    process.exit(exitCode)
  }, 250)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

for (const [index, child] of processes.entries()) {
  child.on('exit', (code) => {
    if (shuttingDown) {
      return
    }

    const name = index === 0 ? 'api' : 'web'
    const exitCode = typeof code === 'number' ? code : 1

    console.error(`[launcher] ${name} exited with code ${exitCode}. Stopping the local stack.`)
    shutdown(exitCode)
  })
}
