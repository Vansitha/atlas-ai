import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const tempDir = join(tmpdir(), `atlas-cache-test-${Date.now()}`)

vi.mock('../../../src/storage/paths.js', () => ({
  ATLAS_HOME: join(tempDir),
  SKILLS_DIR: join(tempDir, 'skills'),
  KNOWLEDGE_DIR: join(tempDir, 'knowledge'),
  CONFIG_PATH: join(tempDir, 'config.json'),
  MANIFEST_PATH: join(tempDir, '.index.json'),
  CONTENT_CACHE_PATH: join(tempDir, '.content-cache.json'),
  ACCURACY_LOG_PATH: join(tempDir, '.accuracy-log.jsonl'),
  DAEMON_PID_PATH: join(tempDir, '.daemon.pid'),
  DAEMON_HEARTBEAT_PATH: join(tempDir, '.daemon.heartbeat'),
  BROWSER_BOOKMARK_PATHS: {},
}))

const { isCached, updateCache } = await import('../../../src/storage/content-cache.js')

beforeEach(() => {
  mkdirSync(tempDir, { recursive: true })
})

afterEach(() => {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })
})

describe('isCached', () => {
  it('returns false when cache file does not exist', () => {
    expect(isCached('abc123')).toBe(false)
  })

  it('returns false when hash not in cache', () => {
    updateCache('other-hash', 'html')
    expect(isCached('abc123')).toBe(false)
  })

  it('returns true for a freshly cached entry', () => {
    updateCache('abc123', 'html')
    expect(isCached('abc123')).toBe(true)
  })
})

describe('updateCache', () => {
  it('stores a new cache entry', () => {
    updateCache('hash1', 'twitter')
    expect(isCached('hash1')).toBe(true)
  })

  it('overwrites an existing entry', () => {
    updateCache('hash1', 'html')
    updateCache('hash1', 'reddit')
    expect(isCached('hash1')).toBe(true)
  })

  it('stores multiple entries independently', () => {
    updateCache('hash-a', 'html')
    updateCache('hash-b', 'twitter')
    expect(isCached('hash-a')).toBe(true)
    expect(isCached('hash-b')).toBe(true)
  })
})
