import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { findBookmarksPath } from '../storage/paths.js'
import { getAllProviders } from '../providers/registry.js'
import type { BrowserChoice, AiProviderType, CodingTool, KnowledgeApp } from '../types/index.js'

const ALL_BROWSERS: BrowserChoice[] = ['chrome', 'brave', 'arc', 'edge']

const MAC_BROWSER_APPS: Record<string, string[]> = {
  chrome: ['/Applications/Google Chrome.app', join(homedir(), 'Applications', 'Google Chrome.app')],
  brave: ['/Applications/Brave Browser.app', join(homedir(), 'Applications', 'Brave Browser.app')],
  arc: ['/Applications/Arc.app', join(homedir(), 'Applications', 'Arc.app')],
  edge: ['/Applications/Microsoft Edge.app', join(homedir(), 'Applications', 'Microsoft Edge.app')],
}

function browserAppInstalled(browser: string): boolean {
  if (process.platform === 'darwin') {
    return (MAC_BROWSER_APPS[browser] ?? []).some((p) => existsSync(p))
  }
  // On Windows/Linux the profile directory existing is sufficient signal
  return true
}

export function detectBrowsers(): BrowserChoice[] {
  return ALL_BROWSERS.filter(
    (browser) => browserAppInstalled(browser) && findBookmarksPath(browser) !== null,
  )
}

export function detectCodingTools(): CodingTool[] {
  return getAllProviders()
    .filter((p) => p.detected())
    .map((p) => p.name as CodingTool)
}

export interface DetectedAiProvider {
  readonly value: AiProviderType
  readonly label: string
  readonly hint: string
}

function commandExists(cmd: string): boolean {
  const finder = process.platform === 'win32' ? 'where' : 'which'
  try {
    execSync(`${finder} ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function detectAiProviders(): DetectedAiProvider[] {
  const results: DetectedAiProvider[] = []

  if (commandExists('claude')) {
    results.push({ value: 'claude-cli', label: 'Claude CLI', hint: 'detected' })
  }
  if (commandExists('opencode')) {
    results.push({ value: 'opencode-cli', label: 'OpenCode CLI', hint: 'detected' })
  }
  results.push({
    value: 'anthropic-sdk',
    label: 'Anthropic SDK',
    hint: process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY set' : 'requires ANTHROPIC_API_KEY',
  })

  return results
}

function obsidianDetected(): boolean {
  if (process.platform === 'darwin') {
    return (
      existsSync('/Applications/Obsidian.app') ||
      existsSync(join(homedir(), 'Applications', 'Obsidian.app'))
    )
  }
  if (process.platform === 'linux') return commandExists('obsidian')
  if (process.platform === 'win32') return commandExists('obsidian')
  return false
}

export function detectKnowledgeApps(): KnowledgeApp[] {
  const detected: KnowledgeApp[] = []
  if (commandExists('code')) detected.push('vscode')
  if (commandExists('cursor')) detected.push('cursor')
  if (obsidianDetected()) detected.push('obsidian')
  return detected
}
