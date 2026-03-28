import type { Command } from 'commander'
import { search } from '../../storage/manifest.js'
import { formatEntryTable } from '../format.js'
import { fail } from '../ui.js'

export function registerSearchCommand(program: Command): void {
  program
    .command('search')
    .description('Search entries by title, tags, or URL')
    .argument('<query>', 'Search term')
    .action((query) => {
      try {
        const results = search(query)

        if (results.length === 0) {
          console.log(`No results for "${query}".`)
          return
        }

        console.log(formatEntryTable(results))
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Search failed')
        process.exit(1)
      }
    })
}
