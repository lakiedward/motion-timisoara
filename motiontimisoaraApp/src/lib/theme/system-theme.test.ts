import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncSystemTheme } from './system-theme'

function mockMatchMedia(initial: boolean) {
  let listener: (() => void) | undefined
  const query = {
    matches: initial,
    addEventListener: vi.fn((_type: string, fn: () => void) => {
      listener = fn
    }),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => query))
  return {
    query,
    change(next: boolean) {
      query.matches = next
      listener?.()
    },
  }
}

describe('syncSystemTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds the dark class when the system prefers dark', () => {
    mockMatchMedia(true)
    const root = document.createElement('html')
    syncSystemTheme(root)
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('keeps the light theme when the system prefers light', () => {
    mockMatchMedia(false)
    const root = document.createElement('html')
    syncSystemTheme(root)
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('follows later system changes and stops after cleanup', () => {
    const media = mockMatchMedia(false)
    const root = document.createElement('html')
    const stop = syncSystemTheme(root)
    media.change(true)
    expect(root.classList.contains('dark')).toBe(true)
    media.change(false)
    expect(root.classList.contains('dark')).toBe(false)
    stop()
    expect(media.query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
