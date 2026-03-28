import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../../../../src/storage/manifest.js', () => ({
  search: vi.fn(),
}))

vi.mock('../../../../src/cli/ui.js', () => ({
  fail: vi.fn(),
}))

import { search } from '../../../../src/storage/manifest.js'
import { registerSearchCommand } from '../../../../src/cli/commands/search.js'
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
  registerSearchCommand(program)
  return program
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('atlas search', () => {
  it('calls search with the query', async () => {
    vi.mocked(search).mockReturnValue([mockEntry])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'search', 'react'])

    expect(search).toHaveBeenCalledWith('react')
    spy.mockRestore()
  })

  it('prints empty state when no results', async () => {
    vi.mocked(search).mockReturnValue([])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'search', 'unknown'])

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No results'))
    spy.mockRestore()
  })

  it('renders table when results found', async () => {
    vi.mocked(search).mockReturnValue([mockEntry])
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'search', 'react'])

    const output = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('SLUG')
    spy.mockRestore()
  })
})
