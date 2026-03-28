import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AITransport } from '../../types/index.js'
import { logger } from '../../utils/logger.js'

const execFileAsync = promisify(execFile)
const TIMEOUT_MS = 120_000

async function binaryExists(name: string): Promise<boolean> {
  try {
    await execFileAsync('which', [name])
    return true
  } catch {
    return false
  }
}

export const claudeCliTransport: AITransport = {
  name: 'claude-cli',

  async available(): Promise<boolean> {
    return binaryExists('claude')
  },

  async send(prompt: string): Promise<string> {
    logger.debug('Sending prompt via claude CLI')
    try {
      const { stdout, stderr } = await execFileAsync(
        'claude',
        ['--print', '--output-format', 'text', prompt],
        { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      )
      if (stderr) logger.debug(`claude CLI stderr: ${stderr}`)
      return stdout.trim()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`claude CLI failed: ${message}`)
    }
  },
}
