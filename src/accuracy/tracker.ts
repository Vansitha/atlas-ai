import { appendFileSync, readFileSync, existsSync } from 'node:fs'
import { ACCURACY_LOG_PATH } from '../storage/paths.js'
import type { OutputType } from '../types/index.js'

interface AccuracyEntry {
  readonly url: string
  readonly aiClassification: OutputType
  readonly userChoice: OutputType
  readonly timestamp: string
}

export function logOverride(
  url: string,
  aiClassification: OutputType,
  userChoice: OutputType,
): void {
  const entry: AccuracyEntry = {
    url,
    aiClassification,
    userChoice,
    timestamp: new Date().toISOString(),
  }
  appendFileSync(ACCURACY_LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8')
}

export function getAccuracyStats(): { total: number; correct: number; accuracy: number } {
  if (!existsSync(ACCURACY_LOG_PATH)) return { total: 0, correct: 0, accuracy: 0 }

  const lines = readFileSync(ACCURACY_LOG_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean)

  const entries: AccuracyEntry[] = lines.map((l) => JSON.parse(l))
  const correct = entries.filter((e) => e.aiClassification === e.userChoice).length

  return {
    total: entries.length,
    correct,
    accuracy: entries.length > 0 ? correct / entries.length : 0,
  }
}
