import { isNative } from '@/lib/platform'

export function usesNativeNavigation() {
  return (
    isNative() || (import.meta.env.DEV && import.meta.env.VITE_NATIVE_NAVIGATION_PREVIEW === '1')
  )
}
