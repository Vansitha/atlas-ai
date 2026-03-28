import type { Command } from 'commander'

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Configure Atlas (alias for `atlas init`)')
    .action(() => {
      console.log('Run `atlas init` for the full setup wizard.')
    })
}
