import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  openSync: vi.fn(),
  closeSync: vi.fn(),
  realpathSync: vi.fn((p: string) => p),
}))

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('../../../src/storage/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/storage/paths.js')>()
  return {
    ...actual,
    DAEMON_PID_PATH: '/fake/.daemon.pid',
    DAEMON_HEARTBEAT_PATH: '/fake/.daemon.heartbeat',
    DAEMON_LOG_PATH: '/fake/.daemon.log',
  }
})

vi.mock('../../../src/config/loader.js', () => ({
  loadConfig: vi.fn(),
}))

const { existsSync, readFileSync, writeFileSync, unlinkSync, openSync, closeSync } =
  await import('node:fs')
const { spawn } = await import('node:child_process')
const { loadConfig } = await import('../../../src/config/loader.js')
const { getDaemonStatus, stopDaemon, startDaemon } =
  await import('../../../src/daemon/process-manager.js')

const mockExistsSync = vi.mocked(existsSync)
const mockReadFileSync = vi.mocked(readFileSync)
const mockWriteFileSync = vi.mocked(writeFileSync)
const mockUnlinkSync = vi.mocked(unlinkSync)
const mockOpenSync = vi.mocked(openSync)
const mockCloseSync = vi.mocked(closeSync)
const mockSpawn = vi.mocked(spawn)
const mockLoadConfig = vi.mocked(loadConfig)

const baseConfig = {
  version: 1,
  browser: 'chrome' as const,
  codingTools: [],
  aiProvider: null,
  daemon: { enabled: false, bookmarkFolder: 'Atlas', debounceMs: 2000 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLoadConfig.mockReturnValue(baseConfig)
  mockOpenSync.mockReturnValue(5 as unknown as ReturnType<typeof openSync>)
  mockCloseSync.mockReturnValue(undefined)
})

// ── getDaemonStatus ────────────────────────────────────────────────────────

describe('getDaemonStatus', () => {
  it('returns not-running when no PID file exists', () => {
    mockExistsSync.mockReturnValue(false)

    const status = getDaemonStatus()
    expect(status.running).toBe(false)
    expect(status.pid).toBeNull()
    expect(status.heartbeatAge).toBeNull()
    expect(status.bookmarkFolder).toBe('Atlas')
  })

  it('returns not-running when PID file is malformed', () => {
    mockExistsSync.mockImplementation((p) => p === '/fake/.daemon.pid')
    mockReadFileSync.mockReturnValue('not-a-number' as unknown as Buffer)

    const status = getDaemonStatus()
    expect(status.running).toBe(false)
    expect(status.pid).toBeNull()
  })

  it('returns not-running and cleans up stale PID file when process is dead', () => {
    mockExistsSync.mockImplementation((p) => p === '/fake/.daemon.pid')
    mockReadFileSync.mockReturnValue('99999' as unknown as Buffer)

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      const err = Object.assign(new Error('ESRCH'), { code: 'ESRCH' })
      throw err
    })

    const status = getDaemonStatus()
    expect(status.running).toBe(false)
    expect(mockUnlinkSync).toHaveBeenCalledWith('/fake/.daemon.pid')

    killSpy.mockRestore()
  })

  it('returns running with heartbeat age when process is alive', () => {
    const recentTimestamp = new Date(Date.now() - 10_000).toISOString()

    mockExistsSync.mockImplementation(() => true)
    mockReadFileSync.mockImplementation((p) => {
      if (p === '/fake/.daemon.pid') return '12345' as unknown as Buffer
      if (p === '/fake/.daemon.heartbeat') return recentTimestamp as unknown as Buffer
      return '' as unknown as Buffer
    })

    const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true)

    const status = getDaemonStatus()
    expect(status.running).toBe(true)
    expect(status.pid).toBe(12345)
    expect(status.heartbeatAge).toBeGreaterThanOrEqual(10)
    expect(status.heartbeatAge).toBeLessThan(15)

    killSpy.mockRestore()
  })

  it('returns null heartbeatAge when heartbeat file does not exist', () => {
    mockExistsSync.mockImplementation((p) => p === '/fake/.daemon.pid')
    mockReadFileSync.mockReturnValue('12345' as unknown as Buffer)

    const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true)

    const status = getDaemonStatus()
    expect(status.running).toBe(true)
    expect(status.heartbeatAge).toBeNull()

    killSpy.mockRestore()
  })
})

