import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { twitterExtractor } from '../../../../src/extraction/extractors/twitter.js'

const twitterFixture = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/api-responses/twitter.json'), 'utf-8'),
)

function mockFetch(data: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  }))
}

beforeEach(() => vi.restoreAllMocks())

describe('twitterExtractor', () => {
  it('canHandle returns true for twitter.com URLs', () => {
    expect(twitterExtractor.canHandle(new URL('https://twitter.com/user/status/123'))).toBe(true)
  })

  it('canHandle returns true for x.com URLs', () => {
    expect(twitterExtractor.canHandle(new URL('https://x.com/user/status/123'))).toBe(true)
  })

  it('canHandle returns false for other URLs', () => {
    expect(twitterExtractor.canHandle(new URL('https://example.com'))).toBe(false)
  })

  it('has priority 100', () => {
    expect(twitterExtractor.priority).toBe(100)
  })

  it('extracts tweet content and author', async () => {
    mockFetch(twitterFixture)
    const result = await twitterExtractor.extract(
      new URL('https://twitter.com/dan_abramov/status/1234567890'),
    )
    expect(result.title).toContain('Dan Abramov')
    expect(result.body).toContain('React Server Components')
    expect(result.metadata['author']).toBe('@dan_abramov')
    expect(result.extractorName).toBe('twitter')
  })

  it('stitches thread tweets together', async () => {
    mockFetch(twitterFixture)
    const result = await twitterExtractor.extract(
      new URL('https://twitter.com/dan_abramov/status/1234567890'),
    )
    expect(result.body).toContain('Thread by @dan_abramov')
    expect(result.body).toContain('1.')
    expect(result.body).toContain('2.')
    expect(result.body).toContain('3.')
    expect(result.metadata['tweetCount']).toBe('3')
  })

  it('throws on API error response', async () => {
    mockFetch({ code: 404, message: 'Tweet not found' })
    await expect(
      twitterExtractor.extract(new URL('https://twitter.com/user/status/999')),
    ).rejects.toThrow()
  })

  it('throws when tweet ID cannot be parsed', async () => {
    await expect(
      twitterExtractor.extract(new URL('https://twitter.com/user')),
    ).rejects.toThrow('tweet ID')
  })
})
