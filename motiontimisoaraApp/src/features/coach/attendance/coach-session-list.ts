import type { AdminSession } from '@/api/attendance/admin-sessions'
import { PAST_VISIBLE_DAYS, type CoachSession, type CoachSessionGroups } from '@/api/coach'
import { formatDay, formatTime, isStarted } from '@/features/admin/attendance/attendance-overview'

export type DayGroup = { key: string; label: string; items: AdminSession[] }

function toSession(s: CoachSession): AdminSession {
  return {
    id: s.id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    courseId: s.course?.id ?? '',
    courseName: s.course?.name ?? '—',
    locationName: s.course?.location?.name ?? null,
    sportId: s.course?.sport?.id ?? null,
    sportName: s.course?.sport?.name ?? null,
    coachName: null,
    organizerKey: s.course?.id ?? s.id,
    organizerKind: 'coach',
    organizerName: s.course?.name ?? '—',
    enrolledCount: s.enrolled_count,
    markedCount: s.marked_count,
  }
}

export function toSessionList(groups: CoachSessionGroups | undefined): AdminSession[] {
  if (!groups) return []
  return [...groups.upcoming, ...groups.past].map(toSession)
}

const localDay = (iso: string) => new Date(iso).toDateString()

export function nearestSession(items: AdminSession[], now = Date.now()) {
  const today = new Date(now).toDateString()
  const byTime = [...items].sort((x, y) => x.startsAt.localeCompare(y.startsAt))
  return (
    byTime.find((s) => localDay(s.startsAt) === today) ??
    byTime.find((s) => !isStarted(s, now)) ??
    byTime.at(-1) ??
    null
  )
}

export const isRetroactive = (s: AdminSession, now = Date.now()) =>
  now - new Date(s.startsAt).getTime() > PAST_VISIBLE_DAYS * 24 * 60 * 60 * 1000

export const sessionWhen = (s: AdminSession) => `${formatDay(s.startsAt)} · ${formatTime(s.startsAt)}`

export function splitByTime(items: AdminSession[], now = Date.now()) {
  const upcoming = items
    .filter((s) => !isStarted(s, now))
    .sort((x, y) => x.startsAt.localeCompare(y.startsAt))
  const past = items
    .filter((s) => isStarted(s, now))
    .sort((x, y) => y.startsAt.localeCompare(x.startsAt))
  return { upcoming, past }
}

export function groupByDay(items: AdminSession[]): DayGroup[] {
  const groups = new Map<string, DayGroup>()
  for (const s of items) {
    const key = localDay(s.startsAt)
    const g = groups.get(key) ?? { key, label: formatDay(s.startsAt), items: [] }
    g.items.push(s)
    groups.set(key, g)
  }
  return [...groups.values()]
}

export function recentPast(past: AdminSession[], now = Date.now()) {
  const cutoff = now - PAST_VISIBLE_DAYS * 24 * 60 * 60 * 1000
  return past.filter((s) => new Date(s.startsAt).getTime() >= cutoff)
}
