#!/usr/bin/env node
import { createRequire } from 'node:module'
import { Command } from 'commander'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json') as { version: string }
import { registerCaptureCommand } from '../src/cli/commands/capture.js'
import { registerListCommand } from '../src/cli/commands/list.js'
import { registerShowCommand } from '../src/cli/commands/show.js'
import { registerSearchCommand } from '../src/cli/commands/search.js'
import { registerDeleteCommand } from '../src/cli/commands/delete.js'
import { registerProvidersCommand } from '../src/cli/commands/providers.js'
import { registerInitCommand } from '../src/cli/commands/init.js'
import { registerSetupCommand } from '../src/cli/commands/setup.js'
import { registerDaemonCommand } from '../src/cli/commands/daemon.js'
import { registerCompletionCommand } from '../src/cli/commands/completion.js'
import { registerUninstallCommand } from '../src/cli/commands/uninstall.js'
import { registerOpenCommand } from '../src/cli/commands/open.js'

const program = new Command()

program.name('atlas').description('Turn any URL or bookmark into AI knowledge').version(pkg.version)

registerCaptureCommand(program)
registerListCommand(program)
registerShowCommand(program)
registerSearchCommand(program)
registerDeleteCommand(program)
registerProvidersCommand(program)
registerInitCommand(program)
registerSetupCommand(program)
registerDaemonCommand(program)
registerCompletionCommand(program)
registerUninstallCommand(program)
registerOpenCommand(program)

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
