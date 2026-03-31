import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const ATLAS_HOME = join(homedir(), '.ai-knowledge')
export const SKILLS_DIR = join(ATLAS_HOME, 'skills')
export const KNOWLEDGE_DIR = join(ATLAS_HOME, 'knowledge')
export const CONFIG_PATH = join(ATLAS_HOME, 'config.json')
export const MANIFEST_PATH = join(ATLAS_HOME, '.index.json')
export const CONTENT_CACHE_PATH = join(ATLAS_HOME, '.content-cache.json')
export const ACCURACY_LOG_PATH = join(ATLAS_HOME, '.accuracy-log.jsonl')
export const DAEMON_PID_PATH = join(ATLAS_HOME, '.daemon.pid')
export const DAEMON_HEARTBEAT_PATH = join(ATLAS_HOME, '.daemon.heartbeat')
export const DAEMON_LOG_PATH = join(ATLAS_HOME, '.daemon.log')

const isWindows = process.platform === 'win32'

// LOCALAPPDATA is always set for interactive Windows sessions;
// the fallback covers service accounts and restricted environments
const winBase = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
const macBase = join(homedir(), 'Library', 'Application Support')

// Default profile paths — used as the first candidate in findBookmarksPath
export const BROWSER_BOOKMARK_PATHS: Record<string, string> = isWindows
  ? {
      chrome: join(winBase, 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks'),
      brave: join(winBase, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Bookmarks'),
      edge: join(winBase, 'Microsoft', 'Edge', 'User Data', 'Default', 'Bookmarks'),
      arc: join(winBase, 'Arc', 'User Data', 'Default', 'Bookmarks'),
    }
  : {
      chrome: join(macBase, 'Google', 'Chrome', 'Default', 'Bookmarks'),
      brave: join(macBase, 'BraveSoftware', 'Brave-Browser', 'Default', 'Bookmarks'),
      arc: join(macBase, 'Arc', 'User Data', 'Default', 'Bookmarks'),
      edge: join(macBase, 'Microsoft Edge', 'Default', 'Bookmarks'),
    }

// Browser root dirs to scan for named profiles when Default doesn't exist
const BROWSER_PROFILE_ROOTS: Record<string, string> = isWindows
  ? {
      chrome: join(winBase, 'Google', 'Chrome', 'User Data'),
      brave: join(winBase, 'BraveSoftware', 'Brave-Browser', 'User Data'),
      edge: join(winBase, 'Microsoft', 'Edge', 'User Data'),
    }
  : {
      chrome: join(macBase, 'Google', 'Chrome'),
      brave: join(macBase, 'BraveSoftware', 'Brave-Browser'),
      edge: join(macBase, 'Microsoft Edge'),
    }

export interface BrowserProfile {
  dir: string
  name: string
}

/**
 * Lists all real browser profiles by checking for a Preferences file.
 * A Bookmarks file is not required — Chrome only creates it after the first bookmark.
 * Reads each profile's Preferences file to get the human-readable name.
 */
export function listBrowserProfiles(browser: string): BrowserProfile[] {
  const profileRoot = BROWSER_PROFILE_ROOTS[browser]
  if (!profileRoot || !existsSync(profileRoot)) return []

  let entries: string[]
  try {
    entries = readdirSync(profileRoot)
  } catch {
    return []
  }

  const results: BrowserProfile[] = []

  for (const dir of entries) {
    // A real profile always has a Preferences file; skip system/cache dirs
    const prefsFile = join(profileRoot, dir, 'Preferences')
    if (!existsSync(prefsFile)) continue

    let profileName = dir
    try {
      const prefs = JSON.parse(readFileSync(prefsFile, 'utf-8')) as Record<string, unknown>
      const name = (prefs?.profile as Record<string, unknown>)?.name
      if (typeof name === 'string' && name.trim()) profileName = name.trim()
    } catch {}

    results.push({ dir, name: profileName })
  }

  return results.sort((a, b) => {
    if (a.dir === 'Default') return -1
    if (b.dir === 'Default') return 1
    const numA = parseInt(a.dir.replace(/\D/g, ''), 10)
    const numB = parseInt(b.dir.replace(/\D/g, ''), 10)
    return (isNaN(numA) ? 999 : numA) - (isNaN(numB) ? 999 : numB)
  })
}

interface ChromeBookmarkNode {
  id: string
  name: string
  type: 'folder' | 'url'
  children?: ChromeBookmarkNode[]
  date_added?: string
  date_modified?: string
}

interface ChromeBookmarksFile {
  checksum: string
  roots: {
    bookmark_bar: ChromeBookmarkNode
    other: ChromeBookmarkNode
    synced: ChromeBookmarkNode
  }
  version: number
}

function findMaxBookmarkId(node: ChromeBookmarkNode): number {
  const id = parseInt(node.id, 10)
  let max = isNaN(id) ? 0 : id
  for (const child of node.children ?? []) {
    max = Math.max(max, findMaxBookmarkId(child))
  }
  return max
}

function bookmarkFolderExists(node: ChromeBookmarkNode, name: string): boolean {
  for (const child of node.children ?? []) {
    if (child.type === 'folder' && child.name.toLowerCase() === name.toLowerCase()) return true
    if (bookmarkFolderExists(child, name)) return true
  }
  return false
}

export type EnsureBookmarkFolderResult = 'created' | 'exists' | 'no-file'

// Chrome timestamps: microseconds since 1601-01-01
const MS_EPOCH_DIFF = 11644473600000n
function chromeTimestamp(): string {
  return ((BigInt(Date.now()) + MS_EPOCH_DIFF) * 1000n).toString()
}

function makeEmptyBookmarksFile(): ChromeBookmarksFile {
  const ts = chromeTimestamp()
  return {
    checksum: '',
    roots: {
      bookmark_bar: {
        id: '1',
        name: 'Bookmarks bar',
        type: 'folder',
        children: [],
        date_added: ts,
        date_modified: '0',
      },
      other: {
        id: '2',
        name: 'Other bookmarks',
        type: 'folder',
        children: [],
        date_added: ts,
        date_modified: '0',
      },
      synced: {
        id: '3',
        name: 'Mobile bookmarks',
        type: 'folder',
        children: [],
        date_added: ts,
        date_modified: '0',
      },
    },
    version: 1,
  }
}

/**
 * Creates the named folder in Chrome's bookmark bar if it doesn't already exist.
 * If the bookmarks file is missing, creates it with a minimal Chrome-compatible structure.
 * Returns 'created' if the folder was added, 'exists' if it was already present,
 * or 'no-file' if the bookmarks file could not be written.
 * Chrome will recalculate the checksum on its next write.
 */
export function ensureBookmarkFolder(
  bookmarksPath: string,
  folderName: string,
): EnsureBookmarkFolderResult {
  let data: ChromeBookmarksFile

  const fileExists = existsSync(bookmarksPath)
  if (fileExists) {
    try {
      data = JSON.parse(readFileSync(bookmarksPath, 'utf-8')) as ChromeBookmarksFile
    } catch {
      return 'no-file'
    }
  } else {
    data = makeEmptyBookmarksFile()
  }

  const roots = [data.roots.bookmark_bar, data.roots.other, data.roots.synced]
  if (roots.some((root) => bookmarkFolderExists(root, folderName))) return 'exists'

  const maxId = Math.max(...roots.map(findMaxBookmarkId))
  const timestamp = chromeTimestamp()

  const newFolder: ChromeBookmarkNode = {
    children: [],
    date_added: timestamp,
    date_modified: timestamp,
    id: String(maxId + 1),
    name: folderName,
    type: 'folder',
  }

  data.roots.bookmark_bar.children = [...(data.roots.bookmark_bar.children ?? []), newFolder]
  data.checksum = '' // Chrome recalculates on next write

  try {
    mkdirSync(dirname(bookmarksPath), { recursive: true })
    writeFileSync(bookmarksPath, JSON.stringify(data, null, 3), 'utf-8')
    return 'created'
  } catch {
    return 'no-file'
  }
}

/**
 * Returns the bookmarks file path for the given browser.
 * If profileDir is provided, uses that profile directory directly.
 * Otherwise tries the Default profile first, then falls back to the first
 * named profile directory (e.g. "Profile 1") that contains a Bookmarks file.
 * Returns null if no bookmarks file can be found.
 */
export function findBookmarksPath(browser: string, profileDir?: string | null): string | null {
  const profileRoot = BROWSER_PROFILE_ROOTS[browser]

  if (profileDir && profileRoot) {
    // Return the path even if Bookmarks doesn't exist yet — Chrome creates it
    // on the first bookmark, and chokidar will pick it up when it appears.
    const candidate = join(profileRoot, profileDir, 'Bookmarks')
    if (existsSync(join(profileRoot, profileDir, 'Preferences'))) return candidate
  }

  const defaultPath = BROWSER_BOOKMARK_PATHS[browser]
  if (!defaultPath) return null
  if (existsSync(defaultPath)) return defaultPath

  if (!profileRoot || !existsSync(profileRoot)) return null

  let entries: string[]
  try {
    entries = readdirSync(profileRoot)
  } catch {
    return null
  }

  const profileDirs = entries
    .filter((name) => /^Profile \d+$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10)
      const numB = parseInt(b.replace(/\D/g, ''), 10)
      return numA - numB
    })

  for (const dir of profileDirs) {
    const candidate = join(profileRoot, dir, 'Bookmarks')
    if (existsSync(candidate)) return candidate
  }

  return null
}
