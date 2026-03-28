import type { ExtractedContent } from '../../types/index.js'
import type { ClassificationResponse } from '../../schemas/classification.js'

const MAX_BODY_LENGTH = 12_000

const SKILL_INSTRUCTIONS = `Generate an Agent Skills compatible SKILL.md file.

The output MUST follow this exact structure:
---
name: <slug>
description: <one-line description of when to use this skill>
tags: [tag1, tag2, tag3]
---

# Title

## When to Activate
- bullet points describing when this skill is useful

## Key Patterns
Code examples and patterns extracted from the content

## Usage
Practical usage examples with code where applicable

## Notes
Any important caveats, gotchas, or additional context`

const KNOWLEDGE_INSTRUCTIONS = `Generate a knowledge note in markdown format.

The output MUST follow this exact structure:
---
title: <title>
type: knowledge
tags: [tag1, tag2, tag3]
---

# Title

Brief summary of what this content covers.

## Key Takeaways
- Most important points as bullet list

## Details
Expanded explanation of the content

## Source Context
Where this came from and why it matters`

export function buildGenerationPrompt(
  content: ExtractedContent,
  classification: ClassificationResponse,
): string {
  const body = content.body.slice(0, MAX_BODY_LENGTH)
  const instructions = classification.type === 'skill' ? SKILL_INSTRUCTIONS : KNOWLEDGE_INSTRUCTIONS

  return `You are generating structured markdown for a personal AI knowledge base.

${instructions}

Return ONLY valid JSON matching this exact schema — no extra text:
{
  "markdown": "the complete markdown content including frontmatter",
  "title": "${classification.suggestedTitle}",
  "description": "one sentence describing what this captures",
  "tags": ${JSON.stringify(classification.suggestedTags)}
}

Source content:
URL: ${content.url}
Title: ${content.title}
Classification: ${classification.type} (confidence: ${classification.confidence})
Tags: ${classification.suggestedTags.join(', ')}
Platform: ${content.metadata['platform'] ?? 'web'}
${content.metadata['author'] ? `Author: ${content.metadata['author']}` : ''}

Content:
${body}`
}
