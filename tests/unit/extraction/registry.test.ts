import { describe, it, expect, vi } from 'vitest'
import { ExtractorRegistry } from '../../../src/extraction/registry.js'
import type { ContentExtractor } from '../../../src/types/index.js'

function makeExtractor(name: string, priority: number, handles: boolean): ContentExtractor {
  return {
    name,
    priority,
    canHandle: () => handles,
    extract: vi.fn().mockResolvedValue({
      url: 'https://example.com',
      title: `From ${name}`,
      body: 'body content here that is long enough',
      metadata: {},
      extractedAt: new Date().toISOString(),
      extractorName: name,
    }),
  }
}

describe('ExtractorRegistry', () => {
  it('runs the highest priority extractor that can handle the URL', async () => {
    const registry = new ExtractorRegistry()
    const low = makeExtractor('low', 0, true)
    const high = makeExtractor('high', 100, true)
    registry.register(low)
    registry.register(high)

    const result = await registry.extract(new URL('https://example.com'))
    expect(result.extractorName).toBe('high')
    expect(high.extract).toHaveBeenCalled()
    expect(low.extract).not.toHaveBeenCalled()
  })

  it('falls back to lower priority when higher priority fails', async () => {
    const registry = new ExtractorRegistry()
    const fallback = makeExtractor('fallback', 0, true)
    const failing = {
      ...makeExtractor('failing', 100, true),
      extract: vi.fn().mockRejectedValue(new Error('Failed')),
    }
    registry.register(fallback)
    registry.register(failing)

    const result = await registry.extract(new URL('https://example.com'))
    expect(result.extractorName).toBe('fallback')
  })

  it('skips extractors that cannot handle the URL', async () => {
    const registry = new ExtractorRegistry()
    const cannotHandle = makeExtractor('skip', 100, false)
    const canHandle = makeExtractor('handle', 0, true)
    registry.register(cannotHandle)
    registry.register(canHandle)

    const result = await registry.extract(new URL('https://example.com'))
    expect(result.extractorName).toBe('handle')
    expect(cannotHandle.extract).not.toHaveBeenCalled()
  })

  it('throws ExtractionError when all extractors fail', async () => {
    const registry = new ExtractorRegistry()
    const failing = {
      ...makeExtractor('failing', 0, true),
      extract: vi.fn().mockRejectedValue(new Error('All failed')),
    }
    registry.register(failing)

    await expect(registry.extract(new URL('https://example.com'))).rejects.toThrow(
      'All extractors failed',
    )
  })

  it('throws when no extractors are registered', async () => {
    const registry = new ExtractorRegistry()
    await expect(registry.extract(new URL('https://example.com'))).rejects.toThrow()
  })

  it('returns registered extractors sorted by priority descending', () => {
    const registry = new ExtractorRegistry()
    registry.register(makeExtractor('a', 10, true))
    registry.register(makeExtractor('b', 100, true))
    registry.register(makeExtractor('c', 50, true))

    const registered = registry.getRegistered()
    expect(registered[0]?.name).toBe('b')
    expect(registered[1]?.name).toBe('c')
    expect(registered[2]?.name).toBe('a')
  })
})
