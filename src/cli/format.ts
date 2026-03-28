import type { StoredEntry } from '../types/index.js'

const COL_SLUG = 20
const COL_TITLE = 30
const COL_TYPE = 10
const COL_TAGS = 24
const COL_DATE = 12

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '…' : str
}

function row(...cols: string[]): string {
  return cols.join('  ')
}

export function formatEntryTable(entries: readonly StoredEntry[]): string {
  const header = row(
    'SLUG'.padEnd(COL_SLUG),
    'TITLE'.padEnd(COL_TITLE),
    'TYPE'.padEnd(COL_TYPE),
    'TAGS'.padEnd(COL_TAGS),
    'CAPTURED',
  )
  const divider = '-'.repeat(COL_SLUG + COL_TITLE + COL_TYPE + COL_TAGS + COL_DATE + 8)

  const lines = entries.map((e) => {
    const date = e.capturedAt.slice(0, 10)
    return row(
      truncate(e.slug, COL_SLUG).padEnd(COL_SLUG),
      truncate(e.title, COL_TITLE).padEnd(COL_TITLE),
      e.type.padEnd(COL_TYPE),
      truncate(e.tags.join(', '), COL_TAGS).padEnd(COL_TAGS),
      date,
    )
  })

  return [header, divider, ...lines].join('\n')
}
