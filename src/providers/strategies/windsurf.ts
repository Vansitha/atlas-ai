import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createSymlink, removeSymlink } from '../symlink.js'
import { SKILLS_DIR, KNOWLEDGE_DIR } from '../../storage/paths.js'
import type { SyncProvider, SyncResult, SyncStatus, StoredEntry } from '../../types/index.js'

const windsurfHome = () => join(homedir(), '.codeium', 'windsurf')
const windsurfRulesDir = () => join(windsurfHome(), 'memories', 'atlas')

export const windsurfProvider: SyncProvider = {
  name: 'windsurf',

  detected(): boolean {
    return existsSync(windsurfHome())
  },

  async sync(entries: readonly StoredEntry[]): Promise<SyncResult> {
    const errors: string[] = []
    let synced = 0

    for (const entry of entries) {
      try {
        if (entry.type === 'skill') {
          const source = join(SKILLS_DIR, entry.slug)
          const target = join(windsurfRulesDir(), 'skills', entry.slug)
          createSymlink(source, target)
        } else {
          const source = join(KNOWLEDGE_DIR, `${entry.slug}.md`)
          const target = join(windsurfRulesDir(), 'knowledge', `${entry.slug}.md`)
          createSymlink(source, target)
        }
        synced++
      } catch (err) {
        errors.push(`${entry.slug}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return { provider: 'windsurf', entriesSynced: synced, errors }
  },

  async verify(): Promise<SyncStatus> {
    if (!this.detected()) {
      return {
        provider: 'windsurf',
        configured: false,
        healthy: false,
        details: 'Windsurf not found (~/.codeium/windsurf missing)',
      }
    }
    return { provider: 'windsurf', configured: true, healthy: true, details: 'Windsurf detected' }
  },

  async cleanup(): Promise<void> {},
}

export function removeWindsurfEntry(entry: StoredEntry): void {
  if (entry.type === 'skill') {
    removeSymlink(join(windsurfRulesDir(), 'skills', entry.slug))
  } else {
    removeSymlink(join(windsurfRulesDir(), 'knowledge', `${entry.slug}.md`))
  }
}
