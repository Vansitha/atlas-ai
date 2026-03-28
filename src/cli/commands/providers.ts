import type { Command } from 'commander'
import { syncAll, verifyAll } from '../../providers/registry.js'
import { withSpinner, fail, outro } from '../ui.js'

export function registerProvidersCommand(program: Command): void {
  const providers = program
    .command('providers')
    .description('Manage AI tool provider integrations')

  providers
    .command('status')
    .description('Show detection and health status of all providers')
    .action(async () => {
      try {
        const statuses = await verifyAll()

        const COL_NAME = 14
        const COL_DETECTED = 10
        const COL_HEALTHY = 10

        const header = [
          'PROVIDER'.padEnd(COL_NAME),
          'DETECTED'.padEnd(COL_DETECTED),
          'HEALTHY'.padEnd(COL_HEALTHY),
          'DETAILS',
        ].join('  ')
        const divider = '-'.repeat(60)

        console.log(header)
        console.log(divider)

        for (const s of statuses) {
          const line = [
            s.provider.padEnd(COL_NAME),
            String(s.configured).padEnd(COL_DETECTED),
            String(s.healthy).padEnd(COL_HEALTHY),
            s.details ?? '',
          ].join('  ')
          console.log(line)
        }
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Status check failed')
        process.exit(1)
      }
    })

  providers
    .command('sync')
    .description('Re-sync all entries to detected providers')
    .action(async () => {
      try {
        const results = await withSpinner('Syncing to providers...', () => syncAll())

        for (const r of results) {
          const errors = r.errors.length > 0 ? ` (${r.errors.length} errors)` : ''
          console.log(`  ${r.provider}: ${r.entriesSynced} entries synced${errors}`)
          for (const e of r.errors) {
            console.log(`    ! ${e}`)
          }
        }

        outro('Sync complete')
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Sync failed')
        process.exit(1)
      }
    })
}
