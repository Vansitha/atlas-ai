import { claudeCliTransport } from './transport/claude-cli.js'
import { opencodeCliTransport } from './transport/opencode-cli.js'
import { anthropicSdkTransport } from './transport/anthropic-sdk.js'
import { NoAiProviderError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'
import type { AITransport } from '../types/index.js'

const TRANSPORTS: AITransport[] = [
  claudeCliTransport,
  opencodeCliTransport,
  anthropicSdkTransport,
]

export async function resolveTransport(): Promise<AITransport> {
  for (const transport of TRANSPORTS) {
    if (await transport.available()) {
      logger.debug(`Using AI transport: ${transport.name}`)
      return transport
    }
  }
  throw new NoAiProviderError()
}
