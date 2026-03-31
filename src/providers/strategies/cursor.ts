import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createSymlink, removeSymlink } from '../symlink.js'
import { SKILLS_DIR, KNOWLEDGE_DIR } from '../../storage/paths.js'
import type { SyncProvider, SyncResult, SyncStatus, StoredEntry } from '../../types/index.js'

const cursorHome = () => join(homedir(), '.cursor')
const cursorRulesDir = () => join(cursorHome(), 'rules', 'atlas')

export const cursorProvider: SyncProvider = {
  name: 'cursor',

  detected(): boolean {
    return existsSync(cursorHome())
  },

  async sync(entries: readonly StoredEntry[]): Promise<SyncResult> {
    const errors: string[] = []
    let synced = 0

    for (const entry of entries) {
      try {
        if (entry.type === 'skill') {
          const source = join(SKILLS_DIR, entry.slug)
          const target = join(cursorRulesDir(), 'skills', entry.slug)
          createSymlink(source, target)
        } else {
          const source = join(KNOWLEDGE_DIR, `${entry.slug}.md`)
          const target = join(cursorRulesDir(), 'knowledge', `${entry.slug}.md`)
          createSymlink(source, target)
        }
        synced++
      } catch (err) {
        errors.push(`${entry.slug}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return { provider: 'cursor', entriesSynced: synced, errors }
  },

  async verify(): Promise<SyncStatus> {
    if (!this.detected()) {
      return {
        provider: 'cursor',
        configured: false,
        healthy: false,
        details: 'Cursor not found (~/.cursor missing)',
      }
    }
    return { provider: 'cursor', configured: true, healthy: true, details: 'Cursor detected' }
  },

  async cleanup(): Promise<void> {},
}

export function removeCursorEntry(entry: StoredEntry): void {
  if (entry.type === 'skill') {
    removeSymlink(join(cursorRulesDir(), 'skills', entry.slug))
  } else {
    removeSymlink(join(cursorRulesDir(), 'knowledge', `${entry.slug}.md`))
  }
}
