import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../../../../src/config/loader.js', () => ({
  loadConfig: vi.fn(() => ({
    version: 1,
    browser: null,
    codingTools: [],
    aiProvider: null,
    daemon: { enabled: false, bookmarkFolder: 'Atlas', debounceMs: 2000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  updateConfig: vi.fn((partial) => ({
    version: 1,
    browser: partial.browser ?? null,
    codingTools: partial.codingTools ?? [],
    aiProvider: partial.aiProvider ?? null,
    daemon: { enabled: false, bookmarkFolder: 'Atlas', debounceMs: 2000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
}))

vi.mock('../../../../src/storage/paths.js', () => ({
  ATLAS_HOME: '/tmp/atlas-init-test',
  CONFIG_PATH: '/tmp/atlas-init-test/config.json',
  SKILLS_DIR: '/tmp/atlas-init-test/skills',
  KNOWLEDGE_DIR: '/tmp/atlas-init-test/knowledge',
  MANIFEST_PATH: '/tmp/atlas-init-test/.index.json',
  CONTENT_CACHE_PATH: '/tmp/atlas-init-test/.content-cache.json',
  ACCURACY_LOG_PATH: '/tmp/atlas-init-test/.accuracy-log.jsonl',
  DAEMON_PID_PATH: '/tmp/atlas-init-test/.daemon.pid',
  DAEMON_HEARTBEAT_PATH: '/tmp/atlas-init-test/.daemon.heartbeat',
  BROWSER_BOOKMARK_PATHS: {},
  listBrowserProfiles: vi.fn(() => []),
  findBookmarksPath: vi.fn(() => null),
  ensureBookmarkFolder: vi.fn(() => 'created' as const),
}))

vi.mock('../../../../src/daemon/process-manager.js', () => ({
  startDaemon: vi.fn(() => ({ pid: 99999, bookmarkFolder: 'Atlas' })),
}))

vi.mock('../../../../src/cli/detect.js', () => ({
  detectBrowsers: vi.fn(() => ['chrome']),
  detectCodingTools: vi.fn(() => ['claude-code']),
  detectAiProviders: vi.fn(() => [{ value: 'claude-cli', label: 'Claude CLI', hint: 'detected' }]),
  detectKnowledgeApps: vi.fn(() => ['vscode']),
}))

vi.mock('../../../../src/providers/registry.js', () => ({
  syncAll: vi.fn(async () => []),
}))

vi.mock('../../../../src/cli/ui.js', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  fail: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn(() => false), mkdirSync: vi.fn() }
})

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  text: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  note: vi.fn(),
  log: { warn: vi.fn(), success: vi.fn(), info: vi.fn() },
  isCancel: vi.fn(() => false),
}))

import * as clack from '@clack/prompts'
import { updateConfig } from '../../../../src/config/loader.js'
import { outro, fail } from '../../../../src/cli/ui.js'
import { existsSync } from 'node:fs'
import { registerInitCommand, runInitWizard } from '../../../../src/cli/commands/init.js'

function makeProgram() {
  const program = new Command()
  program.exitOverride()
  registerInitCommand(program)
  return program
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(clack.isCancel).mockReturnValue(false)
  vi.mocked(clack.select)
    .mockResolvedValueOnce('chrome')
    .mockResolvedValueOnce('claude-cli')
    .mockResolvedValueOnce('vscode')
  vi.mocked(clack.multiselect).mockResolvedValue(['claude-code'])
  vi.mocked(clack.text).mockResolvedValue('Atlas')
  vi.mocked(existsSync).mockReturnValue(false)
})

describe('atlas init', () => {
  it('registers as init command and completes', async () => {
    await makeProgram().parseAsync(['node', 'atlas', 'init'])
    expect(outro).toHaveBeenCalled()
  })

  it('calls updateConfig with selected browser and tools', async () => {
    vi.mocked(clack.select).mockReset()
    vi.mocked(clack.select)
      .mockResolvedValueOnce('arc')
      .mockResolvedValueOnce('claude-cli')
      .mockResolvedValueOnce('vscode')
    vi.mocked(clack.multiselect).mockResolvedValue(['cursor'])

    await runInitWizard()

    expect(updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ browser: 'arc', codingTools: ['cursor'] }),
    )
  })

  it('calls updateConfig with selected ai provider', async () => {
    vi.mocked(clack.select).mockReset()
    vi.mocked(clack.select)
      .mockResolvedValueOnce('chrome')
      .mockResolvedValueOnce('anthropic-sdk')
      .mockResolvedValueOnce('vscode')
    vi.mocked(clack.multiselect).mockResolvedValue([])

    await runInitWizard()

    expect(updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ aiProvider: 'anthropic-sdk' }),
    )
  })

  it('sets aiProvider to null when skip is selected', async () => {
    vi.mocked(clack.select).mockReset()
    vi.mocked(clack.select)
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('skip')
    vi.mocked(clack.multiselect).mockResolvedValue([])

    await runInitWizard()

    expect(updateConfig).toHaveBeenCalledWith(expect.objectContaining({ aiProvider: null }))
  })

  it('shows warning when no AI provider selected', async () => {
    vi.mocked(clack.select).mockReset()
    vi.mocked(clack.select)
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('skip')
    vi.mocked(clack.multiselect).mockResolvedValue([])

    await runInitWizard()

    expect(clack.log.warn).toHaveBeenCalledWith(expect.stringContaining('ANTHROPIC_API_KEY'))
  })

  it('calls outro on successful completion', async () => {
    await runInitWizard()
    expect(outro).toHaveBeenCalledWith(expect.stringContaining('Setup complete'))
  })

  it('calls fail when cancelled at browser step', async () => {
    vi.mocked(clack.isCancel).mockReturnValue(true)
    vi.mocked(clack.select).mockResolvedValue(Symbol.for('cancel'))

    await runInitWizard()

    expect(fail).toHaveBeenCalledWith('Setup cancelled.')
  })

  it('skips re-run prompt when config does not exist', async () => {
    await runInitWizard()
    expect(clack.confirm).not.toHaveBeenCalled()
  })

  it('exits early when user declines re-run', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(clack.confirm).mockResolvedValue(false)

    await runInitWizard()

    expect(outro).toHaveBeenCalledWith(expect.stringContaining('Keeping existing'))
  })
})
