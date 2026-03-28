import type { Command } from 'commander'
import { listEntries } from '../../storage/manifest.js'
import { formatEntryTable } from '../format.js'
import { fail } from '../ui.js'

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all captured entries')
    .option('--type <type>', 'Filter by type: skill or knowledge')
    .option('--tag <tag>', 'Filter by tag')
    .option('--limit <n>', 'Max entries to show', parseInt)
    .action((options) => {
      try {
        let entries = listEntries(options.type)

        if (options.tag) {
          entries = entries.filter((e) => e.tags.includes(options.tag))
        }

        if (options.limit && options.limit > 0) {
          entries = entries.slice(0, options.limit)
        }

        if (entries.length === 0) {
          console.log('No entries found. Run `atlas capture <url>` to add one.')
          return
        }

        console.log(formatEntryTable(entries))
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Failed to list entries')
        process.exit(1)
      }
    })
}
