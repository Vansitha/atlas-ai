import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../../../../src/daemon/process-manager.js', () => ({
  startDaemon: vi.fn(),
  stopDaemon: vi.fn(),
  getDaemonStatus: vi.fn(),
}))

vi.mock('../../../../src/daemon/watcher.js', () => ({
  startWatcher: vi.fn(),
}))

vi.mock('../../../../src/cli/ui.js', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  fail: vi.fn(),
}))

const { startDaemon, stopDaemon, getDaemonStatus } =
  await import('../../../../src/daemon/process-manager.js')
const { fail, outro } = await import('../../../../src/cli/ui.js')
const { registerDaemonCommand } = await import('../../../../src/cli/commands/daemon.js')

function makeProgram() {
  const program = new Command()
  program.exitOverride()
  registerDaemonCommand(program)
  return program
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── daemon start ───────────────────────────────────────────────────────────

describe('atlas daemon start', () => {
  it('calls startDaemon and prints outro on success', async () => {
    vi.mocked(startDaemon).mockReturnValue({ pid: 12345, bookmarkFolder: 'Atlas' })

    await makeProgram().parseAsync(['node', 'atlas', 'daemon', 'start'])

    expect(startDaemon).toHaveBeenCalled()
    expect(outro).toHaveBeenCalledWith(expect.stringContaining('12345'))
  })

  it('calls fail and exits on DaemonError', async () => {
    vi.mocked(startDaemon).mockImplementation(() => {
      throw new Error('No browser configured')
    })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    await makeProgram().parseAsync(['node', 'atlas', 'daemon', 'start'])

    expect(fail).toHaveBeenCalledWith('No browser configured')
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })
})

// ── daemon stop ────────────────────────────────────────────────────────────

describe('atlas daemon stop', () => {
  it('calls stopDaemon and prints outro when daemon was running', async () => {
    vi.mocked(stopDaemon).mockReturnValue({ ok: true, message: 'Daemon stopped (PID 12345)' })

    await makeProgram().parseAsync(['node', 'atlas', 'daemon', 'stop'])

    expect(stopDaemon).toHaveBeenCalled()
    expect(outro).toHaveBeenCalledWith('Daemon stopped (PID 12345)')
  })

  it('calls fail and exits when daemon is not running', async () => {
    vi.mocked(stopDaemon).mockReturnValue({ ok: false, message: 'Daemon is not running' })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    await makeProgram().parseAsync(['node', 'atlas', 'daemon', 'stop'])

    expect(fail).toHaveBeenCalledWith('Daemon is not running')
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })
})

// ── daemon status ──────────────────────────────────────────────────────────

describe('atlas daemon status', () => {
  it('prints not-running message when daemon is stopped', async () => {
    vi.mocked(getDaemonStatus).mockReturnValue({
      running: false,
      pid: null,
      bookmarkFolder: 'Atlas',
      heartbeatAge: null,
    })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'daemon', 'status'])

    const output = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('not running')
    spy.mockRestore()
  })

  it('prints running status with PID and heartbeat', async () => {
    vi.mocked(getDaemonStatus).mockReturnValue({
      running: true,
      pid: 42,
      bookmarkFolder: 'Atlas',
      heartbeatAge: 5,
    })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'daemon', 'status'])

    const output = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('42')
    expect(output).toContain('5s ago')
    spy.mockRestore()
  })

  it('shows stale warning when heartbeat is older than 60 seconds', async () => {
    vi.mocked(getDaemonStatus).mockReturnValue({
      running: true,
      pid: 99,
      bookmarkFolder: 'Atlas',
      heartbeatAge: 120,
    })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'daemon', 'status'])

    const output = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('stale')
    spy.mockRestore()
  })
})
