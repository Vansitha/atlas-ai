import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { llmsTxtExtractor } from '../../../../src/extraction/extractors/llms-txt.js'

function mockFetch(status: number, body: string, contentType = 'text/plain') {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
    text: async () => body,
  })
}

const longBody = '# My Library\n\n' + 'A '.repeat(100)

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch(200, longBody))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('llmsTxtExtractor', () => {
  it('canHandle returns true for any URL', () => {
    expect(llmsTxtExtractor.canHandle(new URL('https://example.com/docs'))).toBe(true)
  })

  it('extracts title from # heading', async () => {
    const content = await llmsTxtExtractor.extract(new URL('https://example.com'))
    expect(content.title).toBe('My Library')
  })

  it('uses hostname as title when no heading', async () => {
    vi.stubGlobal('fetch', mockFetch(200, 'No heading here ' + 'x'.repeat(60)))
    const content = await llmsTxtExtractor.extract(new URL('https://example.com'))
    expect(content.title).toBe('example.com')
  })

  it('sets extractorName to llms-txt', async () => {
    const content = await llmsTxtExtractor.extract(new URL('https://example.com'))
    expect(content.extractorName).toBe('llms-txt')
  })

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', mockFetch(404, 'Not Found'))
    await expect(llmsTxtExtractor.extract(new URL('https://example.com'))).rejects.toThrow()
  })

  it('throws when content-type is not text', async () => {
    vi.stubGlobal('fetch', mockFetch(200, longBody, 'application/json'))
    await expect(llmsTxtExtractor.extract(new URL('https://example.com'))).rejects.toThrow()
  })

  it('throws when content is too short', async () => {
    vi.stubGlobal('fetch', mockFetch(200, 'Short'))
    await expect(llmsTxtExtractor.extract(new URL('https://example.com'))).rejects.toThrow()
  })

  it('includes metadata with llms.txt URL', async () => {
    const content = await llmsTxtExtractor.extract(new URL('https://example.com'))
    expect(content.metadata.source).toBe('https://example.com/llms.txt')
  })
})
