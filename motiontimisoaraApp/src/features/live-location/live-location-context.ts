import { createContext, useContext } from 'react'
import type { SharingState } from './sharing-controller'

export type LiveLocationSharing = SharingState & {
  start: (occurrenceId: string) => Promise<void>
  stop: () => Promise<void>
}
export const LiveLocationContext = createContext<LiveLocationSharing | null>(null)
export function useLiveLocationSharing() {
  const value = useContext(LiveLocationContext)
  if (!value) throw new Error('LiveLocationProvider lipsește.')
  return value
}
