import { describe, it, expect } from 'vitest'
import { formatEntryTable } from '../../../src/cli/format.js'
import type { StoredEntry } from '../../../src/types/index.js'

const entry: StoredEntry = {
  slug: 'react-hooks',
  title: 'React Hooks Patterns',
  type: 'skill',
  sourceUrl: 'https://example.com',
  urlHash: 'abc',
  capturedAt: '2024-01-15T10:00:00.000Z',
  tags: ['react', 'hooks'],
  filePath: '/tmp/skills/react-hooks/SKILL.md',
}

describe('formatEntryTable', () => {
  it('includes header row', () => {
    const output = formatEntryTable([entry])
    expect(output).toContain('SLUG')
    expect(output).toContain('TITLE')
    expect(output).toContain('TYPE')
  })

  it('includes entry data', () => {
    const output = formatEntryTable([entry])
    expect(output).toContain('react-hooks')
    expect(output).toContain('React Hooks')
    expect(output).toContain('skill')
    expect(output).toContain('2024-01-15')
  })

  it('handles empty list with just header', () => {
    const output = formatEntryTable([])
    expect(output).toContain('SLUG')
    expect(output).not.toContain('react-hooks')
  })

  it('truncates long titles', () => {
    const longEntry: StoredEntry = {
      ...entry,
      title: 'A Very Long Title That Should Be Truncated In The Table Output For Display',
    }
    const output = formatEntryTable([longEntry])
    expect(output).toContain('…')
  })

  it('renders multiple entries', () => {
    const second: StoredEntry = {
      ...entry,
      slug: 'event-loop',
      title: 'Event Loop',
      type: 'knowledge',
    }
    const output = formatEntryTable([entry, second])
    expect(output).toContain('react-hooks')
    expect(output).toContain('event-loop')
  })
})
