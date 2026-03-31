import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../../../../src/storage/manifest.js', () => ({
  findBySlug: vi.fn(),
  removeEntry: vi.fn(),
}))

vi.mock('../../../../src/providers/registry.js', () => ({
  getAllProviders: vi.fn(() => []),
  syncAll: vi.fn(async () => []),
}))

vi.mock('../../../../src/cli/ui.js', () => ({
  confirm: vi.fn(async () => true),
  fail: vi.fn(),
  outro: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    unlinkSync: vi.fn(),
    rmdirSync: vi.fn(),
    existsSync: vi.fn(() => true),
  }
})

import { findBySlug, removeEntry } from '../../../../src/storage/manifest.js'
import { fail, outro } from '../../../../src/cli/ui.js'
import { registerDeleteCommand } from '../../../../src/cli/commands/delete.js'
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
  registerDeleteCommand(program)
  return program
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('atlas delete', () => {
  it('calls fail when slug not found', async () => {
    vi.mocked(findBySlug).mockReturnValue(undefined)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })

    await expect(makeProgram().parseAsync(['node', 'atlas', 'delete', 'missing'])).rejects.toThrow(
      'exit',
    )

    expect(fail).toHaveBeenCalledWith(expect.stringContaining('missing'))
    exitSpy.mockRestore()
  })

  it('removes the entry from manifest with --force', async () => {
    vi.mocked(findBySlug).mockReturnValue(mockEntry)

    await makeProgram().parseAsync(['node', 'atlas', 'delete', 'react-hooks', '--force'])

    expect(removeEntry).toHaveBeenCalledWith('react-hooks')
  })

  it('calls outro on success', async () => {
    vi.mocked(findBySlug).mockReturnValue(mockEntry)

    await makeProgram().parseAsync(['node', 'atlas', 'delete', 'react-hooks', '--force'])

    expect(outro).toHaveBeenCalledWith(expect.stringContaining('React Hooks'))
  })

  it('prompts for confirmation without --force', async () => {
    vi.mocked(findBySlug).mockReturnValue(mockEntry)
    const { confirm } = await import('../../../../src/cli/ui.js')

    await makeProgram().parseAsync(['node', 'atlas', 'delete', 'react-hooks'])

    expect(confirm).toHaveBeenCalled()
  })

  it('handles gracefully when file is already missing on disk', async () => {
    vi.mocked(findBySlug).mockReturnValue(mockEntry)
    const { existsSync: fsExists } = await import('node:fs')
    vi.mocked(fsExists).mockReturnValue(false)

    await expect(
      makeProgram().parseAsync(['node', 'atlas', 'delete', 'react-hooks', '--force']),
    ).resolves.toBeDefined()

    expect(removeEntry).toHaveBeenCalledWith('react-hooks')
  })
})
