import type { AtlasConfig } from '../types/index.js'

export function defaultConfig(): AtlasConfig {
  const now = new Date().toISOString()
  return {
    version: 1,
    browser: null,
    browserProfile: null,
    codingTools: [],
    aiProvider: null,
    daemon: {
      enabled: false,
      bookmarkFolder: 'Atlas',
      debounceMs: 2000,
    },
    createdAt: now,
    updatedAt: now,
  }
}
