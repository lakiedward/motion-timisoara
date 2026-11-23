import { useEffect, useState } from 'react'

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
