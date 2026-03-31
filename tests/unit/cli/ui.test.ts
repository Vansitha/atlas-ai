import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSpinner = {
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
}

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  confirm: vi.fn(),
  spinner: vi.fn(() => mockSpinner),
  isCancel: vi.fn((v) => v === Symbol.for('cancel')),
}))

import * as clack from '@clack/prompts'
import { intro, outro, fail, createSpinner, confirm, withSpinner } from '../../../src/cli/ui.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('intro', () => {
  it('calls clack.intro with atlas prefix', () => {
    intro('test message')
    expect(clack.intro).toHaveBeenCalledWith(expect.stringContaining('test message'))
  })
})

describe('outro', () => {
  it('calls clack.outro', () => {
    outro('done')
    expect(clack.outro).toHaveBeenCalledWith('done')
  })
})

describe('fail', () => {
  it('calls clack.outro with error prefix', () => {
    fail('something broke')
    expect(clack.outro).toHaveBeenCalledWith(expect.stringContaining('something broke'))
  })
})

describe('createSpinner', () => {
  it('starts the spinner immediately', () => {
    createSpinner('loading...')
    expect(mockSpinner.start).toHaveBeenCalledWith('loading...')
  })

  it('stop calls spinner.stop', () => {
    const s = createSpinner('loading...')
    s.stop('done')
    expect(mockSpinner.stop).toHaveBeenCalledWith('done')
  })

  it('fail calls spinner.stop with error code', () => {
    const s = createSpinner('loading...')
    s.fail('error')
    expect(mockSpinner.stop).toHaveBeenCalledWith('error', 1)
  })
})

describe('confirm', () => {
  it('returns true when user confirms', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(true)
    const result = await confirm('Are you sure?')
    expect(result).toBe(true)
  })

  it('returns false when user declines', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(false)
    const result = await confirm('Are you sure?')
    expect(result).toBe(false)
  })
})

describe('withSpinner', () => {
  it('returns the result of the async function', async () => {
    const result = await withSpinner('working...', async () => 42)
    expect(result).toBe(42)
  })

  it('re-throws errors from the async function', async () => {
    await expect(
      withSpinner('working...', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
  })

  it('calls spinner.stop on success', async () => {
    await withSpinner('working...', async () => 'ok', 'done')
    expect(mockSpinner.stop).toHaveBeenCalledWith('done')
  })
})
