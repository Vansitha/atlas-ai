import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import * as clack from '@clack/prompts'
import type { Command } from 'commander'
import { loadConfig } from '../../config/loader.js'
import { ATLAS_HOME } from '../../storage/paths.js'
import { intro, outro, fail } from '../ui.js'
import type { KnowledgeApp } from '../../types/index.js'

// The official Obsidian CLI binary lives inside the app bundle
const OBSIDIAN_CLI_BUNDLE_PATH = '/Applications/Obsidian.app/Contents/MacOS/obsidian'
const OBSIDIAN_CLI_BUNDLE_DIR = '/Applications/Obsidian.app/Contents/MacOS'

interface ObsidianVaultEntry {
  path: string
  ts: number
  open?: boolean
}
interface ObsidianRegistry {
  vaults: Record<string, ObsidianVaultEntry>
}

function obsidianRegistryPath(): string | null {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'obsidian', 'obsidian.json')
  }
  if (process.platform === 'linux') {
    return join(homedir(), '.config', 'obsidian', 'obsidian.json')
  }
  if (process.platform === 'win32') {
    return join(
      process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
      'obsidian',
      'obsidian.json',
    )
  }
  return null
}

function obsidianCliInPath(): boolean {
  const result = spawnSync('which', ['obsidian'], { encoding: 'utf-8' })
  return result.status === 0
}

function obsidianAppInstalled(): boolean {
  return (
    existsSync('/Applications/Obsidian.app') ||
    existsSync(join(homedir(), 'Applications', 'Obsidian.app'))
  )
}

function obsidianCliBinaryExists(): boolean {
  return existsSync(OBSIDIAN_CLI_BUNDLE_PATH)
}

function detectShellRcFile(): string {
  const shell = process.env.SHELL ?? ''
  if (shell.includes('zsh')) return join(homedir(), '.zshrc')
  if (shell.includes('bash')) return join(homedir(), '.bashrc')
  return join(homedir(), '.profile')
}

const PATH_MARKER = '# obsidian-cli'
const PATH_EXPORT = `export PATH="$PATH:${OBSIDIAN_CLI_BUNDLE_DIR}"  # obsidian-cli`

function addObsidianCliToPath(): void {
  const rcFile = detectShellRcFile()
  const existing = existsSync(rcFile) ? readFileSync(rcFile, 'utf-8') : ''
  if (existing.includes(PATH_MARKER)) return
  appendFileSync(rcFile, `\n${PATH_EXPORT}\n`, 'utf-8')
}

function registerObsidianVault(vaultPath: string): string | null {
  mkdirSync(join(vaultPath, '.obsidian'), { recursive: true })

  const registryPath = obsidianRegistryPath()
  if (!registryPath || !existsSync(registryPath)) return null

  const registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as ObsidianRegistry

  const existing = Object.entries(registry.vaults).find(([, v]) => v.path === vaultPath)
  if (existing) return existing[0]

  const id = randomBytes(8).toString('hex')
  registry.vaults[id] = { path: vaultPath, ts: Date.now(), open: true }
  writeFileSync(registryPath, JSON.stringify(registry), 'utf-8')
  return id
}

async function ensureObsidianCli(): Promise<boolean> {
  if (obsidianCliInPath()) return true

  if (!obsidianAppInstalled()) {
    fail('Obsidian is not installed. Download it from https://obsidian.md and try again.')
    return false
  }

  if (!obsidianCliBinaryExists()) {
    clack.log.warn(
      'Obsidian CLI is not enabled. To enable it:\n' +
        '  1. Open Obsidian\n' +
        '  2. Go to Settings → General → Command line interface\n' +
        '  3. Click Enable\n' +
        '  4. Re-run `atlas open`',
    )
    return false
  }

  // Binary exists in bundle but isn't in PATH — add it automatically
  clack.log.info('Obsidian CLI found but not in PATH. Adding it now...')
  addObsidianCliToPath()
  clack.log.success(
    `Added Obsidian CLI to PATH in ${detectShellRcFile()}.\n` +
      '  Run: source ~/.zshrc   (or open a new terminal)',
  )
  return true
}

function isObsidianRunning(): boolean {
  if (process.platform !== 'darwin') return false
  const result = spawnSync('pgrep', ['-x', 'Obsidian'], { encoding: 'utf-8' })
  return result.status === 0
}

function quitObsidian(): void {
  execSync(`osascript -e 'tell application "Obsidian" to quit'`, { stdio: 'ignore' })
  // Give it a moment to fully exit
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800)
}

function openWithApp(app: KnowledgeApp, path: string): void {
  switch (app) {
    case 'vscode':
      execSync(`code "${path}"`, { stdio: 'inherit' })
      break
    case 'cursor':
      execSync(`cursor "${path}"`, { stdio: 'inherit' })
      break
    case 'obsidian': {
      const vaultId = registerObsidianVault(path)
      // Obsidian caches the vault registry in memory — quit first so it
      // reads the fresh registry (including our new vault) on relaunch
      if (isObsidianRunning()) {
        quitObsidian()
      }
      // Use the vault ID in the URI so Obsidian opens directly to our vault.
      // Fall back to plain app launch if the registry wasn't writable.
      if (vaultId) {
        execSync(`open "obsidian://open?vault=${vaultId}"`, { stdio: 'inherit' })
      } else {
        execSync(`open -a Obsidian`, { stdio: 'inherit' })
      }
      break
    }
  }
}

export function registerOpenCommand(program: Command): void {
  program
    .command('open')
    .description('Open knowledge files in your configured app (VS Code, Cursor, or Obsidian)')
    .option('--app <app>', 'Override the app to use (vscode, cursor, obsidian)')
    .action(async (options: { app?: string }) => {
      intro('open')

      const config = loadConfig()
      const appOverride = options.app as KnowledgeApp | undefined
      const app = appOverride ?? config.knowledgeApp

      if (!app) {
        fail(
          'No knowledge app configured. Run `atlas init` to set one, or use --app vscode|cursor|obsidian',
        )
        process.exit(1)
      }

      const validApps: KnowledgeApp[] = ['vscode', 'cursor', 'obsidian']
      if (!validApps.includes(app)) {
        fail(`Unknown app "${app}". Valid options: vscode, cursor, obsidian`)
        process.exit(1)
      }

      if (app === 'obsidian') {
        const cliReady = await ensureObsidianCli()
        if (!cliReady) {
          process.exit(1)
        }
      }

      try {
        openWithApp(app, ATLAS_HOME)
        outro(`Opened ${ATLAS_HOME} in ${app}`)
      } catch (err) {
        fail(
          `Could not open ${app}. Make sure it is installed and available in your PATH.\n` +
            `  ${err instanceof Error ? err.message : String(err)}`,
        )
        process.exit(1)
      }
    })
}
