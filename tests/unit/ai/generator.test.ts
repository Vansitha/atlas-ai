import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generate } from '../../../src/ai/intelligence/generator.js'
import type { AITransport, ExtractedContent } from '../../../src/types/index.js'
import type { ClassificationResponse } from '../../../src/schemas/classification.js'

const generationResponse = readFileSync(
  join(process.cwd(), 'tests/fixtures/ai-responses/generation-skill.json'),
  'utf-8',
)

const sampleContent: ExtractedContent = {
  url: 'https://example.com/react-hooks',
  title: 'React Hooks Guide',
  body: 'A comprehensive guide to React hooks with examples',
  metadata: {},
  extractedAt: new Date().toISOString(),
  extractorName: 'html',
}

const sampleClassification: ClassificationResponse = {
  type: 'skill',
  confidence: 0.95,
  reasoning: 'How-to guide with code examples',
  suggestedTitle: 'React Hooks Patterns',
  suggestedTags: ['react', 'hooks'],
  suggestedSlug: 'react-hooks-patterns',
}

function mockTransport(response: string): AITransport {
  return {
    name: 'mock',
    available: vi.fn().mockResolvedValue(true),
    send: vi.fn().mockResolvedValue(response),
  }
}

describe('generate', () => {
  it('generates a valid skill response', async () => {
    const transport = mockTransport(generationResponse)
    const result = await generate(transport, sampleContent, sampleClassification)
    expect(result.markdown).toContain('React Hooks')
    expect(result.title).toBe('React Hooks Patterns')
    expect(result.tags).toContain('react')
  })

  it('parses JSON in markdown code fences', async () => {
    const fenced = `\`\`\`json\n${generationResponse}\n\`\`\``
    const transport = mockTransport(fenced)
    const result = await generate(transport, sampleContent, sampleClassification)
    expect(result.title).toBe('React Hooks Patterns')
  })

  it('retries once and throws after two failures', async () => {
    const transport: AITransport = {
      name: 'mock',
      available: vi.fn().mockResolvedValue(true),
      send: vi.fn().mockResolvedValue('invalid json'),
    }
    await expect(generate(transport, sampleContent, sampleClassification)).rejects.toThrow(
      'Generation failed',
    )
    expect(transport.send).toHaveBeenCalledTimes(2)
  })

  it('rejects response missing required fields', async () => {
    const transport = mockTransport('{"markdown": "some content"}')
    await expect(generate(transport, sampleContent, sampleClassification)).rejects.toThrow()
  })
})
