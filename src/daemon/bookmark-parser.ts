import { readFileSync } from 'node:fs'

interface BookmarkNode {
  type: 'url' | 'folder'
  name: string
  url?: string
  children?: BookmarkNode[]
}

interface BookmarkFile {
  roots: Record<string, BookmarkNode>
}

export interface BookmarkEntry {
  name: string
  url: string
}

function findFolder(node: BookmarkNode, folderName: string): BookmarkNode | null {
  if (node.type === 'folder' && node.name.toLowerCase() === folderName.toLowerCase()) {
    return node
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findFolder(child, folderName)
      if (found) return found
    }
  }
  return null
}

function extractUrls(folder: BookmarkNode): BookmarkEntry[] {
  if (!folder.children) return []
  return folder.children
    .filter(
      (node): node is BookmarkNode & { url: string } =>
        node.type === 'url' && typeof node.url === 'string',
    )
    .map((node) => ({ name: node.name, url: node.url }))
}

export function parseBookmarkFolder(bookmarksPath: string, folderName: string): BookmarkEntry[] {
  let raw: string
  try {
    raw = readFileSync(bookmarksPath, 'utf-8')
  } catch {
    return []
  }

  let data: BookmarkFile
  try {
    data = JSON.parse(raw) as BookmarkFile
  } catch {
    return []
  }

  if (!data.roots || typeof data.roots !== 'object') return []

  for (const root of Object.values(data.roots)) {
    const folder = findFolder(root, folderName)
    if (folder) return extractUrls(folder)
  }

  return []
}
