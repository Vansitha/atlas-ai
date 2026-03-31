import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../src/storage/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/storage/paths.js')>()
  return {
    ...actual,
    ATLAS_HOME: '/tmp/atlas-test',
    SKILLS_DIR: '/tmp/atlas-test/skills',
    KNOWLEDGE_DIR: '/tmp/atlas-test/knowledge',
    CONFIG_PATH: '/tmp/atlas-test/config.json',
    MANIFEST_PATH: '/tmp/atlas-test/.index.json',
    CONTENT_CACHE_PATH: '/tmp/atlas-test/.content-cache.json',
    ACCURACY_LOG_PATH: '/tmp/atlas-test/.accuracy-log.jsonl',
    DAEMON_PID_PATH: '/tmp/atlas-test/.daemon.pid',
    DAEMON_HEARTBEAT_PATH: '/tmp/atlas-test/.daemon.heartbeat',
  }
})

vi.mock('../../../src/providers/registry.js', () => ({
  getAllProviders: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn() }
})

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { getAllProviders } from '../../../src/providers/registry.js'
import { detectBrowsers, detectCodingTools, detectAiProviders } from '../../../src/cli/detect.js'

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ANTHROPIC_API_KEY
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
})

describe('detectBrowsers', () => {
  it('returns browsers whose bookmark files exist', () => {
    vi.mocked(existsSync).mockImplementation(
      (p) => String(p).includes('Chrome') || String(p).includes('Arc'),
    )
    const result = detectBrowsers()
    expect(result).toContain('chrome')
    expect(result).toContain('arc')
    expect(result).not.toContain('brave')
    expect(result).not.toContain('edge')
  })

  it('returns empty array when no browser files found', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(detectBrowsers()).toEqual([])
  })

  it('returns all browsers when all files exist', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const result = detectBrowsers()
    expect(result).toHaveLength(4)
  })
})

describe('detectCodingTools', () => {
  it('returns tools where detected() is true', () => {
    vi.mocked(getAllProviders).mockReturnValue([
      { name: 'claude-code', detected: () => true } as never,
      { name: 'cursor', detected: () => false } as never,
      { name: 'windsurf', detected: () => true } as never,
    ])
    const result = detectCodingTools()
    expect(result).toEqual(['claude-code', 'windsurf'])
  })

  it('returns empty array when no tools detected', () => {
    vi.mocked(getAllProviders).mockReturnValue([
      { name: 'claude-code', detected: () => false } as never,
    ])
    expect(detectCodingTools()).toEqual([])
  })
})

describe('detectAiProviders', () => {
  it('detects claude-cli when which claude succeeds', () => {
    vi.mocked(execSync).mockImplementation((cmd) => {
      if (String(cmd).includes('claude')) return Buffer.from('/usr/bin/claude')
      throw new Error('not found')
    })
    const result = detectAiProviders()
    expect(result.map((r) => r.value)).toContain('claude-cli')
  })

  it('detects opencode-cli when which opencode succeeds', () => {
    vi.mocked(execSync).mockImplementation((cmd) => {
      if (String(cmd).includes('opencode')) return Buffer.from('/usr/bin/opencode')
      throw new Error('not found')
    })
    const result = detectAiProviders()
    expect(result.map((r) => r.value)).toContain('opencode-cli')
  })

  it('detects anthropic-sdk when ANTHROPIC_API_KEY is set', () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found')
    })
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    const result = detectAiProviders()
    expect(result.map((r) => r.value)).toContain('anthropic-sdk')
  })

  it('always includes anthropic-sdk even when nothing else is available', () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found')
    })
    const result = detectAiProviders()
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe('anthropic-sdk')
    expect(result[0].hint).toBe('requires ANTHROPIC_API_KEY')
  })

  it('returns detected hint for found providers', () => {
    vi.mocked(execSync).mockImplementation((cmd) => {
      if (String(cmd).includes('claude')) return Buffer.from('/usr/bin/claude')
      throw new Error()
    })
    const result = detectAiProviders()
    expect(result[0].hint).toBe('detected')
  })
})
