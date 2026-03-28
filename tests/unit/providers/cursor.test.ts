import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync, lstatSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { StoredEntry } from '../../../src/types/index.js'

const tempDir = join(tmpdir(), `atlas-cursor-test-${Date.now()}`)
const atlasSkillsDir = join(tempDir, 'ai-knowledge', 'skills')
const atlasKnowledgeDir = join(tempDir, 'ai-knowledge', 'knowledge')
const cursorSkillsDir = join(tempDir, '.cursor', 'rules', 'atlas', 'skills')
const cursorKnowledgeDir = join(tempDir, '.cursor', 'rules', 'atlas', 'knowledge')

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

const { cursorProvider } = await import('../../../src/providers/strategies/cursor.js')

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
  mkdirSync(join(tempDir, '.cursor'), { recursive: true })
  mkdirSync(cursorSkillsDir, { recursive: true })
  mkdirSync(cursorKnowledgeDir, { recursive: true })
})

afterEach(() => {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })
})

describe('cursorProvider', () => {
  it('detected returns true when .cursor dir exists', () => {
    expect(cursorProvider.detected()).toBe(true)
  })

  it('syncs skill entries as symlinks', async () => {
    const result = await cursorProvider.sync([skillEntry])
    expect(result.entriesSynced).toBe(1)
    expect(result.errors).toHaveLength(0)
    const link = join(cursorSkillsDir, 'react-hooks')
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
  })

  it('syncs knowledge entries as symlinks', async () => {
    const result = await cursorProvider.sync([knowledgeEntry])
    expect(result.entriesSynced).toBe(1)
    const link = join(cursorKnowledgeDir, 'event-loop.md')
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
  })

  it('returns provider name cursor', async () => {
    const result = await cursorProvider.sync([])
    expect(result.provider).toBe('cursor')
  })
})
