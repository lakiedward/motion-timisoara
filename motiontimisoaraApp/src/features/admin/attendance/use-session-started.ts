import { useEffect, useState } from 'react'

const MAX_TIMEOUT = 2_147_483_647

export function useSessionStarted(startsAt: string) {
  const start = new Date(startsAt).getTime()
  const [now, setNow] = useState(() => Date.now())
  const started = now >= start

  useEffect(() => {
    if (started) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(start - Date.now(), MAX_TIMEOUT))
    return () => clearTimeout(timer)
  }, [start, started, now])

  return started
}
