import type { Command } from 'commander'
import { isValidUrl, hashUrl } from '../../utils/url.js'
import { findByUrlHash, addEntry } from '../../storage/manifest.js'
import { extractContent } from '../../extraction/pipeline.js'
import { resolveTransport } from '../../ai/resolver.js'
import { classify } from '../../ai/intelligence/classifier.js'
import { generate } from '../../ai/intelligence/generator.js'
import { writeEntry } from '../../storage/writer.js'
import { syncAll } from '../../providers/registry.js'
import { intro, outro, fail, confirm, withSpinner } from '../ui.js'
import type { OutputType, SyncResult } from '../../types/index.js'

export function registerCaptureCommand(program: Command): void {
  program
    .command('capture')
    .description('Capture a URL as a skill or knowledge note')
    .argument('<url>', 'URL to capture')
    .option('--dry-run', 'Preview content without saving')
    .option('--as <type>', 'Force type: skill or knowledge')
    .option('--name <title>', 'Override the generated title')
    .option('--tags <tags>', 'Additional comma-separated tags')
    .action(async (url: string, options) => {
      intro('capture')

      if (!isValidUrl(url)) {
        fail('Invalid URL. Please provide a valid http/https URL.')
        process.exit(1)
      }

      const forceType = options.as as OutputType | undefined
      if (forceType && forceType !== 'skill' && forceType !== 'knowledge') {
        fail('--as must be "skill" or "knowledge"')
        process.exit(1)
      }

      const urlHash = hashUrl(url)
      const existing = findByUrlHash(urlHash)
      if (existing) {
        const ok = await confirm(
          `"${existing.title}" was already captured (${existing.slug}). Re-capture?`,
        )
        if (!ok) {
          outro('Aborted')
          return
        }
      }

      let content
      try {
        content = await withSpinner('Extracting content...', () => extractContent(url))
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Extraction failed')
        process.exit(1)
      }

      if (options.dryRun) {
        console.log('\n--- Dry Run Preview ---')
        console.log(`Title:  ${content.title ?? '(untitled)'}`)
        console.log(`URL:    ${url}`)
        console.log(`Length: ${content.body.length} chars`)
        console.log('\nContent preview:')
        console.log(content.body.slice(0, 500) + (content.body.length > 500 ? '\n...' : ''))
        outro('Dry run complete — nothing saved')
        return
      }

      let transport
      try {
        transport = await withSpinner('Resolving AI provider...', () => resolveTransport())
      } catch (err) {
        fail(err instanceof Error ? err.message : 'No AI provider available')
        process.exit(1)
      }

      let classification
      try {
        classification = await withSpinner('Classifying content...', () =>
          classify(transport, content, forceType),
        )
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Classification failed')
        process.exit(1)
      }

      let generation
      try {
        generation = await withSpinner('Generating markdown...', () =>
          generate(transport, content, classification),
        )
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Generation failed')
        process.exit(1)
      }

      const userTags = options.tags
        ? options.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : []

      const mergedGeneration =
        userTags.length > 0
          ? { ...generation, tags: [...new Set([...generation.tags, ...userTags])] }
          : generation

      const writeResult = writeEntry(url, mergedGeneration, classification, options.name)
      addEntry({ ...writeResult.entry, tags: [...writeResult.entry.tags] })

      let syncResults: SyncResult[] = []
      try {
        syncResults = await withSpinner('Syncing to providers...', () => syncAll())
      } catch {
        // Sync failure is non-fatal — entry is already saved
      }

      const providerLine =
        syncResults.length > 0
          ? ` (synced to ${syncResults
              .filter((r) => r.entriesSynced > 0)
              .map((r) => r.provider)
              .join(', ')})`
          : ''

      outro(
        `Captured "${writeResult.entry.title}" as ${classification.type} (${writeResult.slug})${providerLine}`,
      )
    })
}
