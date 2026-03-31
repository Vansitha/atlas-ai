import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createSymlink, removeSymlink } from '../symlink.js'
import { SKILLS_DIR, KNOWLEDGE_DIR } from '../../storage/paths.js'
import type { SyncProvider, SyncResult, SyncStatus, StoredEntry } from '../../types/index.js'

const opencodeHome = () => join(homedir(), '.opencode')
const opencodeRulesDir = () => join(opencodeHome(), 'rules', 'atlas')

export const opencodeProvider: SyncProvider = {
  name: 'opencode',

  detected(): boolean {
    return existsSync(opencodeHome())
  },

  async sync(entries: readonly StoredEntry[]): Promise<SyncResult> {
    const errors: string[] = []
    let synced = 0

    for (const entry of entries) {
      try {
        if (entry.type === 'skill') {
          const source = join(SKILLS_DIR, entry.slug)
          const target = join(opencodeRulesDir(), 'skills', entry.slug)
          createSymlink(source, target)
        } else {
          const source = join(KNOWLEDGE_DIR, `${entry.slug}.md`)
          const target = join(opencodeRulesDir(), 'knowledge', `${entry.slug}.md`)
          createSymlink(source, target)
        }
        synced++
      } catch (err) {
        errors.push(`${entry.slug}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return { provider: 'opencode', entriesSynced: synced, errors }
  },

  async verify(): Promise<SyncStatus> {
    if (!this.detected()) {
      return {
        provider: 'opencode',
        configured: false,
        healthy: false,
        details: 'OpenCode not found (~/.opencode missing)',
      }
    }
    return { provider: 'opencode', configured: true, healthy: true, details: 'OpenCode detected' }
  },

  async cleanup(): Promise<void> {},
}

export function removeOpencodeEntry(entry: StoredEntry): void {
  if (entry.type === 'skill') {
    removeSymlink(join(opencodeRulesDir(), 'skills', entry.slug))
  } else {
    removeSymlink(join(opencodeRulesDir(), 'knowledge', `${entry.slug}.md`))
  }
}
