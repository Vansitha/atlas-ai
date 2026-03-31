import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { SyncProvider, SyncResult, SyncStatus, StoredEntry } from '../../types/index.js'

const GITHUB_DIR = join(process.cwd(), '.github')
const COPILOT_INSTRUCTIONS_PATH = join(GITHUB_DIR, 'copilot-instructions.md')

const ATLAS_START = '<!-- atlas:start -->'
const ATLAS_END = '<!-- atlas:end -->'

function buildAtlasSection(entries: readonly StoredEntry[]): string {
  if (entries.length === 0) return ''

  const skills = entries.filter((e) => e.type === 'skill')
  const knowledge = entries.filter((e) => e.type === 'knowledge')

  const lines: string[] = [
    ATLAS_START,
    '## Atlas Knowledge Base',
    '',
    'The following skills and knowledge notes are available in `~/.ai-knowledge/`.',
    '',
  ]

  if (skills.length > 0) {
    lines.push('### Skills')
    for (const s of skills) {
      lines.push(`- **${s.title}** (\`${s.slug}\`): ${s.tags.join(', ')}`)
    }
    lines.push('')
  }

  if (knowledge.length > 0) {
    lines.push('### Knowledge')
    for (const k of knowledge) {
      lines.push(`- **${k.title}** (\`${k.slug}\`): ${k.tags.join(', ')}`)
    }
    lines.push('')
  }

  lines.push(ATLAS_END)
  return lines.join('\n')
}

function updateInstructions(filePath: string, entries: readonly StoredEntry[]): void {
  const section = buildAtlasSection(entries)
  const dir = dirname(filePath)

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  if (!existsSync(filePath)) {
    writeFileSync(filePath, section + '\n', 'utf-8')
    return
  }

  const existing = readFileSync(filePath, 'utf-8')
  const startIdx = existing.indexOf(ATLAS_START)
  const endIdx = existing.indexOf(ATLAS_END)

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing atlas section
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + ATLAS_END.length)
    writeFileSync(filePath, `${before}${section}${after}`, 'utf-8')
  } else {
    // Append new section
    writeFileSync(filePath, `${existing.trimEnd()}\n\n${section}\n`, 'utf-8')
  }
}

export const copilotProvider: SyncProvider = {
  name: 'copilot',

  detected(): boolean {
    return existsSync(GITHUB_DIR)
  },

  async sync(entries: readonly StoredEntry[]): Promise<SyncResult> {
    try {
      updateInstructions(COPILOT_INSTRUCTIONS_PATH, entries)
      return { provider: 'copilot', entriesSynced: entries.length, errors: [] }
    } catch (err) {
      return {
        provider: 'copilot',
        entriesSynced: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      }
    }
  },

  async verify(): Promise<SyncStatus> {
    if (!this.detected()) {
      return {
        provider: 'copilot',
        configured: false,
        healthy: false,
        details: 'No .github/ directory found in current project',
      }
    }
    const hasSection =
      existsSync(COPILOT_INSTRUCTIONS_PATH) &&
      readFileSync(COPILOT_INSTRUCTIONS_PATH, 'utf-8').includes(ATLAS_START)
    return {
      provider: 'copilot',
      configured: hasSection,
      healthy: hasSection,
      details: hasSection
        ? 'Atlas section present in copilot-instructions.md'
        : 'Atlas section not yet written',
    }
  },

  async cleanup(): Promise<void> {
    if (!existsSync(COPILOT_INSTRUCTIONS_PATH)) return
    const content = readFileSync(COPILOT_INSTRUCTIONS_PATH, 'utf-8')
    const startIdx = content.indexOf(ATLAS_START)
    const endIdx = content.indexOf(ATLAS_END)
    if (startIdx !== -1 && endIdx !== -1) {
      const cleaned = (content.slice(0, startIdx) + content.slice(endIdx + ATLAS_END.length)).trim()
      writeFileSync(COPILOT_INSTRUCTIONS_PATH, cleaned + '\n', 'utf-8')
    }
  },
}
