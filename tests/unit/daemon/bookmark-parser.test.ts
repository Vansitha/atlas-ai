import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}))

const { readFileSync } = await import('node:fs')
const { parseBookmarkFolder } = await import('../../../src/daemon/bookmark-parser.js')

const mockReadFileSync = vi.mocked(readFileSync)

function makeBookmarks(roots: Record<string, unknown>) {
  return JSON.stringify({ roots })
}

function urlNode(name: string, url: string) {
  return { type: 'url', name, url }
}

function folderNode(name: string, children: unknown[]) {
  return { type: 'folder', name, children }
}

const BOOKMARKS_PATH = '/fake/Bookmarks'
const FOLDER = 'Atlas'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('parseBookmarkFolder', () => {
  it('returns URLs from a matching folder in bookmark_bar', () => {
    mockReadFileSync.mockReturnValue(
      makeBookmarks({
        bookmark_bar: folderNode('Bookmarks bar', [
          folderNode('Atlas', [
            urlNode('React Hooks', 'https://react.dev/learn'),
            urlNode('MDN Promises', 'https://developer.mozilla.org/promises'),
          ]),
        ]),
        other: folderNode('Other', []),
        synced: folderNode('Synced', []),
      }) as unknown as Buffer,
    )

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, FOLDER)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ name: 'React Hooks', url: 'https://react.dev/learn' })
    expect(entries[1]).toEqual({
      name: 'MDN Promises',
      url: 'https://developer.mozilla.org/promises',
    })
  })

  it('finds folder nested inside another folder', () => {
    mockReadFileSync.mockReturnValue(
      makeBookmarks({
        bookmark_bar: folderNode('Bookmarks bar', [
          folderNode('Dev', [
            folderNode('Atlas', [urlNode('TypeScript Handbook', 'https://typescriptlang.org')]),
          ]),
        ]),
        other: folderNode('Other', []),
        synced: folderNode('Synced', []),
      }) as unknown as Buffer,
    )

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, FOLDER)
    expect(entries).toHaveLength(1)
    expect(entries[0].url).toBe('https://typescriptlang.org')
  })

  it('finds folder in other root when not in bookmark_bar', () => {
    mockReadFileSync.mockReturnValue(
      makeBookmarks({
        bookmark_bar: folderNode('Bookmarks bar', []),
        other: folderNode('Other', [
          folderNode('Atlas', [urlNode('Node.js Docs', 'https://nodejs.org')]),
        ]),
        synced: folderNode('Synced', []),
      }) as unknown as Buffer,
    )

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, FOLDER)
    expect(entries).toHaveLength(1)
    expect(entries[0].url).toBe('https://nodejs.org')
  })

  it('is case-insensitive when matching folder name', () => {
    mockReadFileSync.mockReturnValue(
      makeBookmarks({
        bookmark_bar: folderNode('Bookmarks bar', [
          folderNode('atlas', [urlNode('Some Page', 'https://example.com')]),
        ]),
        other: folderNode('Other', []),
        synced: folderNode('Synced', []),
      }) as unknown as Buffer,
    )

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, 'ATLAS')
    expect(entries).toHaveLength(1)
  })

  it('returns empty array when folder does not exist', () => {
    mockReadFileSync.mockReturnValue(
      makeBookmarks({
        bookmark_bar: folderNode('Bookmarks bar', [
          folderNode('Personal', [urlNode('Gmail', 'https://gmail.com')]),
        ]),
        other: folderNode('Other', []),
        synced: folderNode('Synced', []),
      }) as unknown as Buffer,
    )

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, FOLDER)
    expect(entries).toEqual([])
  })

  it('returns empty array when file does not exist', () => {
    mockReadFileSync.mockImplementation(() => {
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      throw err
    })

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, FOLDER)
    expect(entries).toEqual([])
  })

  it('returns empty array when file contains malformed JSON', () => {
    mockReadFileSync.mockReturnValue('not valid json {{{{' as unknown as Buffer)

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, FOLDER)
    expect(entries).toEqual([])
  })

  it('returns empty array when roots field is missing', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: 1 }) as unknown as Buffer)

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, FOLDER)
    expect(entries).toEqual([])
  })

  it('ignores subfolders inside the Atlas folder (only direct URL children)', () => {
    mockReadFileSync.mockReturnValue(
      makeBookmarks({
        bookmark_bar: folderNode('Bookmarks bar', [
          folderNode('Atlas', [
            urlNode('Direct URL', 'https://direct.com'),
            folderNode('Subfolder', [urlNode('Nested URL', 'https://nested.com')]),
          ]),
        ]),
        other: folderNode('Other', []),
        synced: folderNode('Synced', []),
      }) as unknown as Buffer,
    )

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, FOLDER)
    expect(entries).toHaveLength(1)
    expect(entries[0].url).toBe('https://direct.com')
  })

  it('returns empty array when the Atlas folder has no URL children', () => {
    mockReadFileSync.mockReturnValue(
      makeBookmarks({
        bookmark_bar: folderNode('Bookmarks bar', [
          folderNode('Atlas', [folderNode('SubA', []), folderNode('SubB', [])]),
        ]),
        other: folderNode('Other', []),
        synced: folderNode('Synced', []),
      }) as unknown as Buffer,
    )

    const entries = parseBookmarkFolder(BOOKMARKS_PATH, FOLDER)
    expect(entries).toEqual([])
  })
})
