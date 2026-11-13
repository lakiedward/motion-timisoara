import { useEffect, useState } from 'react'
import type { AdminSession } from '@/api/attendance/admin-sessions'

export const SCAN_LEAD_MS = 15 * 60 * 1000

export function currentSession(items: AdminSession[], now = Date.now()) {
  return (
    items
      .filter((s) => {
        const start = Date.parse(s.startsAt)
        const end = Date.parse(s.endsAt)
        return start - SCAN_LEAD_MS <= now && now < end
      })
      .sort((x, y) => x.startsAt.localeCompare(y.startsAt))[0] ?? null
  )
}

export function useCurrentSession(items: AdminSession[]) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return currentSession(items, now)
}
