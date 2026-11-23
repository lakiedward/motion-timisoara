import type { AdminSession } from '@/api/attendance/admin-sessions'

import { useAttendanceClock } from '@/features/admin/attendance/use-attendance-open'
import { attendanceOpensAt } from '@/lib/attendance-window'

export function currentSession(items: AdminSession[], now = Date.now()) {
  return (
    items
      .filter((s) => {
        const end = Date.parse(s.endsAt)
        return attendanceOpensAt(s.startsAt) <= now && now < end
      })
      .sort((x, y) => x.startsAt.localeCompare(y.startsAt))[0] ?? null
  )
}

export function useCurrentSession(items: AdminSession[]) {
  return currentSession(items, useAttendanceClock(items))
}
