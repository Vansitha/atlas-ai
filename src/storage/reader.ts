import { existsSync, readFileSync } from 'node:fs'
import { frontmatterSchema } from '../schemas/frontmatter.js'
import type { StoredEntry } from '../types/index.js'
import type { z } from 'zod'

export type Frontmatter = z.infer<typeof frontmatterSchema>

export function entryExists(entry: StoredEntry): boolean {
  return existsSync(entry.filePath)
}

export function readEntry(entry: StoredEntry): string {
  return readFileSync(entry.filePath, 'utf-8')
}

export function readEntryFrontmatter(entry: StoredEntry): Frontmatter {
  const content = readEntry(entry)
  const parts = content.split(/^---$/m)
  if (parts.length < 3) {
    throw new Error(`Invalid frontmatter in ${entry.filePath}`)
  }
  const yamlBlock = parts[1].trim()
  const raw: Record<string, unknown> = {}

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()

    if (value.startsWith('[')) {
      try {
        raw[key] = JSON.parse(value.replace(/'/g, '"'))
      } catch {
        raw[key] = []
      }
    } else if (value.startsWith('"') && value.endsWith('"')) {
      raw[key] = value.slice(1, -1).replace(/\\"/g, '"')
    } else {
      raw[key] = value
    }
  }

  return frontmatterSchema.parse(raw)
}
