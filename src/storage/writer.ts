import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { frontmatterSchema } from '../schemas/frontmatter.js'
import { SKILLS_DIR, KNOWLEDGE_DIR } from './paths.js'
import { hashUrl, generateSlug } from '../utils/url.js'
import { listEntries } from './manifest.js'
import type { GenerationResponse } from '../schemas/generation.js'
import type { ClassificationResponse } from '../schemas/classification.js'
import type { StoredEntry } from '../types/index.js'

export interface WriteResult {
  readonly filePath: string
  readonly slug: string
  readonly entry: StoredEntry
}

export function writeEntry(
  sourceUrl: string,
  generation: GenerationResponse,
  classification: ClassificationResponse,
  nameOverride?: string,
): WriteResult {
  const existingSlugs = listEntries().map((e) => e.slug)
  const slug = nameOverride
    ? generateSlug(nameOverride, existingSlugs)
    : generateSlug(classification.suggestedSlug || generation.title, existingSlugs)

  const urlHash = hashUrl(sourceUrl)
  const capturedAt = new Date().toISOString()

  const frontmatter = frontmatterSchema.parse({
    title: generation.title,
    type: classification.type,
    sourceUrl,
    urlHash,
    capturedAt,
    tags: generation.tags,
    description: generation.description,
    aiClassification: classification.type,
  })

  const frontmatterYaml = [
    '---',
    `title: "${frontmatter.title.replace(/"/g, '\\"')}"`,
    `type: ${frontmatter.type}`,
    `sourceUrl: "${frontmatter.sourceUrl}"`,
    `urlHash: ${frontmatter.urlHash}`,
    `capturedAt: ${frontmatter.capturedAt}`,
    `tags: [${frontmatter.tags.map((t) => `"${t}"`).join(', ')}]`,
    `description: "${(frontmatter.description ?? '').replace(/"/g, '\\"')}"`,
    '---',
    '',
  ].join('\n')

  // Merge frontmatter with the AI-generated markdown body
  // Strip any frontmatter the AI may have included
  const bodyOnly = generation.markdown.replace(/^---[\s\S]*?---\n*/m, '').trim()

  const fullContent = `${frontmatterYaml}${bodyOnly}\n`

  let filePath: string
  if (classification.type === 'skill') {
    const dir = join(SKILLS_DIR, slug)
    mkdirSync(dir, { recursive: true })
    filePath = join(dir, 'SKILL.md')
  } else {
    mkdirSync(KNOWLEDGE_DIR, { recursive: true })
    filePath = join(KNOWLEDGE_DIR, `${slug}.md`)
  }

  writeFileSync(filePath, fullContent, 'utf-8')

  const entry: StoredEntry = {
    slug,
    title: generation.title,
    type: classification.type,
    sourceUrl,
    urlHash,
    capturedAt,
    tags: generation.tags,
    filePath,
  }

  return { filePath, slug, entry }
}
