import type { AITransport } from '../../types/index.js'
import { logger } from '../../utils/logger.js'

const MODEL = 'claude-sonnet-4-5-20251001'
const MAX_TOKENS = 4096

export const anthropicSdkTransport: AITransport = {
  name: 'anthropic-sdk',

  async available(): Promise<boolean> {
    return Boolean(process.env['ANTHROPIC_API_KEY'])
  },

  async send(prompt: string): Promise<string> {
    logger.debug('Sending prompt via Anthropic SDK')
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = response.content[0]
    if (!block || block.type !== 'text') {
      throw new Error('Unexpected response format from Anthropic SDK')
    }
    return block.text.trim()
  },
}
