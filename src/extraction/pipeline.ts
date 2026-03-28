import { ExtractorRegistry } from './registry.js'
import { htmlExtractor } from './extractors/html.js'
import { twitterExtractor } from './extractors/twitter.js'
import { redditExtractor } from './extractors/reddit.js'
import { llmsFullTxtExtractor } from './extractors/llms-full-txt.js'
import { llmsTxtExtractor } from './extractors/llms-txt.js'
import { isCached, updateCache } from '../storage/content-cache.js'
import { hashUrl, isValidUrl } from '../utils/url.js'
import { ExtractionError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import type { ExtractedContent } from '../types/index.js'

const registry = new ExtractorRegistry()
registry.register(twitterExtractor)
registry.register(redditExtractor)
registry.register(llmsFullTxtExtractor)
registry.register(llmsTxtExtractor)
registry.register(htmlExtractor)

export async function extractContent(rawUrl: string): Promise<ExtractedContent> {
  if (!isValidUrl(rawUrl)) {
    throw new ExtractionError(`Invalid URL: ${rawUrl}`, rawUrl, 'pipeline')
  }

  const url = new URL(rawUrl)
  const urlHash = hashUrl(rawUrl)

  if (isCached(urlHash)) {
    logger.debug(`Cache hit for ${rawUrl} — re-extracting fresh content anyway`)
  }

  const content = await registry.extract(url)
  updateCache(urlHash, content.extractorName)

  logger.debug(`Extracted via ${content.extractorName}: ${content.title}`)
  return content
}

export { registry }
