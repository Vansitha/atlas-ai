import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as clack from '@clack/prompts'
import type { Command } from 'commander'
import { loadConfig, updateConfig } from '../../config/loader.js'
import {
  ATLAS_HOME,
  CONFIG_PATH,
  listBrowserProfiles,
  findBookmarksPath,
  ensureBookmarkFolder,
} from '../../storage/paths.js'
import {
  detectBrowsers,
  detectCodingTools,
  detectAiProviders,
  detectKnowledgeApps,
} from '../detect.js'
import { syncAll } from '../../providers/registry.js'
import { startDaemon } from '../../daemon/process-manager.js'
import { intro, outro, fail } from '../ui.js'
import type {
  BrowserChoice,
  AiProviderType,
  CodingTool,
  KnowledgeApp,
  AtlasConfig,
} from '../../types/index.js'

const COMPLETION_LINE = 'eval "$(atlas completion)"  # atlas shell completion'
const COMPLETION_MARKER = '# atlas shell completion'

function detectRcFile(): string | null {
  const shell = process.env.SHELL ?? ''
  if (shell.includes('zsh')) return join(homedir(), '.zshrc')
  if (shell.includes('bash')) return join(homedir(), '.bashrc')
  return null
}

export function installShellCompletion(): boolean {
  const rcFile = detectRcFile()
  if (!rcFile) return false
  try {
    const existing = existsSync(rcFile) ? readFileSync(rcFile, 'utf-8') : ''
    if (existing.includes(COMPLETION_MARKER)) return false // already installed
    appendFileSync(rcFile, `\n${COMPLETION_LINE}\n`, 'utf-8')
    return true
  } catch {
    return false
  }
}

export function removeShellCompletion(): boolean {
  const rcFile = detectRcFile()
  if (!rcFile || !existsSync(rcFile)) return false
  try {
    const lines = readFileSync(rcFile, 'utf-8').split('\n')
    const filtered = lines.filter(
      (l) => !l.includes(COMPLETION_MARKER) && !l.includes('atlas completion'),
    )
    const cleaned = filtered.join('\n').replace(/\n{3,}/g, '\n\n')
    writeFileSync(rcFile, cleaned, 'utf-8')
    return true
  } catch {
    return false
  }
}

function savePartialAndExit(partial: Partial<AtlasConfig>): void {
  if (Object.keys(partial).length > 0) {
    updateConfig(partial)
    clack.log.warn('Partial configuration saved. Re-run `atlas init` to complete setup.')
  }
  fail('Setup cancelled.')
}

