import { unlinkSync, rmdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Command } from 'commander'
import { findBySlug, removeEntry } from '../../storage/manifest.js'
import { getAllProviders, syncAll } from '../../providers/registry.js'
import { confirm, fail, outro } from '../ui.js'

export function registerDeleteCommand(program: Command): void {
  program
    .command('delete')
    .description('Delete a captured entry')
    .argument('<slug>', 'Entry slug to delete')
    .option('--force', 'Skip confirmation prompt')
    .action(async (slug, options) => {
      try {
        const entry = findBySlug(slug)
        if (!entry) {
          fail(`Entry not found: ${slug}`)
          process.exit(1)
        }

        if (!options.force) {
          const ok = await confirm(`Delete "${entry.title}"? This cannot be undone.`)
          if (!ok) {
            outro('Aborted')
            return
          }
        }

        removeEntry(slug)

        if (existsSync(entry.filePath)) {
          try {
            unlinkSync(entry.filePath)
            if (entry.type === 'skill') {
              const dir = dirname(entry.filePath)
              try {
                rmdirSync(dir)
              } catch {
                // Dir not empty — leave it
              }
            }
          } catch {
            // File already gone — continue
          }
        }

        for (const provider of getAllProviders()) {
          if (provider.detected()) {
            await provider.cleanup()
          }
        }

        await syncAll()

        outro(`Deleted "${entry.title}"`)
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Delete failed')
        process.exit(1)
      }
    })
}
