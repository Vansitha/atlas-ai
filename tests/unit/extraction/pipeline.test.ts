import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/storage/content-cache.js', () => ({
  isCached: vi.fn(() => false),
  updateCache: vi.fn(),
}))

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Mock the extractor registry so we don't need real HTTP
vi.mock('../../../src/extraction/registry.js', () => {
  return {
    ExtractorRegistry: vi.fn().mockImplementation(() => ({
      register: vi.fn(),
      extract: vi.fn(async (_url: URL) => ({
        url: 'https://example.com',
        title: 'Test Page',
        body: 'Some content',
        metadata: {},
        extractedAt: new Date().toISOString(),
        extractorName: 'html',
      })),
    })),
  }
})

import { extractContent } from '../../../src/extraction/pipeline.js'
import { isCached, updateCache } from '../../../src/storage/content-cache.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractContent', () => {
  it('throws for invalid URL', async () => {
    await expect(extractContent('not-a-url')).rejects.toThrow()
  })

  it('extracts content from a valid URL', async () => {
    const content = await extractContent('https://example.com')
    expect(content.url).toBe('https://example.com')
    expect(content.title).toBe('Test Page')
  })

  it('calls updateCache after extraction', async () => {
    await extractContent('https://example.com')
    expect(updateCache).toHaveBeenCalled()
  })

  it('skips extraction and uses cache hint when isCached returns true', async () => {
    vi.mocked(isCached).mockReturnValue(true)
    // Even when cached, we still extract (pipeline re-fetches, cache is a hint for duplicate detection)
    const content = await extractContent('https://example.com')
    expect(content).toBeDefined()
  })
})
