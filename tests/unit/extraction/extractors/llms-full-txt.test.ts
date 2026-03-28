import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { llmsFullTxtExtractor } from '../../../../src/extraction/extractors/llms-full-txt.js'

function mockFetch(status: number, body: string, contentType = 'text/plain') {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
    text: async () => body,
  })
}

const longBody = '# Full Library Docs\n\n' + 'B '.repeat(100)

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch(200, longBody))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('llmsFullTxtExtractor', () => {
  it('canHandle returns true for any URL', () => {
    expect(llmsFullTxtExtractor.canHandle(new URL('https://example.com/docs'))).toBe(true)
  })

  it('has higher priority than llms-txt', () => {
    expect(llmsFullTxtExtractor.priority).toBe(50)
  })

  it('extracts title from # heading', async () => {
    const content = await llmsFullTxtExtractor.extract(new URL('https://example.com'))
    expect(content.title).toBe('Full Library Docs')
  })

  it('uses hostname when no heading found', async () => {
    vi.stubGlobal('fetch', mockFetch(200, 'No heading ' + 'y'.repeat(60)))
    const content = await llmsFullTxtExtractor.extract(new URL('https://docs.example.com'))
    expect(content.title).toBe('docs.example.com')
  })

  it('sets extractorName to llms-full-txt', async () => {
    const content = await llmsFullTxtExtractor.extract(new URL('https://example.com'))
    expect(content.extractorName).toBe('llms-full-txt')
  })

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', mockFetch(404, 'Not Found'))
    await expect(llmsFullTxtExtractor.extract(new URL('https://example.com'))).rejects.toThrow()
  })

  it('throws when content-type is not text', async () => {
    vi.stubGlobal('fetch', mockFetch(200, longBody, 'application/octet-stream'))
    await expect(llmsFullTxtExtractor.extract(new URL('https://example.com'))).rejects.toThrow()
  })

  it('throws when content too short', async () => {
    vi.stubGlobal('fetch', mockFetch(200, 'tiny'))
    await expect(llmsFullTxtExtractor.extract(new URL('https://example.com'))).rejects.toThrow()
  })

  it('fetches from /llms-full.txt path', async () => {
    const content = await llmsFullTxtExtractor.extract(new URL('https://example.com'))
    expect(content.metadata.source).toBe('https://example.com/llms-full.txt')
  })
})
