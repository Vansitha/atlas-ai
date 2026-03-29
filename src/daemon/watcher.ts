import { writeFileSync } from 'node:fs'
import { watch } from 'chokidar'
import { DAEMON_HEARTBEAT_PATH, findBookmarksPath } from '../storage/paths.js'
import { loadConfig } from '../config/loader.js'
import { parseBookmarkFolder } from './bookmark-parser.js'
import { findByUrlHash, addEntry } from '../storage/manifest.js'
import { hashUrl, isValidUrl } from '../utils/url.js'
import { extractContent } from '../extraction/pipeline.js'
import { resolveTransport } from '../ai/resolver.js'
import { classify } from '../ai/intelligence/classifier.js'
import { generate } from '../ai/intelligence/generator.js'
import { writeEntry } from '../storage/writer.js'
import { syncAll } from '../providers/registry.js'

const HEARTBEAT_INTERVAL_MS = 30_000

function writeHeartbeat(): void {
  try {
    writeFileSync(DAEMON_HEARTBEAT_PATH, new Date().toISOString(), 'utf-8')
  } catch {
    // non-fatal
  }
}

async function captureUrl(url: string, transport: Awaited<ReturnType<typeof resolveTransport>>): Promise<void> {
  try {
    const content = await extractContent(url)
    const classification = await classify(transport, content)
    const generation = await generate(transport, content, classification)
    const writeResult = writeEntry(url, generation, classification)
    addEntry({ ...writeResult.entry, tags: [...writeResult.entry.tags] })
    await syncAll()
    console.log(`[atlas-daemon] Captured: ${writeResult.entry.title} (${writeResult.slug})`)
  } catch (err) {
    console.error(
      `[atlas-daemon] Failed to capture ${url}: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export async function startWatcher(): Promise<void> {
  const config = loadConfig()

  if (!config.browser || config.browser === 'skip') {
    console.error('[atlas-daemon] No browser configured. Run atlas init first.')
    process.exit(1)
  }

  const bookmarksPath = findBookmarksPath(config.browser, config.browserProfile)
  if (!bookmarksPath) {
    console.error(`[atlas-daemon] No bookmark path for browser: ${config.browser}`)
    process.exit(1)
  }

  const folderName = config.daemon.bookmarkFolder
  const debounceMs = config.daemon.debounceMs

  // Seed the seen set with URLs already in the Atlas bookmark folder
  // so we don't re-capture them on startup
  const seen = new Set<string>()
  const existing = parseBookmarkFolder(bookmarksPath, folderName)
  for (const { url } of existing) {
    if (isValidUrl(url)) {
      seen.add(url)
    }
  }

  console.log(`[atlas-daemon] Watching "${folderName}" folder in ${bookmarksPath}`)
  writeHeartbeat()

  const heartbeatTimer = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS)
  let isProcessing = false

  const watcher = watch(bookmarksPath, {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: debounceMs,
      pollInterval: 200,
    },
  })

  watcher.on('change', async () => {
    if (isProcessing) return
    isProcessing = true

    try {
      const bookmarks = parseBookmarkFolder(bookmarksPath, folderName)
      const newUrls = bookmarks.filter(({ url }) => {
        if (!isValidUrl(url)) return false
        if (seen.has(url)) return false
        if (findByUrlHash(hashUrl(url))) {
          seen.add(url)
          return false
        }
        return true
      })

      if (newUrls.length === 0) return

      // Resolve transport once per change event, not once per URL
      let transport
      try {
        transport = await resolveTransport()
      } catch (err) {
        console.error(`[atlas-daemon] No AI provider: ${err instanceof Error ? err.message : String(err)}`)
        return
      }

      for (const { url } of newUrls) {
        console.log(`[atlas-daemon] New bookmark detected: ${url}`)
        await captureUrl(url, transport)
        // Add to seen only after attempting capture (allows retry on next change if it fails)
        seen.add(url)
      }
    } finally {
      isProcessing = false
    }
  })

  watcher.on('error', (err) => {
    console.error(`[atlas-daemon] Watcher error: ${err}`)
  })

  const shutdown = (): void => {
    clearInterval(heartbeatTimer)
    watcher.close().then(() => process.exit(0)).catch(() => process.exit(1))
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
