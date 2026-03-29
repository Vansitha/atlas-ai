import { z } from 'zod'

export const configSchema = z.object({
  version: z.literal(1),
  browser: z.enum(['chrome', 'brave', 'arc', 'edge', 'skip']).nullable(),
  browserProfile: z.string().nullable().default(null),
  codingTools: z.array(z.enum(['claude-code', 'cursor', 'copilot', 'windsurf'])),
  aiProvider: z.enum(['claude-cli', 'opencode-cli', 'anthropic-sdk']).nullable(),
  daemon: z.object({
    enabled: z.boolean(),
    bookmarkFolder: z.string().default('Atlas'),
    debounceMs: z.number().int().positive().default(2000),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Config = z.infer<typeof configSchema>
