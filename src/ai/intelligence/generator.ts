import { generationResponseSchema } from '../../schemas/generation.js'
import { buildGenerationPrompt } from '../prompts/generation.js'
import { ClassificationError } from '../../utils/errors.js'
import { logger } from '../../utils/logger.js'
import type { AITransport, ExtractedContent } from '../../types/index.js'
import type { ClassificationResponse } from '../../schemas/classification.js'
import type { GenerationResponse } from '../../schemas/generation.js'

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch?.[1]) {
      try {
        return JSON.parse(fenceMatch[1])
      } catch {
        // fall through
      }
    }
    const braceMatch = raw.match(/\{[\s\S]*\}/)
    if (braceMatch?.[0]) {
      try {
        return JSON.parse(braceMatch[0])
      } catch {
        // fall through
      }
    }
    throw new Error('No valid JSON found in response')
  }
}

export async function generate(
  transport: AITransport,
  content: ExtractedContent,
  classification: ClassificationResponse,
): Promise<GenerationResponse> {
  const prompt = buildGenerationPrompt(content, classification)

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await transport.send(prompt)
      logger.debug(`Generation raw response (attempt ${attempt}): ${raw.slice(0, 200)}`)
      const parsed = extractJson(raw)
      return generationResponseSchema.parse(parsed)
    } catch (err) {
      if (attempt === 2) {
        const message = err instanceof Error ? err.message : String(err)
        throw new ClassificationError(
          `Generation failed after 2 attempts: ${message}`,
        )
      }
      logger.debug(`Generation attempt ${attempt} failed, retrying...`)
    }
  }

  throw new ClassificationError('Generation failed')
}
