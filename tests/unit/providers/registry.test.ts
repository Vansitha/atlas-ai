import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/config/loader.js', () => ({
  loadConfig: vi.fn(() => ({
    version: 1,
    browser: null,
    codingTools: ['claude-code'],
    aiProvider: null,
    daemon: { enabled: false, bookmarkFolder: 'Atlas', debounceMs: 2000 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
}))

vi.mock('../../../src/storage/manifest.js', () => ({
  listEntries: vi.fn(() => []),
}))

vi.mock('../../../src/providers/strategies/claude-code.js', () => ({
  claudeCodeProvider: {
    name: 'claude-code',
    detected: vi.fn(() => true),
    sync: vi.fn(async () => ({ provider: 'claude-code', entriesSynced: 0, errors: [] })),
    verify: vi.fn(async () => ({
      provider: 'claude-code',
      configured: true,
      healthy: true,
      details: 'ok',
    })),
    cleanup: vi.fn(async () => {}),
  },
}))

vi.mock('../../../src/providers/strategies/cursor.js', () => ({
  cursorProvider: {
    name: 'cursor',
    detected: vi.fn(() => false),
    sync: vi.fn(async () => ({ provider: 'cursor', entriesSynced: 0, errors: [] })),
    verify: vi.fn(async () => ({
      provider: 'cursor',
      configured: false,
      healthy: false,
      details: 'not found',
    })),
    cleanup: vi.fn(async () => {}),
  },
}))

vi.mock('../../../src/providers/strategies/copilot.js', () => ({
  copilotProvider: {
    name: 'copilot',
    detected: vi.fn(() => false),
    sync: vi.fn(async () => ({ provider: 'copilot', entriesSynced: 0, errors: [] })),
    verify: vi.fn(async () => ({
      provider: 'copilot',
      configured: false,
      healthy: false,
      details: 'not found',
    })),
    cleanup: vi.fn(async () => {}),
  },
}))

vi.mock('../../../src/providers/strategies/windsurf.js', () => ({
  windsurfProvider: {
    name: 'windsurf',
    detected: vi.fn(() => false),
    sync: vi.fn(async () => ({ provider: 'windsurf', entriesSynced: 0, errors: [] })),
    verify: vi.fn(async () => ({
      provider: 'windsurf',
      configured: false,
      healthy: false,
      details: 'not found',
    })),
    cleanup: vi.fn(async () => {}),
  },
}))

vi.mock('../../../src/providers/strategies/opencode.js', () => ({
  opencodeProvider: {
    name: 'opencode',
    detected: vi.fn(() => false),
    sync: vi.fn(async () => ({ provider: 'opencode', entriesSynced: 0, errors: [] })),
    verify: vi.fn(async () => ({
      provider: 'opencode',
      configured: false,
      healthy: false,
      details: 'not found',
    })),
    cleanup: vi.fn(async () => {}),
  },
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import {
  getAllProviders,
  detectProviders,
  getProvider,
  syncAll,
  verifyAll,
} from '../../../src/providers/registry.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAllProviders', () => {
  it('returns all 5 providers', () => {
    expect(getAllProviders()).toHaveLength(5)
  })
})

describe('detectProviders', () => {
  it('returns only providers where detected() is true', () => {
    const detected = detectProviders()
    expect(detected.map((p) => p.name)).toEqual(['claude-code'])
  })
})

describe('getProvider', () => {
  it('finds provider by name', () => {
    const p = getProvider('claude-code')
    expect(p?.name).toBe('claude-code')
  })

  it('returns undefined for unknown name', () => {
    expect(getProvider('unknown' as never)).toBeUndefined()
  })
})

describe('syncAll', () => {
  it('calls sync on configured providers', async () => {
    const results = await syncAll()
    expect(results).toHaveLength(1)
    expect(results[0].provider).toBe('claude-code')
  })
})

describe('verifyAll', () => {
  it('calls verify on configured providers', async () => {
    const statuses = await verifyAll()
    expect(statuses).toHaveLength(1)
    expect(statuses[0].provider).toBe('claude-code')
  })
})
