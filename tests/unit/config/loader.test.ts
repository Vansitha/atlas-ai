import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const tempDir = join(tmpdir(), `atlas-config-test-${Date.now()}`)

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

const { loadConfig, saveConfig, updateConfig } = await import('../../../src/config/loader.js')

beforeEach(() => {
  mkdirSync(tempDir, { recursive: true })
})

afterEach(() => {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })
})

describe('loadConfig', () => {
  it('returns default config when no file exists', () => {
    const config = loadConfig()
    expect(config.version).toBe(1)
    expect(config.codingTools).toEqual([])
    expect(config.browser).toBeNull()
  })
})

describe('saveConfig + loadConfig', () => {
  it('persists and reloads config', () => {
    const config = loadConfig()
    saveConfig({ ...config, codingTools: ['claude-code'] })
    const reloaded = loadConfig()
    expect(reloaded.codingTools).toEqual(['claude-code'])
  })
})

describe('updateConfig', () => {
  it('merges partial config', () => {
    const updated = updateConfig({ browser: 'chrome' })
    expect(updated.browser).toBe('chrome')
  })

  it('persists the update', () => {
    updateConfig({ browser: 'arc' })
    const loaded = loadConfig()
    expect(loaded.browser).toBe('arc')
  })
})
