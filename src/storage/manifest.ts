import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { manifestSchema } from '../schemas/manifest.js'
import { MANIFEST_PATH } from './paths.js'
import type { Manifest, ManifestEntry } from '../schemas/manifest.js'
import type { StoredEntry } from '../types/index.js'

function emptyManifest(): Manifest {
  return { version: 1, entries: [], lastUpdated: new Date().toISOString() }
}

export function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return emptyManifest()
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  return manifestSchema.parse(raw)
}

export function saveManifest(manifest: Manifest): void {
  const dir = dirname(MANIFEST_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const validated = manifestSchema.parse(manifest)
  writeFileSync(MANIFEST_PATH, JSON.stringify(validated, null, 2), 'utf-8')
}

export function addEntry(entry: ManifestEntry): void {
  const manifest = loadManifest()
  const updated: Manifest = {
    ...manifest,
    entries: [...manifest.entries, entry],
    lastUpdated: new Date().toISOString(),
  }
  saveManifest(updated)
}

export function removeEntry(slug: string): void {
  const manifest = loadManifest()
  const updated: Manifest = {
    ...manifest,
    entries: manifest.entries.filter((e) => e.slug !== slug),
    lastUpdated: new Date().toISOString(),
  }
  saveManifest(updated)
}

export function findByUrlHash(urlHash: string): ManifestEntry | undefined {
  return loadManifest().entries.find((e) => e.urlHash === urlHash)
}

export function findBySlug(slug: string): ManifestEntry | undefined {
  return loadManifest().entries.find((e) => e.slug === slug || e.slug.startsWith(slug))
}

export function search(query: string): ManifestEntry[] {
  const q = query.toLowerCase()
  return loadManifest().entries.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q)) ||
      e.sourceUrl.toLowerCase().includes(q),
  )
}

export function listEntries(type?: 'skill' | 'knowledge'): StoredEntry[] {
  const entries = loadManifest().entries
  const filtered = type ? entries.filter((e) => e.type === type) : entries
  return filtered.map((e) => ({ ...e, tags: [...e.tags] }))
}
