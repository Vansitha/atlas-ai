import type { ContentExtractor, ExtractedContent } from '../../types/index.js'
import { ExtractionError } from '../../utils/errors.js'

const FETCH_TIMEOUT_MS = 10_000

export const llmsFullTxtExtractor: ContentExtractor = {
  name: 'llms-full-txt',
  priority: 50,

  canHandle(_url: URL): boolean {
    return true
  },

  async extract(url: URL): Promise<ExtractedContent> {
    const llmsUrl = `${url.origin}/llms-full.txt`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(llmsUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Atlas/1.0' },
      })

      if (!response.ok) {
        throw new ExtractionError(
          `llms-full.txt not found at ${llmsUrl}`,
          url.toString(),
          'llms-full-txt',
        )
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/')) {
        throw new ExtractionError(
          `llms-full.txt is not text content`,
          url.toString(),
          'llms-full-txt',
        )
      }

      const text = await response.text()

      if (text.trim().length < 50) {
        throw new ExtractionError(
          'llms-full.txt content too short',
          url.toString(),
          'llms-full-txt',
        )
      }

      const titleMatch = text.match(/^#\s+(.+)$/m)
      const title = titleMatch?.[1]?.trim() ?? url.hostname

      return {
        url: url.toString(),
        title: title.slice(0, 200),
        body: text.slice(0, 50_000),
        metadata: { source: llmsUrl },
        extractedAt: new Date().toISOString(),
        extractorName: 'llms-full-txt',
      }
    } finally {
      clearTimeout(timeout)
    }
  },
}
