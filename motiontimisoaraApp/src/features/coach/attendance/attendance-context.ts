import { createContext, useContext } from 'react'
import type { AttendanceQueue } from './attendance-queue'

export const AttendanceContext = createContext<AttendanceQueue | null>(null)
export function useAttendanceQueue() {
  return useContext(AttendanceContext)
}
