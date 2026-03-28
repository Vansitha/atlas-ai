import * as clack from '@clack/prompts'

export function intro(msg: string): void {
  clack.intro(`atlas — ${msg}`)
}

export function outro(msg: string): void {
  clack.outro(msg)
}

export function fail(msg: string): void {
  clack.outro(`✗ ${msg}`)
}

export interface Spinner {
  start(msg?: string): void
  stop(msg?: string): void
  fail(msg?: string): void
}

export function createSpinner(initialMsg: string): Spinner {
  const s = clack.spinner()
  s.start(initialMsg)
  return {
    start(msg?: string) {
      if (msg) s.message(msg)
    },
    stop(msg?: string) {
      s.stop(msg)
    },
    fail(msg?: string) {
      s.stop(msg ?? 'Failed', 1)
    },
  }
}

export async function confirm(msg: string): Promise<boolean> {
  const result = await clack.confirm({ message: msg })
  if (clack.isCancel(result)) {
    fail('Operation cancelled')
    process.exit(0)
  }
  return result
}

export async function withSpinner<T>(
  msg: string,
  fn: () => Promise<T>,
  successMsg?: string,
): Promise<T> {
  const s = createSpinner(msg)
  try {
    const result = await fn()
    s.stop(successMsg)
    return result
  } catch (err) {
    s.fail(err instanceof Error ? err.message : String(err))
    throw err
  }
}
