import type { ContentExtractor, ExtractedContent } from '../types/index.js'
import { ExtractionError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

export class ExtractorRegistry {
  private readonly extractors: ContentExtractor[] = []

  register(extractor: ContentExtractor): void {
    this.extractors.push(extractor)
    this.extractors.sort((a, b) => b.priority - a.priority)
  }

  async extract(url: URL): Promise<ExtractedContent> {
    const candidates = this.extractors.filter((e) => e.canHandle(url))

    for (const extractor of candidates) {
      try {
        logger.debug(`Trying extractor: ${extractor.name}`)
        const content = await extractor.extract(url)
        logger.debug(`Extractor succeeded: ${extractor.name}`)
        return content
      } catch (err) {
        logger.debug(
          `Extractor ${extractor.name} failed: ${err instanceof Error ? err.message : String(err)}`,
        )
        continue
      }
    }

    throw new ExtractionError(
      `All extractors failed for URL: ${url.toString()}`,
      url.toString(),
      'registry',
    )
  }

  getRegistered(): readonly ContentExtractor[] {
    return this.extractors
  }
}
