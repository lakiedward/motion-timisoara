import { useSyncExternalStore } from 'react'

import {
  readThemePreference,
  resolveTheme,
  setThemePreference,
  subscribeTheme,
} from '@/lib/theme/theme-preference'

export function useThemePreference() {
  const preference = useSyncExternalStore(
    subscribeTheme,
    readThemePreference,
    () => 'system' as const,
  )
  const resolved = useSyncExternalStore(
    subscribeTheme,
    () => resolveTheme(),
    () => 'light' as const,
  )
  return { preference, resolved, setPreference: setThemePreference }
}
