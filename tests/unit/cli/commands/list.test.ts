import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../../../../src/storage/manifest.js', () => ({
  listEntries: vi.fn(),
}))

vi.mock('../../../../src/cli/ui.js', () => ({
  fail: vi.fn(),
}))

import { listEntries } from '../../../../src/storage/manifest.js'
import { registerListCommand } from '../../../../src/cli/commands/list.js'
import type { StoredEntry } from '../../../../src/types/index.js'

const mockEntry: StoredEntry = {
  slug: 'react-hooks',
  title: 'React Hooks',
  type: 'skill',
  sourceUrl: 'https://example.com',
  urlHash: 'abc',
  capturedAt: new Date().toISOString(),
  tags: ['react'],
  filePath: '/tmp/skills/react-hooks/SKILL.md',
}

function makeProgram() {
  const program = new Command()
  program.exitOverride()
  registerListCommand(program)
  return program
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('atlas list', () => {
  it('calls listEntries and prints table', async () => {
    vi.mocked(listEntries).mockReturnValue([mockEntry])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'list'])

    expect(listEntries).toHaveBeenCalledWith(undefined)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('passes type filter to listEntries', async () => {
    vi.mocked(listEntries).mockReturnValue([])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'list', '--type', 'skill'])

    expect(listEntries).toHaveBeenCalledWith('skill')
    spy.mockRestore()
  })

  it('prints empty state message when no entries', async () => {
    vi.mocked(listEntries).mockReturnValue([])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'list'])

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No entries found'))
    spy.mockRestore()
  })

  it('filters by tag', async () => {
    const tagged: StoredEntry = { ...mockEntry, tags: ['vue'] }
    vi.mocked(listEntries).mockReturnValue([mockEntry, tagged])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'list', '--tag', 'vue'])

    const output = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).not.toContain('No entries found')
    spy.mockRestore()
  })
})
