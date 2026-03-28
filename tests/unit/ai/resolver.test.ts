import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/ai/transport/claude-cli.js', () => ({
  claudeCliTransport: { name: 'claude-cli', available: vi.fn(), send: vi.fn() },
}))
vi.mock('../../../src/ai/transport/opencode-cli.js', () => ({
  opencodeCliTransport: { name: 'opencode-cli', available: vi.fn(), send: vi.fn() },
}))
vi.mock('../../../src/ai/transport/anthropic-sdk.js', () => ({
  anthropicSdkTransport: { name: 'anthropic-sdk', available: vi.fn(), send: vi.fn() },
}))

const { claudeCliTransport } = await import('../../../src/ai/transport/claude-cli.js')
const { opencodeCliTransport } = await import('../../../src/ai/transport/opencode-cli.js')
const { anthropicSdkTransport } = await import('../../../src/ai/transport/anthropic-sdk.js')
const { resolveTransport } = await import('../../../src/ai/resolver.js')

beforeEach(() => vi.clearAllMocks())

describe('resolveTransport', () => {
  it('returns claude CLI when available', async () => {
    vi.mocked(claudeCliTransport.available).mockResolvedValue(true)
    const transport = await resolveTransport()
    expect(transport.name).toBe('claude-cli')
  })

  it('falls back to opencode when claude CLI unavailable', async () => {
    vi.mocked(claudeCliTransport.available).mockResolvedValue(false)
    vi.mocked(opencodeCliTransport.available).mockResolvedValue(true)
    const transport = await resolveTransport()
    expect(transport.name).toBe('opencode-cli')
  })

  it('falls back to anthropic SDK when CLIs unavailable', async () => {
    vi.mocked(claudeCliTransport.available).mockResolvedValue(false)
    vi.mocked(opencodeCliTransport.available).mockResolvedValue(false)
    vi.mocked(anthropicSdkTransport.available).mockResolvedValue(true)
    const transport = await resolveTransport()
    expect(transport.name).toBe('anthropic-sdk')
  })

  it('throws NoAiProviderError when nothing is available', async () => {
    vi.mocked(claudeCliTransport.available).mockResolvedValue(false)
    vi.mocked(opencodeCliTransport.available).mockResolvedValue(false)
    vi.mocked(anthropicSdkTransport.available).mockResolvedValue(false)
    await expect(resolveTransport()).rejects.toThrow('No AI provider found')
  })
})
