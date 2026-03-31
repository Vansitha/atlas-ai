import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Override MANIFEST_PATH to use temp dir
const tempDir = join(tmpdir(), `atlas-test-${Date.now()}`)
vi.mock('../../../src/storage/paths.js', () => ({
  ATLAS_HOME: tempDir,
  MANIFEST_PATH: join(tempDir, '.index.json'),
  CONTENT_CACHE_PATH: join(tempDir, '.content-cache.json'),
  CONFIG_PATH: join(tempDir, 'config.json'),
  SKILLS_DIR: join(tempDir, 'skills'),
  KNOWLEDGE_DIR: join(tempDir, 'knowledge'),
  ACCURACY_LOG_PATH: join(tempDir, '.accuracy-log.jsonl'),
  DAEMON_PID_PATH: join(tempDir, '.daemon.pid'),
  DAEMON_HEARTBEAT_PATH: join(tempDir, '.daemon.heartbeat'),
  BROWSER_BOOKMARK_PATHS: {},
}))

const { addEntry, removeEntry, findByUrlHash, findBySlug, search, listEntries } =
  await import('../../../src/storage/manifest.js')

const sampleEntry = {
  slug: 'react-hooks-guide',
  title: 'React Hooks Guide',
  type: 'skill' as const,
  sourceUrl: 'https://example.com/react-hooks',
  urlHash: 'abc123',
  capturedAt: new Date().toISOString(),
  tags: ['react', 'hooks'],
  filePath: 'skills/react-hooks-guide/SKILL.md',
}

beforeEach(() => {
  mkdirSync(tempDir, { recursive: true })
})

afterEach(() => {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })
})

describe('manifest', () => {
  it('addEntry persists an entry', () => {
    addEntry(sampleEntry)
    const entries = listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.title).toBe('React Hooks Guide')
  })

  it('removeEntry deletes by slug', () => {
    addEntry(sampleEntry)
    removeEntry('react-hooks-guide')
    expect(listEntries()).toHaveLength(0)
  })

  it('findByUrlHash returns matching entry', () => {
    addEntry(sampleEntry)
    const found = findByUrlHash('abc123')
    expect(found?.slug).toBe('react-hooks-guide')
  })

  it('findByUrlHash returns undefined for unknown hash', () => {
    expect(findByUrlHash('unknown')).toBeUndefined()
  })

  it('findBySlug finds by exact slug', () => {
    addEntry(sampleEntry)
    expect(findBySlug('react-hooks-guide')?.title).toBe('React Hooks Guide')
  })

  it('search matches on title', () => {
    addEntry(sampleEntry)
    addEntry({
      ...sampleEntry,
      slug: 'other',
      title: 'Vue Guide',
      urlHash: 'xyz',
      sourceUrl: 'https://example.com/vue',
      tags: ['vue'],
      filePath: 'skills/other/SKILL.md',
    })
    expect(search('react')).toHaveLength(1)
    expect(search('guide')).toHaveLength(2)
  })

  it('search matches on tags', () => {
    addEntry(sampleEntry)
    expect(search('hooks')).toHaveLength(1)
  })

  it('listEntries filters by type', () => {
    addEntry(sampleEntry)
    addEntry({
      ...sampleEntry,
      slug: 'event-loop',
      title: 'Event Loop',
      type: 'knowledge',
      urlHash: 'def456',
      sourceUrl: 'https://example.com/event-loop',
      filePath: 'knowledge/event-loop.md',
    })
    expect(listEntries('skill')).toHaveLength(1)
    expect(listEntries('knowledge')).toHaveLength(1)
    expect(listEntries()).toHaveLength(2)
  })
})
