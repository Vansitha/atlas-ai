import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ClassificationResponse } from '../../../src/schemas/classification.js'
import type { GenerationResponse } from '../../../src/schemas/generation.js'

const tempDir = join(tmpdir(), `atlas-writer-test-${Date.now()}`)

vi.mock('../../../src/storage/paths.js', () => ({
  ATLAS_HOME: tempDir,
  SKILLS_DIR: join(tempDir, 'skills'),
  KNOWLEDGE_DIR: join(tempDir, 'knowledge'),
  CONFIG_PATH: join(tempDir, 'config.json'),
  MANIFEST_PATH: join(tempDir, '.index.json'),
  CONTENT_CACHE_PATH: join(tempDir, '.content-cache.json'),
  ACCURACY_LOG_PATH: join(tempDir, '.accuracy-log.jsonl'),
  DAEMON_PID_PATH: join(tempDir, '.daemon.pid'),
  DAEMON_HEARTBEAT_PATH: join(tempDir, '.daemon.heartbeat'),
  BROWSER_BOOKMARK_PATHS: {},
}))

vi.mock('../../../src/storage/manifest.js', () => ({
  listEntries: vi.fn(() => []),
  addEntry: vi.fn(),
}))

const { writeEntry } = await import('../../../src/storage/writer.js')

const classification: ClassificationResponse = {
  type: 'skill',
  confidence: 0.9,
  reasoning: 'It is a skill',
  suggestedSlug: 'react-hooks',
  tags: ['react'],
}

const generation: GenerationResponse = {
  title: 'React Hooks Patterns',
  description: 'A guide to React hooks',
  tags: ['react', 'hooks'],
  markdown: '# React Hooks\n\nContent here.',
}

beforeEach(() => {
  mkdirSync(join(tempDir, 'skills'), { recursive: true })
  mkdirSync(join(tempDir, 'knowledge'), { recursive: true })
})

afterEach(() => {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })
})

describe('writeEntry', () => {
  it('writes a skill to skills/<slug>/SKILL.md', () => {
    const result = writeEntry('https://example.com/react', generation, classification)
    expect(result.slug).toBe('react-hooks')
    expect(result.filePath).toContain('SKILL.md')
    expect(existsSync(result.filePath)).toBe(true)
  })

  it('writes a knowledge entry to knowledge/<slug>.md', () => {
    const knowledgeClassification: ClassificationResponse = {
      ...classification,
      type: 'knowledge',
      suggestedSlug: 'event-loop',
    }
    const result = writeEntry('https://example.com/el', generation, knowledgeClassification)
    expect(result.filePath).toContain('knowledge')
    expect(result.filePath).toContain('.md')
    expect(existsSync(result.filePath)).toBe(true)
  })

  it('writes frontmatter to the file', () => {
    const result = writeEntry('https://example.com/react', generation, classification)
    const content = readFileSync(result.filePath, 'utf-8')
    expect(content).toContain('---')
    expect(content).toContain('title:')
    expect(content).toContain('type: skill')
    expect(content).toContain('sourceUrl:')
  })

  it('writes markdown body', () => {
    const result = writeEntry('https://example.com/react', generation, classification)
    const content = readFileSync(result.filePath, 'utf-8')
    expect(content).toContain('# React Hooks')
    expect(content).toContain('Content here.')
  })

  it('returns entry with correct fields', () => {
    const result = writeEntry('https://example.com/react', generation, classification)
    expect(result.entry.sourceUrl).toBe('https://example.com/react')
    expect(result.entry.type).toBe('skill')
    expect(result.entry.title).toBe('React Hooks Patterns')
  })

  it('respects nameOverride for slug generation', () => {
    const result = writeEntry('https://example.com/react', generation, classification, 'My Custom Hook')
    expect(result.slug).toBe('my-custom-hook')
  })

  it('strips frontmatter from AI-generated markdown', () => {
    const genWithFrontmatter: GenerationResponse = {
      ...generation,
      markdown: '---\ntitle: AI title\n---\n# Real Content',
    }
    const result = writeEntry('https://example.com/react', genWithFrontmatter, classification)
    const content = readFileSync(result.filePath, 'utf-8')
    const frontmatterCount = (content.match(/^---$/gm) ?? []).length
    expect(frontmatterCount).toBe(2) // exactly one frontmatter block
  })
})
