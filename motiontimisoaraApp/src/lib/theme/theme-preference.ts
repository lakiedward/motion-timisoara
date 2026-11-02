export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'motion-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const listeners = new Set<() => void>()
let fallbackPreference: ThemePreference = 'system'

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isPreference(stored) ? stored : 'system'
  } catch {
    return fallbackPreference
  }
}

function storeThemePreference(preference: ThemePreference) {
  fallbackPreference = preference
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    return
  }
}

function systemPrefersDark() {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

export function resolveTheme(preference: ThemePreference = readThemePreference()): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return preference
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function applyTheme(root: HTMLElement = document.documentElement) {
  root.classList.toggle('dark', resolveTheme() === 'dark')
}

export function setThemePreference(
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
) {
  storeThemePreference(preference)
  applyTheme(root)
  notify()
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function syncTheme(root: HTMLElement = document.documentElement) {
  applyTheme(root)
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(DARK_QUERY)
  const update = () => {
    applyTheme(root)
    notify()
  }
  query.addEventListener('change', update)
  return () => query.removeEventListener('change', update)
}
