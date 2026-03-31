import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { redditExtractor } from '../../../../src/extraction/extractors/reddit.js'

const redditFixture = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/api-responses/reddit.json'), 'utf-8'),
)

function mockFetch(data: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    }),
  )
}

beforeEach(() => vi.restoreAllMocks())

describe('redditExtractor', () => {
  it('canHandle returns true for reddit.com', () => {
    expect(
      redditExtractor.canHandle(new URL('https://www.reddit.com/r/node/comments/abc/title')),
    ).toBe(true)
  })

  it('canHandle returns true for old.reddit.com', () => {
    expect(redditExtractor.canHandle(new URL('https://old.reddit.com/r/node/comments/abc'))).toBe(
      true,
    )
  })

  it('canHandle returns false for other URLs', () => {
    expect(redditExtractor.canHandle(new URL('https://example.com'))).toBe(false)
  })

  it('has priority 100', () => {
    expect(redditExtractor.priority).toBe(100)
  })

  it('extracts post title, body and top comments', async () => {
    mockFetch(redditFixture)
    const result = await redditExtractor.extract(
      new URL('https://www.reddit.com/r/node/comments/abc123/how_i_optimized'),
    )
    expect(result.title).toBe('How I optimized my Node.js API from 200ms to 20ms response time')
    expect(result.body).toContain('Redis caching')
    expect(result.body).toContain('Top Comments')
    expect(result.metadata['subreddit']).toBe('node')
    expect(result.extractorName).toBe('reddit')
  })

  it('throws for non-post Reddit URLs', async () => {
    await expect(
      redditExtractor.extract(new URL('https://www.reddit.com/r/node')),
    ).rejects.toThrow()
  })

  it('throws on API error', async () => {
    mockFetch(null, 429)
    await expect(
      redditExtractor.extract(new URL('https://www.reddit.com/r/node/comments/abc/title')),
    ).rejects.toThrow('429')
  })
})
