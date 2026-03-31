import { unlinkSync, existsSync } from 'node:fs'
import type { Command } from 'commander'
import { listEntries } from '../../storage/manifest.js'
import { stopDaemon } from '../../daemon/process-manager.js'
import { copilotProvider } from '../../providers/strategies/copilot.js'
import { removeClaudeCodeEntry } from '../../providers/strategies/claude-code.js'
import { removeCursorEntry } from '../../providers/strategies/cursor.js'
import { removeWindsurfEntry } from '../../providers/strategies/windsurf.js'
import { removeShellCompletion } from './init.js'
import {
  CONFIG_PATH,
  MANIFEST_PATH,
  CONTENT_CACHE_PATH,
  ACCURACY_LOG_PATH,
  DAEMON_PID_PATH,
  DAEMON_HEARTBEAT_PATH,
  DAEMON_LOG_PATH,
} from '../../storage/paths.js'
import { confirm, fail, intro, outro } from '../ui.js'

const DATA_FILES = [
  CONFIG_PATH,
  MANIFEST_PATH,
  CONTENT_CACHE_PATH,
  ACCURACY_LOG_PATH,
  DAEMON_PID_PATH,
  DAEMON_HEARTBEAT_PATH,
  DAEMON_LOG_PATH,
]

function tryUnlink(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path)
  } catch {
    // non-fatal
  }
}

export function registerUninstallCommand(program: Command): void {
  program
    .command('uninstall')
    .description('Remove Atlas config and data, keeping your skills and knowledge files')
    .option('--force', 'Skip confirmation prompt')
    .action(async (options) => {
      intro('uninstall')

      if (!options.force) {
        const ok = await confirm(
          'This will remove Atlas config, index, and provider integrations.\n' +
            '  Your skills and knowledge files in ~/.ai-knowledge/ will be kept.\n' +
            '  Continue?',
        )
        if (!ok) {
          outro('Aborted')
          return
        }
      }

      // Stop daemon if running
      try {
        const result = stopDaemon()
        if (result.ok) console.log(`  Stopped daemon`)
      } catch {
        // not running — fine
      }

      // Remove per-entry symlinks from all providers
      const entries = listEntries()
      for (const entry of entries) {
        removeClaudeCodeEntry(entry)
        removeCursorEntry(entry)
        removeWindsurfEntry(entry)
      }

      // Copilot writes an atlas section into a file — clean it up
      await copilotProvider.cleanup()

      // Delete config and data files (keeps skills/ and knowledge/)
      for (const file of DATA_FILES) {
        tryUnlink(file)
      }

      // Remove shell completion from rc file
      removeShellCompletion()

      outro(
        'Atlas data removed.\n' +
          '  Your files remain at ~/.ai-knowledge/skills/ and ~/.ai-knowledge/knowledge/\n\n' +
          '  To fully remove the CLI:\n' +
          '  npm uninstall -g atlas-ai',
      )
    })
}
