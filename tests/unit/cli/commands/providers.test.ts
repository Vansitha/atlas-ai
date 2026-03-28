import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../../../../src/providers/registry.js', () => ({
  syncAll: vi.fn(),
  verifyAll: vi.fn(),
}))

vi.mock('../../../../src/cli/ui.js', () => ({
  withSpinner: vi.fn(async (_msg, fn) => fn()),
  fail: vi.fn(),
  outro: vi.fn(),
}))

import { syncAll, verifyAll } from '../../../../src/providers/registry.js'
import { registerProvidersCommand } from '../../../../src/cli/commands/providers.js'
import type { SyncStatus } from '../../../../src/types/index.js'

function makeProgram() {
  const program = new Command()
  program.exitOverride()
  registerProvidersCommand(program)
  return program
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('atlas providers status', () => {
  it('calls verifyAll and prints table', async () => {
    const statuses: SyncStatus[] = [
      { provider: 'claude-code', configured: true, healthy: true, details: 'Claude Code detected' },
    ]
    vi.mocked(verifyAll).mockResolvedValue(statuses)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'providers', 'status'])

    expect(verifyAll).toHaveBeenCalled()
    const output = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('claude-code')
    spy.mockRestore()
  })
})

describe('atlas providers sync', () => {
  it('calls syncAll and prints results', async () => {
    vi.mocked(syncAll).mockResolvedValue([
      { provider: 'claude-code', entriesSynced: 3, errors: [] },
    ])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'providers', 'sync'])

    expect(syncAll).toHaveBeenCalled()
    const output = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('claude-code')
    expect(output).toContain('3 entries synced')
    spy.mockRestore()
  })
})
