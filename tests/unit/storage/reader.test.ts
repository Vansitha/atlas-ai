import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readEntry, readEntryFrontmatter, entryExists } from '../../../src/storage/reader.js'
import type { StoredEntry } from '../../../src/types/index.js'

const tempDir = join(tmpdir(), `atlas-reader-test-${Date.now()}`)

const sampleContent = `---
title: "React Hooks Patterns"
type: skill
sourceUrl: "https://example.com/react"
urlHash: abc123
capturedAt: 2024-01-15T10:00:00.000Z
tags: ["react", "hooks"]
description: "A guide to React hooks"
---

# React Hooks Patterns

Content here.
`

let entry: StoredEntry

beforeEach(() => {
  mkdirSync(join(tempDir, 'skills', 'react-hooks'), { recursive: true })
  const filePath = join(tempDir, 'skills', 'react-hooks', 'SKILL.md')
  writeFileSync(filePath, sampleContent, 'utf-8')
  entry = {
    slug: 'react-hooks',
    title: 'React Hooks Patterns',
    type: 'skill',
    sourceUrl: 'https://example.com/react',
    urlHash: 'abc123',
    capturedAt: '2024-01-15T10:00:00.000Z',
    tags: ['react', 'hooks'],
    filePath,
  }
})

afterEach(() => {
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true })
})

describe('entryExists', () => {
  it('returns true when file exists', () => {
    expect(entryExists(entry)).toBe(true)
  })

  it('returns false when file is missing', () => {
    expect(entryExists({ ...entry, filePath: join(tempDir, 'nonexistent.md') })).toBe(false)
  })
})

describe('readEntry', () => {
  it('returns the full markdown content', () => {
    const content = readEntry(entry)
    expect(content).toContain('React Hooks Patterns')
    expect(content).toContain('Content here.')
  })

  it('throws when file does not exist', () => {
    expect(() => readEntry({ ...entry, filePath: join(tempDir, 'missing.md') })).toThrow()
  })
})

describe('readEntryFrontmatter', () => {
  it('parses title', () => {
    const fm = readEntryFrontmatter(entry)
    expect(fm.title).toBe('React Hooks Patterns')
  })

  it('parses type', () => {
    const fm = readEntryFrontmatter(entry)
    expect(fm.type).toBe('skill')
  })

  it('parses tags array', () => {
    const fm = readEntryFrontmatter(entry)
    expect(fm.tags).toEqual(['react', 'hooks'])
  })

  it('parses sourceUrl', () => {
    const fm = readEntryFrontmatter(entry)
    expect(fm.sourceUrl).toBe('https://example.com/react')
  })

  it('throws on invalid frontmatter', () => {
    const badPath = join(tempDir, 'bad.md')
    writeFileSync(badPath, '# No frontmatter here\n', 'utf-8')
    expect(() => readEntryFrontmatter({ ...entry, filePath: badPath })).toThrow()
  })
})
