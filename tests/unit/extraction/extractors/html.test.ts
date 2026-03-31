import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { htmlExtractor } from '../../../../src/extraction/extractors/html.js'

const fixtureHtml = readFileSync(join(process.cwd(), 'tests/fixtures/html/article.html'), 'utf-8')

function mockFetch(html: string, status = 200, contentType = 'text/html') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => contentType },
      text: () => Promise.resolve(html),
    }),
  )
}

beforeEach(() => vi.restoreAllMocks())

describe('htmlExtractor', () => {
  it('canHandle returns true for any URL', () => {
    expect(htmlExtractor.canHandle(new URL('https://example.com'))).toBe(true)
    expect(htmlExtractor.canHandle(new URL('https://twitter.com/user/status/123'))).toBe(true)
  })

  it('has priority 0', () => {
    expect(htmlExtractor.priority).toBe(0)
  })

  it('extracts title and body from HTML', async () => {
    mockFetch(fixtureHtml)
    const result = await htmlExtractor.extract(new URL('https://example.com/article'))
    expect(result.title).toBe('React Hooks: A Complete Guide')
    expect(result.body).toContain('useState')
    expect(result.extractorName).toBe('html')
  })

  it('strips nav and footer noise', async () => {
    mockFetch(fixtureHtml)
    const result = await htmlExtractor.extract(new URL('https://example.com/article'))
    expect(result.body).not.toContain('Navigation junk')
    expect(result.body).not.toContain('Footer junk')
  })

  it('strips script tags', async () => {
    mockFetch(fixtureHtml)
    const result = await htmlExtractor.extract(new URL('https://example.com/article'))
    expect(result.body).not.toContain('console.log')
  })

  it('extracts author from meta tag', async () => {
    mockFetch(fixtureHtml)
    const result = await htmlExtractor.extract(new URL('https://example.com/article'))
    expect(result.metadata['author']).toBe('Jane Doe')
  })

  it('throws on non-200 response', async () => {
    mockFetch('', 404)
    await expect(htmlExtractor.extract(new URL('https://example.com'))).rejects.toThrow('404')
  })

  it('throws on non-HTML content type', async () => {
    mockFetch('{}', 200, 'application/json')
    await expect(htmlExtractor.extract(new URL('https://example.com'))).rejects.toThrow(
      'content type',
    )
  })

  it('returns fallback content when extracted body is too short', async () => {
    mockFetch('<html><body><p>Hi</p></body></html>')
    const result = await htmlExtractor.extract(new URL('https://example.com'))
    expect(result.body).toContain('example.com')
    expect(result.extractorName).toBe('html')
  })
})
