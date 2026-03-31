import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createSymlink, verifySymlink, removeSymlink } from '../symlink.js'
import { SKILLS_DIR, KNOWLEDGE_DIR } from '../../storage/paths.js'
import type { SyncProvider, SyncResult, SyncStatus, StoredEntry } from '../../types/index.js'

const claudeHome = () => join(homedir(), '.claude')
const claudeSkillsDir = () => join(claudeHome(), 'skills')
const claudeKnowledgeDir = () => join(claudeHome(), 'rules', 'knowledge')

export const claudeCodeProvider: SyncProvider = {
  name: 'claude-code',

  detected(): boolean {
    return existsSync(claudeHome())
  },

  async sync(entries: readonly StoredEntry[]): Promise<SyncResult> {
    const errors: string[] = []
    let synced = 0

    for (const entry of entries) {
      try {
        if (entry.type === 'skill') {
          const source = join(SKILLS_DIR, entry.slug)
          const target = join(claudeSkillsDir(), entry.slug)
          createSymlink(source, target)
        } else {
          const source = join(KNOWLEDGE_DIR, `${entry.slug}.md`)
          const target = join(claudeKnowledgeDir(), `${entry.slug}.md`)
          createSymlink(source, target)
        }
        synced++
      } catch (err) {
        errors.push(`${entry.slug}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return { provider: 'claude-code', entriesSynced: synced, errors }
  },

  async verify(): Promise<SyncStatus> {
    if (!this.detected()) {
      return {
        provider: 'claude-code',
        configured: false,
        healthy: false,
        details: 'Claude Code not found (~/.claude missing)',
      }
    }
    return {
      provider: 'claude-code',
      configured: true,
      healthy: true,
      details: 'Claude Code detected',
    }
  },

  async cleanup(): Promise<void> {
    // Symlinks are cleaned up individually via removeEntry
  },
}

export function removeClaudeCodeEntry(entry: StoredEntry): void {
  if (entry.type === 'skill') {
    removeSymlink(join(claudeSkillsDir(), entry.slug))
  } else {
    removeSymlink(join(claudeKnowledgeDir(), `${entry.slug}.md`))
  }
}
