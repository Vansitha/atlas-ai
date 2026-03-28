import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const tempDir = join(tmpdir(), `atlas-tracker-test-${Date.now()}`)

vi.mock('../../../src/storage/paths.js', () => ({
  ATLAS_HOME: tempDir,
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

const { logOverride, getAccuracyStats } = await import('../../../src/accuracy/tracker.js')

beforeEach(() => {
  mkdirSync(tempDir, { recursive: true })
})

afterEach(() => {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })
})

describe('getAccuracyStats', () => {
  it('returns zeros when no log file', () => {
    const stats = getAccuracyStats()
    expect(stats.total).toBe(0)
    expect(stats.correct).toBe(0)
    expect(stats.accuracy).toBe(0)
  })
})

describe('logOverride + getAccuracyStats', () => {
  it('logs an entry and increments total', () => {
    logOverride('https://example.com', 'skill', 'knowledge')
    const stats = getAccuracyStats()
    expect(stats.total).toBe(1)
  })

  it('counts correct when ai matches user', () => {
    logOverride('https://example.com', 'skill', 'skill')
    const stats = getAccuracyStats()
    expect(stats.correct).toBe(1)
    expect(stats.accuracy).toBe(1)
  })

  it('counts incorrect when ai differs from user', () => {
    logOverride('https://example.com', 'skill', 'knowledge')
    const stats = getAccuracyStats()
    expect(stats.correct).toBe(0)
    expect(stats.accuracy).toBe(0)
  })

  it('accumulates multiple entries', () => {
    logOverride('https://a.com', 'skill', 'skill')
    logOverride('https://b.com', 'knowledge', 'skill')
    logOverride('https://c.com', 'skill', 'skill')
    const stats = getAccuracyStats()
    expect(stats.total).toBe(3)
    expect(stats.correct).toBe(2)
    expect(stats.accuracy).toBeCloseTo(2 / 3)
  })
})
