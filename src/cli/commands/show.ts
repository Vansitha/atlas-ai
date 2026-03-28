import type { Command } from 'commander'
import { findBySlug } from '../../storage/manifest.js'
import { readEntry, entryExists } from '../../storage/reader.js'
import { fail } from '../ui.js'

export function registerShowCommand(program: Command): void {
  program
    .command('show')
    .description('Display a captured entry')
    .argument('<slug>', 'Entry slug')
    .action((slug) => {
      try {
        const entry = findBySlug(slug)
        if (!entry) {
          fail(`Entry not found: ${slug}`)
          process.exit(1)
        }

        if (!entryExists(entry)) {
          fail(`Entry file missing on disk: ${entry.filePath}`)
          process.exit(1)
        }

        const content = readEntry(entry)
        console.log(content)
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Failed to show entry')
        process.exit(1)
      }
    })
}
