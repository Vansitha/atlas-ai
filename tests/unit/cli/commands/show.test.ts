import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../../../../src/storage/manifest.js', () => ({
  findBySlug: vi.fn(),
}))

vi.mock('../../../../src/storage/reader.js', () => ({
  readEntry: vi.fn(),
  entryExists: vi.fn(),
}))

vi.mock('../../../../src/cli/ui.js', () => ({
  fail: vi.fn(),
}))

import { findBySlug } from '../../../../src/storage/manifest.js'
import { readEntry, entryExists } from '../../../../src/storage/reader.js'
import { fail } from '../../../../src/cli/ui.js'
import { registerShowCommand } from '../../../../src/cli/commands/show.js'
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
  registerShowCommand(program)
  return program
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('atlas show', () => {
  it('prints entry content when found', async () => {
    vi.mocked(findBySlug).mockReturnValue(mockEntry)
    vi.mocked(entryExists).mockReturnValue(true)
    vi.mocked(readEntry).mockReturnValue('# React Hooks\n\nContent.')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await makeProgram().parseAsync(['node', 'atlas', 'show', 'react-hooks'])

    expect(spy).toHaveBeenCalledWith('# React Hooks\n\nContent.')
    spy.mockRestore()
  })

  it('calls fail when slug not found', async () => {
    vi.mocked(findBySlug).mockReturnValue(undefined)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(
      makeProgram().parseAsync(['node', 'atlas', 'show', 'missing'])
    ).rejects.toThrow('exit')

    expect(fail).toHaveBeenCalledWith(expect.stringContaining('missing'))
    exitSpy.mockRestore()
  })

  it('calls fail when file missing on disk', async () => {
    vi.mocked(findBySlug).mockReturnValue(mockEntry)
    vi.mocked(entryExists).mockReturnValue(false)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(
      makeProgram().parseAsync(['node', 'atlas', 'show', 'react-hooks'])
    ).rejects.toThrow('exit')

    expect(fail).toHaveBeenCalledWith(expect.stringContaining('missing'))
    exitSpy.mockRestore()
  })
})