export async function runInitWizard(): Promise<void> {
  intro('setup wizard')

  if (!existsSync(ATLAS_HOME)) {
    mkdirSync(ATLAS_HOME, { recursive: true })
  }

  if (existsSync(CONFIG_PATH)) {
    let isConfigured = false
    try {
      loadConfig()
      isConfigured = true
    } catch {
      // Corrupted config — treat as unconfigured
    }

    if (isConfigured) {
      const rerun = await clack.confirm({
        message: 'Atlas is already configured. Re-run setup?',
      })
      if (clack.isCancel(rerun) || !rerun) {
        outro('Keeping existing configuration.')
        return
      }
    }
  }

  // Step 1: Browser
  const detectedBrowsers = detectBrowsers()

  const BROWSER_LABELS: Record<string, string> = {
    chrome: 'Chrome',
    brave: 'Brave',
    arc: 'Arc',
    edge: 'Edge',
  }
  const browserOptions: { value: BrowserChoice; label: string; hint?: string }[] = [
    ...detectedBrowsers.map((b) => ({ value: b, label: BROWSER_LABELS[b] ?? b, hint: 'detected' })),
    { value: 'skip', label: 'Skip (manual capture only)' },
  ]

  const browserChoice = await clack.select<BrowserChoice>({
    message: 'Which browser bookmarks should Atlas watch?',
    options: browserOptions,
    initialValue: detectedBrowsers[0] ?? 'skip',
  })

  if (clack.isCancel(browserChoice)) {
    savePartialAndExit({})
    return
  }

  // Step 1b: Profile selection (for browsers with named profiles)
  let browserProfile: string | null = null

  if (browserChoice !== 'skip') {
    const profiles = listBrowserProfiles(browserChoice as string)

    if (profiles.length > 1) {
      const profileOptions = profiles.map((p) => ({
        value: p.dir,
        label: p.name,
        hint: p.dir,
      }))

      const profileChoice = await clack.select<string>({
        message: `Which ${browserChoice} profile should Atlas watch?`,
        options: profileOptions,
      })

      if (clack.isCancel(profileChoice)) {
        savePartialAndExit({ browser: browserChoice as BrowserChoice })
        return
      }

      browserProfile = profileChoice as string
    } else if (profiles.length === 1) {
      browserProfile = profiles[0].dir
    }
  }

  // Step 1c: Bookmark folder name
  const folderNameInput = await clack.text({
    message: 'What should the watched bookmark folder be called?',
    placeholder: 'Atlas',
    defaultValue: 'Atlas',
  })

  if (clack.isCancel(folderNameInput)) {
    savePartialAndExit({ browser: browserChoice as BrowserChoice, browserProfile })
    return
  }

  const bookmarkFolder = (folderNameInput as string).trim() || 'Atlas'

  // Create the bookmark folder in the browser if it doesn't exist
  if (browserChoice !== 'skip') {
    const bookmarksPath = findBookmarksPath(browserChoice as string, browserProfile)
    if (bookmarksPath) {
      const result = ensureBookmarkFolder(bookmarksPath, bookmarkFolder)
      if (result === 'created') {
        clack.log.success(
          `Created "${bookmarkFolder}" bookmark folder in your browser's bookmark bar.`,
        )
      } else if (result === 'exists') {
        clack.log.info(`"${bookmarkFolder}" bookmark folder already exists.`)
      } else {
        clack.log.warn(
          `Could not create the "${bookmarkFolder}" bookmark folder. Check that the browser profile directory is writable.`,
        )
      }
    }
  }

  // Step 2: Coding tools
  const detectedTools = detectCodingTools()

  const TOOL_LABELS: Record<string, string> = {
    'claude-code': 'Claude Code',
    cursor: 'Cursor',
    copilot: 'GitHub Copilot',
    windsurf: 'Windsurf',
    opencode: 'OpenCode',
  }
  const toolOptions: { value: CodingTool; label: string; hint: string }[] = detectedTools.map(
    (t) => ({
      value: t,
      label: TOOL_LABELS[t] ?? t,
      hint: 'detected',
    }),
  )

  const toolChoices = await clack.multiselect<CodingTool>({
    message: 'Which coding tools should Atlas sync to?',
    options: toolOptions,
    initialValues: detectedTools,
    required: false,
  })

  if (clack.isCancel(toolChoices)) {
    savePartialAndExit({ browser: browserChoice as BrowserChoice })
    return
  }

  const selectedTools = toolChoices as CodingTool[]

  if (selectedTools.length > 0) {
    const spin = clack.spinner()
    spin.start('Running initial sync...')
    try {
      updateConfig({
        browser: browserChoice as BrowserChoice,
        browserProfile,
        codingTools: selectedTools,
      })
      await syncAll()
      spin.stop('Initial sync complete.')
    } catch {
      spin.stop('Initial sync skipped (no entries yet).')
    }
  }

  // Step 3: AI provider
  const detectedProviders = detectAiProviders()
  const detectedValues = detectedProviders.map((p) => p.value)

  const allProviderOptions: { value: AiProviderType | 'skip'; label: string; hint?: string }[] = [
    {
      value: 'claude-cli',
      label: 'Claude CLI',
      hint: detectedValues.includes('claude-cli') ? 'detected' : 'not detected',
    },
    {
      value: 'opencode-cli',
      label: 'OpenCode CLI',
      hint: detectedValues.includes('opencode-cli') ? 'detected' : 'not detected',
    },
    {
      value: 'anthropic-sdk',
      label: 'Anthropic SDK',
      hint: detectedValues.includes('anthropic-sdk')
        ? 'ANTHROPIC_API_KEY set'
        : 'set ANTHROPIC_API_KEY',
    },
    { value: 'skip', label: 'Skip (use --as flag for manual classification)' },
  ]

  const providerChoice = await clack.select<AiProviderType | 'skip'>({
    message: 'Which AI provider should classify your captures?',
    options: allProviderOptions,
    initialValue: detectedProviders[0]?.value ?? 'skip',
  })

  if (clack.isCancel(providerChoice)) {
    savePartialAndExit({
      browser: browserChoice as BrowserChoice,
      codingTools: selectedTools,
    })
    return
  }

  // Step 4: Knowledge app
  const detectedKnowledgeApps = detectKnowledgeApps()

  const KNOWLEDGE_APP_LABELS: Record<string, string> = {
    vscode: 'VS Code',
    cursor: 'Cursor',
    obsidian: 'Obsidian',
  }
  const knowledgeAppOptions: { value: KnowledgeApp | 'skip'; label: string; hint?: string }[] = [
    ...detectedKnowledgeApps.map((a) => ({
      value: a,
      label: KNOWLEDGE_APP_LABELS[a] ?? a,
      hint: 'detected',
    })),
    { value: 'skip', label: 'Skip' },
  ]

  const knowledgeAppChoice = await clack.select<KnowledgeApp | 'skip'>({
    message: 'Which app should `atlas open` use to browse your knowledge files?',
    options: knowledgeAppOptions,
    initialValue: detectedKnowledgeApps[0] ?? 'skip',
  })

  if (clack.isCancel(knowledgeAppChoice)) {
    savePartialAndExit({
      browser: browserChoice as BrowserChoice,
      codingTools: selectedTools,
      aiProvider: providerChoice === 'skip' ? null : (providerChoice as AiProviderType),
    })
    return
  }

  // Save final config
  const aiProvider = providerChoice === 'skip' ? null : (providerChoice as AiProviderType)
  const knowledgeApp = knowledgeAppChoice === 'skip' ? null : (knowledgeAppChoice as KnowledgeApp)
  const watchingBrowser = browserChoice !== 'skip'

  const finalConfig = updateConfig({
    browser: browserChoice as BrowserChoice,
    browserProfile,
    codingTools: selectedTools,
    aiProvider,
    knowledgeApp,
    daemon: {
      enabled: watchingBrowser,
      bookmarkFolder,
      debounceMs: 2000,
    },
  })

  clack.note(
    [
      `Browser:       ${finalConfig.browser ?? 'none (manual capture only)'}`,
      `Coding tools:  ${finalConfig.codingTools.length > 0 ? finalConfig.codingTools.join(', ') : 'none'}`,
      `AI provider:   ${finalConfig.aiProvider ?? 'none'}`,
      `Knowledge app: ${finalConfig.knowledgeApp ?? 'none'}`,
    ].join('\n'),
    'Configuration saved',
  )

  if (!aiProvider) {
    clack.log.warn(
      'No AI provider selected. Set ANTHROPIC_API_KEY or install Claude CLI to enable auto-classification.',
    )
  }

  const completionInstalled = installShellCompletion()
  if (completionInstalled) {
    clack.log.success('Shell completion installed. Restart your terminal or run: source ~/.zshrc')
  }

  if (watchingBrowser) {
    const spin = clack.spinner()
    spin.start('Starting bookmark watcher...')
    try {
      const { pid } = startDaemon()
      spin.stop(
        `Bookmark watcher started (PID ${pid}). Atlas will capture bookmarks added to "${bookmarkFolder}" automatically.`,
      )
    } catch (err) {
      spin.stop('Could not start bookmark watcher automatically.')
      clack.log.warn(
        `Run \`atlas daemon start\` manually once your browser profile has been opened. (${err instanceof Error ? err.message : String(err)})`,
      )
    }
  }

  const openLine = knowledgeApp ? '  atlas open                Open knowledge files\n' : ''
  outro(
    'Setup complete! Try these commands:\n' +
      '  atlas capture <url>       Capture a URL\n' +
      '  atlas list                See all entries\n' +
      `${openLine}` +
      '  atlas providers status    Check sync status',
  )
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Interactive setup wizard for Atlas')
    .action(async () => {
      try {
        await runInitWizard()
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Setup failed')
        process.exit(1)
      }
    })
}
