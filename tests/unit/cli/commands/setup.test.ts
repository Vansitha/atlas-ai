import { describe, it, expect, vi } from 'vitest'
import { Command } from 'commander'
import { registerSetupCommand } from '../../../../src/cli/commands/setup.js'

function makeProgram() {
  const program = new Command()
  program.exitOverride()
  registerSetupCommand(program)
  return program
}

describe('atlas setup', () => {
  it('prints message about atlas init', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await makeProgram().parseAsync(['node', 'atlas', 'setup'])
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('atlas init'))
    spy.mockRestore()
  })
})
