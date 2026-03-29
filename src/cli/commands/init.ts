import { existsSync, mkdirSync } from 'node:fs'
import * as clack from '@clack/prompts'
import type { Command } from 'commander'
import { loadConfig, updateConfig } from '../../config/loader.js'
import { ATLAS_HOME, CONFIG_PATH, listBrowserProfiles, findBookmarksPath, ensureBookmarkFolder } from '../../storage/paths.js'
import { detectBrowsers, detectCodingTools, detectAiProviders } from '../detect.js'
import { syncAll } from '../../providers/registry.js'
import { intro, outro, fail } from '../ui.js'
import type { BrowserChoice, AiProviderType, CodingTool, AtlasConfig } from '../../types/index.js'

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

  const browserOptions: { value: BrowserChoice; label: string; hint?: string }[] = [
    { value: 'chrome', label: 'Chrome', hint: detectedBrowsers.includes('chrome') ? 'detected' : undefined },
    { value: 'brave', label: 'Brave', hint: detectedBrowsers.includes('brave') ? 'detected' : undefined },
    { value: 'arc', label: 'Arc', hint: detectedBrowsers.includes('arc') ? 'detected' : undefined },
    { value: 'edge', label: 'Edge', hint: detectedBrowsers.includes('edge') ? 'detected' : undefined },
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
      const created = ensureBookmarkFolder(bookmarksPath, bookmarkFolder)
      if (created) {
        clack.log.success(`Created "${bookmarkFolder}" bookmark folder in your browser's bookmark bar.`)
      } else {
        clack.log.info(`"${bookmarkFolder}" bookmark folder already exists.`)
      }
    }
  }

  // Step 2: Coding tools
  const detectedTools = detectCodingTools()

  const toolOptions: { value: CodingTool; label: string; hint?: string }[] = [
    { value: 'claude-code', label: 'Claude Code', hint: detectedTools.includes('claude-code') ? 'detected' : undefined },
    { value: 'cursor', label: 'Cursor', hint: detectedTools.includes('cursor') ? 'detected' : undefined },
    { value: 'copilot', label: 'GitHub Copilot', hint: detectedTools.includes('copilot') ? 'detected' : undefined },
    { value: 'windsurf', label: 'Windsurf', hint: detectedTools.includes('windsurf') ? 'detected' : undefined },
  ]

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
      updateConfig({ browser: browserChoice as BrowserChoice, browserProfile, codingTools: selectedTools })
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
      hint: detectedValues.includes('anthropic-sdk') ? 'ANTHROPIC_API_KEY set' : 'set ANTHROPIC_API_KEY',
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

  // Save final config
  const aiProvider = providerChoice === 'skip' ? null : (providerChoice as AiProviderType)

  const finalConfig = updateConfig({
    browser: browserChoice as BrowserChoice,
    browserProfile,
    codingTools: selectedTools,
    aiProvider,
    daemon: {
      enabled: false,
      bookmarkFolder,
      debounceMs: 2000,
    },
  })

  clack.note(
    [
      `Browser:      ${finalConfig.browser ?? 'none (manual capture only)'}`,
      `Coding tools: ${finalConfig.codingTools.length > 0 ? finalConfig.codingTools.join(', ') : 'none'}`,
      `AI provider:  ${finalConfig.aiProvider ?? 'none'}`,
    ].join('\n'),
    'Configuration saved',
  )

  if (!aiProvider) {
    clack.log.warn(
      'No AI provider selected. Set ANTHROPIC_API_KEY or install Claude CLI to enable auto-classification.',
    )
  }

  outro(
    'Setup complete! Try these commands:\n' +
    '  atlas capture <url>       Capture a URL\n' +
    '  atlas list                See all entries\n' +
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
