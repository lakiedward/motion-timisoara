import { useEffect, useState } from 'react'

import type { AdminSession } from '@/api/attendance/admin-sessions'
import { attendanceOpensAt } from '@/lib/attendance-window'

const MAX_TIMEOUT = 2_147_483_647

export function useAttendanceOpen(startsAt: string) {
  const opensAt = attendanceOpensAt(startsAt)
  const [now, setNow] = useState(() => Date.now())
  const open = now >= opensAt

  useEffect(() => {
    if (open || !Number.isFinite(opensAt)) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(opensAt - Date.now(), MAX_TIMEOUT))
    return () => clearTimeout(timer)
  }, [opensAt, open, now])

  return open
}

export function useAttendanceClock(items: AdminSession[]) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let next = Infinity
    for (const { startsAt, endsAt } of items) {
      for (const time of [attendanceOpensAt(startsAt), Date.parse(startsAt), Date.parse(endsAt)]) {
        if (time > now && time < next) next = time
      }
    }
    if (!Number.isFinite(next)) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - Date.now(), MAX_TIMEOUT))
    return () => clearTimeout(timer)
  }, [items, now])

  return now
}
