#!/usr/bin/env node
import { Command } from 'commander'
import { registerCaptureCommand } from '../src/cli/commands/capture.js'
import { registerListCommand } from '../src/cli/commands/list.js'
import { registerShowCommand } from '../src/cli/commands/show.js'
import { registerSearchCommand } from '../src/cli/commands/search.js'
import { registerDeleteCommand } from '../src/cli/commands/delete.js'
import { registerProvidersCommand } from '../src/cli/commands/providers.js'
import { registerSetupCommand } from '../src/cli/commands/setup.js'

const program = new Command()

program
  .name('atlas')
  .description('Turn any URL or bookmark into AI knowledge')
  .version('0.1.0')

registerCaptureCommand(program)
registerListCommand(program)
registerShowCommand(program)
registerSearchCommand(program)
registerDeleteCommand(program)
registerProvidersCommand(program)
registerSetupCommand(program)

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
