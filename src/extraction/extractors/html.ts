import * as cheerio from 'cheerio'
import type { ContentExtractor, ExtractedContent } from '../../types/index.js'
import { ExtractionError } from '../../utils/errors.js'

const MAX_BODY_LENGTH = 50_000
const FETCH_TIMEOUT_MS = 15_000

export const htmlExtractor: ContentExtractor = {
  name: 'html',
  priority: 0,

  canHandle(_url: URL): boolean {
    return true
  },

  async extract(url: URL): Promise<ExtractedContent> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let html: string
    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; Atlas/1.0; +https://github.com/Vansitha/atlas)',
        },
      })

      if (!response.ok) {
        throw new ExtractionError(
          `HTTP ${response.status} for ${url.toString()}`,
          url.toString(),
          'html',
        )
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/html')) {
        throw new ExtractionError(
          `Unsupported content type: ${contentType}`,
          url.toString(),
          'html',
        )
      }

      html = await response.text()
    } finally {
      clearTimeout(timeout)
    }

    const $ = cheerio.load(html)

    // Remove noise elements
    $('script, style, nav, footer, header, aside, .sidebar, .ad, .advertisement').remove()
    $('[role="navigation"], [role="banner"], [role="complementary"]').remove()
    $('iframe, noscript, .cookie-banner, .popup').remove()

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim() ||
      $('h1').first().text().trim() ||
      url.hostname

    const author =
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      null

    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      null

    // Extract main content in priority order
    const contentEl =
      $('article').first() ||
      $('main').first() ||
      $('[role="main"]').first() ||
      $('.content, #content, .post, #post').first() ||
      $('body')

    const body = contentEl
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_BODY_LENGTH)

    if (body.length < 50) {
      throw new ExtractionError(
        `Extracted content too short (${body.length} chars) — page may require JavaScript`,
        url.toString(),
        'html',
      )
    }

    const metadata: Record<string, string> = {}
    if (author) metadata['author'] = author
    if (description) metadata['description'] = description

    return {
      url: url.toString(),
      title: title.slice(0, 200),
      body,
      metadata,
      extractedAt: new Date().toISOString(),
      extractorName: 'html',
    }
  },
}
