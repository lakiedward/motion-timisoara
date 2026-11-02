import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  THEME_STORAGE_KEY,
  readThemePreference,
  setThemePreference,
  subscribeTheme,
  syncTheme,
} from './theme-preference'

function mockMatchMedia(initial: boolean) {
  let listener: (() => void) | undefined
  const query = {
    matches: initial,
    addEventListener: vi.fn((_type: string, fn: () => void) => {
      listener = fn
    }),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query),
  )
  return {
    query,
    change(next: boolean) {
      query.matches = next
      listener?.()
    },
  }
}

describe('theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('follows the system theme while no choice was saved', () => {
    const media = mockMatchMedia(true)
    const root = document.createElement('html')
    const stop = syncTheme(root)
    expect(readThemePreference()).toBe('system')
    expect(root.classList.contains('dark')).toBe(true)
    media.change(false)
    expect(root.classList.contains('dark')).toBe(false)
    stop()
    expect(media.query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('applies and remembers an explicit choice over the system theme', () => {
    const media = mockMatchMedia(false)
    const root = document.createElement('html')
    syncTheme(root)
    setThemePreference('dark', root)
    expect(root.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    media.change(false)
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('restores a saved choice on the next start', () => {
    mockMatchMedia(true)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const root = document.createElement('html')
    syncTheme(root)
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('ignores an unknown saved value', () => {
    mockMatchMedia(false)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(readThemePreference()).toBe('system')
  })

  it('returns to the system theme and notifies subscribers', () => {
    mockMatchMedia(true)
    const root = document.createElement('html')
    const listener = vi.fn()
    const unsubscribe = subscribeTheme(listener)
    setThemePreference('light', root)
    setThemePreference('system', root)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(root.classList.contains('dark')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })
})
