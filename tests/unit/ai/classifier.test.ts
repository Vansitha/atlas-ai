import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { classify } from '../../../src/ai/intelligence/classifier.js'
import type { AITransport, ExtractedContent } from '../../../src/types/index.js'

const skillResponse = readFileSync(
  join(process.cwd(), 'tests/fixtures/ai-responses/classification-skill.json'),
  'utf-8',
)
const knowledgeResponse = readFileSync(
  join(process.cwd(), 'tests/fixtures/ai-responses/classification-knowledge.json'),
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

function mockTransport(response: string): AITransport {
  return {
    name: 'mock',
    available: vi.fn().mockResolvedValue(true),
    send: vi.fn().mockResolvedValue(response),
  }
}

describe('classify', () => {
  it('classifies content as skill', async () => {
    const transport = mockTransport(skillResponse)
    const result = await classify(transport, sampleContent)
    expect(result.type).toBe('skill')
    expect(result.confidence).toBe(0.95)
    expect(result.suggestedSlug).toBe('react-hooks-patterns')
  })

  it('classifies content as knowledge', async () => {
    const transport = mockTransport(knowledgeResponse)
    const result = await classify(transport, sampleContent)
    expect(result.type).toBe('knowledge')
  })

  it('returns forced type without calling transport', async () => {
    const transport = mockTransport(skillResponse)
    const result = await classify(transport, sampleContent, 'knowledge')
    expect(result.type).toBe('knowledge')
    expect(result.confidence).toBe(1)
    expect(transport.send).not.toHaveBeenCalled()
  })

  it('parses JSON wrapped in markdown code fences', async () => {
    const fenced = `\`\`\`json\n${skillResponse}\n\`\`\``
    const transport = mockTransport(fenced)
    const result = await classify(transport, sampleContent)
    expect(result.type).toBe('skill')
  })

  it('retries once on invalid JSON and throws after second failure', async () => {
    const transport: AITransport = {
      name: 'mock',
      available: vi.fn().mockResolvedValue(true),
      send: vi.fn().mockResolvedValue('not valid json at all'),
    }
    await expect(classify(transport, sampleContent)).rejects.toThrow('Classification failed')
    expect(transport.send).toHaveBeenCalledTimes(2)
  })

  it('throws ClassificationError on invalid schema response', async () => {
    const transport = mockTransport('{"type": "unknown", "confidence": 2}')
    await expect(classify(transport, sampleContent)).rejects.toThrow()
  })
})
