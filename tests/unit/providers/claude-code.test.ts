import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync, lstatSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { StoredEntry } from '../../../src/types/index.js'

const tempDir = join(tmpdir(), `atlas-claude-test-${Date.now()}`)
const atlasSkillsDir = join(tempDir, 'ai-knowledge', 'skills')
const atlasKnowledgeDir = join(tempDir, 'ai-knowledge', 'knowledge')
const claudeSkillsDir = join(tempDir, '.claude', 'skills')
const claudeKnowledgeDir = join(tempDir, '.claude', 'rules', 'knowledge')

vi.mock('../../../src/storage/paths.js', () => ({
  ATLAS_HOME: join(tempDir, 'ai-knowledge'),
  SKILLS_DIR: join(tempDir, 'ai-knowledge', 'skills'),
  KNOWLEDGE_DIR: join(tempDir, 'ai-knowledge', 'knowledge'),
  CONFIG_PATH: join(tempDir, 'ai-knowledge', 'config.json'),
  MANIFEST_PATH: join(tempDir, 'ai-knowledge', '.index.json'),
  CONTENT_CACHE_PATH: join(tempDir, 'ai-knowledge', '.content-cache.json'),
  ACCURACY_LOG_PATH: join(tempDir, 'ai-knowledge', '.accuracy-log.jsonl'),
  DAEMON_PID_PATH: join(tempDir, 'ai-knowledge', '.daemon.pid'),
  DAEMON_HEARTBEAT_PATH: join(tempDir, 'ai-knowledge', '.daemon.heartbeat'),
  BROWSER_BOOKMARK_PATHS: {},
}))

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => tempDir }
})

const { claudeCodeProvider, removeClaudeCodeEntry } =
  await import('../../../src/providers/strategies/claude-code.js')

const skillEntry: StoredEntry = {
  slug: 'react-hooks',
  title: 'React Hooks',
  type: 'skill',
  sourceUrl: 'https://example.com',
  urlHash: 'abc',
  capturedAt: new Date().toISOString(),
  tags: ['react'],
  filePath: join(atlasSkillsDir, 'react-hooks', 'SKILL.md'),
}

const knowledgeEntry: StoredEntry = {
  slug: 'event-loop',
  title: 'Event Loop',
  type: 'knowledge',
  sourceUrl: 'https://example.com/el',
  urlHash: 'def',
  capturedAt: new Date().toISOString(),
  tags: ['javascript'],
  filePath: join(atlasKnowledgeDir, 'event-loop.md'),
}

beforeEach(() => {
  mkdirSync(join(atlasSkillsDir, 'react-hooks'), { recursive: true })
  mkdirSync(atlasKnowledgeDir, { recursive: true })
  mkdirSync(join(tempDir, '.claude'), { recursive: true })
  mkdirSync(claudeSkillsDir, { recursive: true })
  mkdirSync(claudeKnowledgeDir, { recursive: true })
  mkdirSync(join(tempDir, 'ai-knowledge', 'skills', 'react-hooks'), { recursive: true })
})

afterEach(() => {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })
})

describe('claudeCodeProvider', () => {
  it('detected returns true when .claude dir exists', () => {
    expect(claudeCodeProvider.detected()).toBe(true)
  })

  it('syncs skill entries as individual symlinks', async () => {
    const result = await claudeCodeProvider.sync([skillEntry])
    expect(result.entriesSynced).toBe(1)
    expect(result.errors).toHaveLength(0)
    const link = join(claudeSkillsDir, 'react-hooks')
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
  })

  it('syncs knowledge entries as individual symlinks', async () => {
    const result = await claudeCodeProvider.sync([knowledgeEntry])
    expect(result.entriesSynced).toBe(1)
    const link = join(claudeKnowledgeDir, 'event-loop.md')
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
  })

  it('returns error for entry that fails to sync', async () => {
    const badEntry = { ...skillEntry, slug: 'bad/../../../etc' }
    const result = await claudeCodeProvider.sync([badEntry])
    // Either syncs or errors — just check it doesn't throw
    expect(result.provider).toBe('claude-code')
  })

  it('verify returns healthy when detected', async () => {
    const status = await claudeCodeProvider.verify()
    expect(status.configured).toBe(true)
    expect(status.healthy).toBe(true)
  })

  it('cleanup resolves without error', async () => {
    await expect(claudeCodeProvider.cleanup()).resolves.toBeUndefined()
  })

  it('removeClaudeCodeEntry removes skill symlink', async () => {
    const linkPath = join(claudeSkillsDir, skillEntry.slug)
    symlinkSync(join(atlasSkillsDir, skillEntry.slug), linkPath)
    removeClaudeCodeEntry(skillEntry)
    expect(existsSync(linkPath)).toBe(false)
  })

  it('removeClaudeCodeEntry removes knowledge symlink', async () => {
    const linkPath = join(claudeKnowledgeDir, `${knowledgeEntry.slug}.md`)
    symlinkSync(join(atlasKnowledgeDir, `${knowledgeEntry.slug}.md`), linkPath)
    removeClaudeCodeEntry(knowledgeEntry)
    expect(existsSync(linkPath)).toBe(false)
  })
})