// ── stopDaemon ─────────────────────────────────────────────────────────────

describe('stopDaemon', () => {
  it('returns not-ok when no PID file exists', () => {
    mockExistsSync.mockReturnValue(false)

    const result = stopDaemon()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not running/i)
  })

  it('sends SIGTERM, removes PID and heartbeat files', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('12345' as unknown as Buffer)

    const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true)

    const result = stopDaemon()
    expect(result.ok).toBe(true)
    expect(killSpy).toHaveBeenCalledWith(12345, 'SIGTERM')
    expect(mockUnlinkSync).toHaveBeenCalledWith('/fake/.daemon.pid')
    expect(mockUnlinkSync).toHaveBeenCalledWith('/fake/.daemon.heartbeat')
    expect(result.message).toContain('12345')

    killSpy.mockRestore()
  })

  it('handles ESRCH gracefully (process already dead)', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('12345' as unknown as Buffer)

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      const err = Object.assign(new Error('ESRCH'), { code: 'ESRCH' })
      throw err
    })

    const result = stopDaemon()
    expect(result.ok).toBe(true)
    expect(mockUnlinkSync).toHaveBeenCalledWith('/fake/.daemon.pid')

    killSpy.mockRestore()
  })

  it('returns not-ok on unexpected kill error', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('12345' as unknown as Buffer)

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('EPERM: operation not permitted')
    })

    const result = stopDaemon()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/failed to stop/i)

    killSpy.mockRestore()
  })
})

// ── startDaemon ────────────────────────────────────────────────────────────

describe('startDaemon', () => {
  const mockChild = {
    pid: 54321,
    unref: vi.fn(),
  }

  beforeEach(() => {
    mockSpawn.mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>)
  })

  it('throws DaemonError when browser is null', () => {
    mockLoadConfig.mockReturnValue({ ...baseConfig, browser: null })
    mockExistsSync.mockReturnValue(false)

    expect(() => startDaemon()).toThrow('No browser configured')
  })

  it('throws DaemonError when browser is skip', () => {
    mockLoadConfig.mockReturnValue({ ...baseConfig, browser: 'skip' })
    mockExistsSync.mockReturnValue(false)

    expect(() => startDaemon()).toThrow('No browser configured')
  })

  it('throws DaemonError when bookmarks file does not exist', () => {
    // existsSync returns false for everything (no bookmarks file, no pid file)
    mockExistsSync.mockReturnValue(false)

    expect(() => startDaemon()).toThrow('Bookmark file not found')
  })

  it('throws DaemonError when daemon is already running', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('12345' as unknown as Buffer)

    const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true)

    expect(() => startDaemon()).toThrow('already running')

    killSpy.mockRestore()
  })

  it('spawns detached process and writes PID file', () => {
    // First call to existsSync: bookmarks file check (true)
    // Then getDaemonStatus internals: no PID file (false)
    mockExistsSync
      .mockReturnValueOnce(true) // bookmarks file exists
      .mockReturnValue(false) // no PID file (not running)

    const result = startDaemon()

    expect(mockSpawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([expect.stringContaining('atlas-worker.js')]),
      expect.objectContaining({ detached: true }),
    )
    expect(mockChild.unref).toHaveBeenCalled()
    expect(mockWriteFileSync).toHaveBeenCalledWith('/fake/.daemon.pid', '54321', 'utf-8')
    expect(result.pid).toBe(54321)
    expect(result.bookmarkFolder).toBe('Atlas')
  })

  it('returns the configured bookmark folder name', () => {
    const config = { ...baseConfig, daemon: { ...baseConfig.daemon, bookmarkFolder: 'MyCaptures' } }
    mockLoadConfig.mockReturnValue(config)

    mockExistsSync.mockReturnValueOnce(true).mockReturnValue(false)

    const result = startDaemon()
    expect(result.bookmarkFolder).toBe('MyCaptures')
  })
})
