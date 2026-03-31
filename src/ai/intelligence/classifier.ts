import { classificationResponseSchema } from '../../schemas/classification.js'
import { buildClassificationPrompt } from '../prompts/classification.js'
import { ClassificationError } from '../../utils/errors.js'
import { logger } from '../../utils/logger.js'
import type { AITransport, ExtractedContent, OutputType } from '../../types/index.js'
import type { ClassificationResponse } from '../../schemas/classification.js'

function extractJson(raw: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(raw)
  } catch {
    // Extract JSON from markdown code fences
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch?.[1]) {
      try {
        return JSON.parse(fenceMatch[1])
      } catch {
        // fall through
      }
    }
    // Extract first {...} block
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

export async function classify(
  transport: AITransport,
  content: ExtractedContent,
  forceType?: OutputType,
): Promise<ClassificationResponse> {
  if (forceType) {
    return {
      type: forceType,
      confidence: 1,
      reasoning: 'User-specified type override',
      suggestedTitle: content.title,
      suggestedTags: [],
      suggestedSlug: content.title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')
        .slice(0, 60),
    }
  }

  const prompt = buildClassificationPrompt(content)

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await transport.send(prompt)
      logger.debug(`Classification raw response (attempt ${attempt}): ${raw.slice(0, 200)}`)
      const parsed = extractJson(raw)
      return classificationResponseSchema.parse(parsed)
    } catch (err) {
      if (attempt === 2) {
        const message = err instanceof Error ? err.message : String(err)
        throw new ClassificationError(`Classification failed after 2 attempts: ${message}`)
      }
      logger.debug(`Classification attempt ${attempt} failed, retrying...`)
    }
  }

  throw new ClassificationError('Classification failed')
}
