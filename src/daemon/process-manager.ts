import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync, closeSync, realpathSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { DAEMON_PID_PATH, DAEMON_HEARTBEAT_PATH, DAEMON_LOG_PATH, findBookmarksPath } from '../storage/paths.js'
import { loadConfig } from '../config/loader.js'
import { DaemonError } from '../utils/errors.js'

export interface DaemonStatus {
  running: boolean
  pid: number | null
  bookmarkFolder: string
  heartbeatAge: number | null
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// macOS max PID is 99998; use a conservative upper bound
const MAX_PID = 4_194_304

function readPidFile(): number | null {
  if (!existsSync(DAEMON_PID_PATH)) return null
  try {
    const raw = readFileSync(DAEMON_PID_PATH, 'utf-8').trim()
    const pid = parseInt(raw, 10)
    if (isNaN(pid) || pid <= 0 || pid > MAX_PID) return null
    return pid
  } catch {
    return null
  }
}

export function getDaemonStatus(): DaemonStatus {
  const config = loadConfig()
  const folder = config.daemon.bookmarkFolder

  const pid = readPidFile()
  if (pid === null) {
    return { running: false, pid: null, bookmarkFolder: folder, heartbeatAge: null }
  }

  if (!isProcessAlive(pid)) {
    try { unlinkSync(DAEMON_PID_PATH) } catch {}
    return { running: false, pid: null, bookmarkFolder: folder, heartbeatAge: null }
  }

  let heartbeatAge: number | null = null
  if (existsSync(DAEMON_HEARTBEAT_PATH)) {
    try {
      const ts = readFileSync(DAEMON_HEARTBEAT_PATH, 'utf-8').trim()
      const beatTime = new Date(ts).getTime()
      if (!isNaN(beatTime)) {
        heartbeatAge = Math.floor((Date.now() - beatTime) / 1000)
      }
    } catch {}
  }

  return { running: true, pid, bookmarkFolder: folder, heartbeatAge }
}

export function stopDaemon(): { ok: boolean; message: string } {
  const pid = readPidFile()
  if (pid === null) {
    return { ok: false, message: 'Daemon is not running' }
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ESRCH') {
      return { ok: false, message: `Failed to stop daemon: ${err instanceof Error ? err.message : String(err)}` }
    }
    // ESRCH = process already gone, treat as success
  }

  try { unlinkSync(DAEMON_PID_PATH) } catch {}
  try { unlinkSync(DAEMON_HEARTBEAT_PATH) } catch {}

  return { ok: true, message: `Daemon stopped (PID ${pid})` }
}

export function startDaemon(): { pid: number; bookmarkFolder: string } {
  const config = loadConfig()

  if (!config.browser || config.browser === 'skip') {
    throw new DaemonError('No browser configured. Run atlas init to set up.')
  }

  const bookmarksPath = findBookmarksPath(config.browser, config.browserProfile)
  if (!bookmarksPath) {
    throw new DaemonError(
      `Bookmark file not found for ${config.browser}. Is the browser installed and has been opened at least once?`,
    )
  }

  const existing = getDaemonStatus()
  if (existing.running) {
    throw new DaemonError(`Daemon is already running (PID ${existing.pid})`)
  }

  // Resolve the worker script relative to the currently running binary.
  // realpathSync resolves symlinks (e.g. global npm installs) so dirname
  // always points to the real dist/bin/ directory, not the bin symlink folder.
  const workerPath = join(dirname(realpathSync(process.argv[1])), 'atlas-worker.js')

  let logFd: number
  try {
    logFd = openSync(DAEMON_LOG_PATH, 'w') // 'w' truncates — fresh log on every start
  } catch {
    throw new DaemonError(`Could not open log file at ${DAEMON_LOG_PATH}`)
  }

  const child = spawn(process.execPath, [workerPath], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    // Prevent a visible console window from appearing on Windows
    windowsHide: true,
  })

  child.unref()
  closeSync(logFd)

  if (child.pid === undefined) {
    throw new DaemonError('Failed to spawn daemon process')
  }

  writeFileSync(DAEMON_PID_PATH, String(child.pid), 'utf-8')

  return { pid: child.pid, bookmarkFolder: config.daemon.bookmarkFolder }
}
