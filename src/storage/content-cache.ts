import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { contentCacheSchema } from '../schemas/content-cache.js'
import { CONTENT_CACHE_PATH } from './paths.js'
import type { ContentCache } from '../schemas/content-cache.js'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function emptyCache(): ContentCache {
  return { version: 1, entries: {} }
}

function loadCache(): ContentCache {
  if (!existsSync(CONTENT_CACHE_PATH)) return emptyCache()
  const raw = JSON.parse(readFileSync(CONTENT_CACHE_PATH, 'utf-8'))
  return contentCacheSchema.parse(raw)
}

function saveCache(cache: ContentCache): void {
  const dir = dirname(CONTENT_CACHE_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(CONTENT_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8')
}

export function isCached(urlHash: string): boolean {
  const cache = loadCache()
  const entry = cache.entries[urlHash]
  if (!entry) return false
  const age = Date.now() - new Date(entry.extractedAt).getTime()
  return age < CACHE_TTL_MS
}

export function updateCache(urlHash: string, extractorName: string): void {
  const cache = loadCache()
  const updated: ContentCache = {
    ...cache,
    entries: {
      ...cache.entries,
      [urlHash]: {
        urlHash,
        extractedAt: new Date().toISOString(),
        extractorName,
      },
    },
  }
  saveCache(updated)
}
