import { attendanceOpensAt } from '@/lib/attendance-window'
import { formatDay, formatTime } from './attendance-overview'

export function SessionOpensNotice({ startsAt }: { startsAt: string }) {
  const opensAt = new Date(attendanceOpensAt(startsAt)).toISOString()
  return (
    <p className="bg-muted text-muted-foreground rounded-xl px-4 py-3 text-sm">
      Pontajul se deschide {formatDay(opensAt)} · {formatTime(opensAt)}.
    </p>
  )
}
