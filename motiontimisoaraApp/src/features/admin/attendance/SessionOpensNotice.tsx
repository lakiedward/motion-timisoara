import { formatDay, formatTime } from './attendance-overview'

export function SessionOpensNotice({ startsAt }: { startsAt: string }) {
  return (
    <p className="bg-muted text-muted-foreground rounded-xl px-4 py-3 text-sm">
      Pontajul se deschide la începutul ședinței, {formatDay(startsAt)} · {formatTime(startsAt)}.
    </p>
  )
}
