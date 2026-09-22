import { useEffect, useState } from 'react'

export function useCompetitionClock(...timestamps: Array<string | null | undefined>): number {
  const [now, setNow] = useState(Date.now)
  const deadlines = timestamps.filter((value): value is string => Boolean(value)).join('|')

  useEffect(() => {
    const current = Date.now()
    const next = deadlines
      .split('|')
      .map((value) => Date.parse(value))
      .filter((value) => Number.isFinite(value) && value > current)
      .sort((a, b) => a - b)[0]
    if (next === undefined) return
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(next - current + 50, 2_147_483_647),
    )
    return () => window.clearTimeout(timer)
  }, [deadlines, now])

  return now
}
