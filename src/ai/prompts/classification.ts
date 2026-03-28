import type { ExtractedContent } from '../../types/index.js'

const MAX_BODY_LENGTH = 8_000

export function buildClassificationPrompt(content: ExtractedContent): string {
  const body = content.body.slice(0, MAX_BODY_LENGTH)

  return `You are classifying web content for a personal AI knowledge base.

Classify the following content as either:
- "skill": actionable how-to guides, code patterns, tutorials, cheat sheets, library docs, implementation examples, workflows
- "knowledge": concepts, articles, news, opinions, discussions, research, Twitter threads, Reddit posts about ideas

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "type": "skill" | "knowledge",
  "confidence": number between 0 and 1,
  "reasoning": "one sentence explaining the classification",
  "suggestedTitle": "clean, concise title",
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "suggestedSlug": "kebab-case-slug-max-60-chars"
}

Content to classify:
URL: ${content.url}
Title: ${content.title}
Platform: ${content.metadata['platform'] ?? 'web'}
Body:
${body}`
}
