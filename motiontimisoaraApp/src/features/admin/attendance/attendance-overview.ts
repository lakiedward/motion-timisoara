import type { AdminSession } from '@/api/attendance/admin-sessions'
import { fold } from '@/features/admin/courses/course-overview'
import { plural } from '@/lib/plural'

export type SessionStatus = 'today' | 'unmarked' | 'upcoming' | 'past' | 'all'

export type SessionFilters = { status: SessionStatus; sport: string; query: string }

export type SessionGroup = {
  key: string
  kind: 'club' | 'coach'
  name: string
  items: AdminSession[]
  unmarkedCount: number
  totalCount: number
}

export const NO_SESSION_FILTERS: SessionFilters = { status: 'unmarked', sport: '', query: '' }

export const countSessions = (n: number) => plural(n, 'ședință', 'ședințe')

const TZ = 'Europe/Bucharest'
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TZ,
})
const timeFormat = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const dateFormat = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
})

export const dayKey = (iso: string | number) => dayKeyFormat.format(new Date(iso))

export const formatTime = (iso: string) => timeFormat.format(new Date(iso))

export function formatDay(iso: string, now = Date.now()) {
  const diff = Math.round(
    (Date.parse(`${dayKey(iso)}T00:00:00Z`) - Date.parse(`${dayKey(now)}T00:00:00Z`)) / 86_400_000,
  )
  const date = dateFormat.format(new Date(iso)).replace(',', '')
  if (diff === 0) return `Azi, ${date}`
  if (diff === -1) return `Ieri, ${date}`
  if (diff === 1) return `Mâine, ${date}`
  return date.charAt(0).toUpperCase() + date.slice(1)
}

export const isStarted = (s: AdminSession, now = Date.now()) =>
  new Date(s.startsAt).getTime() <= now

export const isUnmarked = (s: AdminSession, now = Date.now()) =>
  isStarted(s, now) && s.enrolledCount > 0 && s.markedCount < s.enrolledCount

export function matchesStatus(s: AdminSession, status: SessionStatus, now = Date.now()) {
  if (status === 'today') return dayKey(s.startsAt) === dayKey(now)
  if (status === 'unmarked') return isUnmarked(s, now)
  if (status === 'upcoming') return !isStarted(s, now)
  if (status === 'past') return isStarted(s, now)
  return true
}

export function matchesQuery(s: AdminSession, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(
    [s.courseName, s.organizerName, s.coachName, s.locationName].filter(Boolean).join(' '),
  ).includes(needle)
}

export function filterSessions(items: AdminSession[], f: SessionFilters, now = Date.now()) {
  return items.filter(
    (s) =>
      matchesStatus(s, f.status, now) &&
      (!f.sport || s.sportId === f.sport) &&
      matchesQuery(s, f.query),
  )
}

export const hasSessionFilters = (f: SessionFilters) =>
  f.status !== 'all' || !!f.sport || f.query.trim().length > 0

export function sessionStatusCounts(
  items: AdminSession[],
  now = Date.now(),
): Record<SessionStatus, number> {
  const count = (status: SessionStatus) => items.filter((s) => matchesStatus(s, status, now)).length
  return {
    today: count('today'),
    unmarked: count('unmarked'),
    upcoming: count('upcoming'),
    past: count('past'),
    all: items.length,
  }
}

export function sportCounts(items: AdminSession[]) {
  const map = new Map<string, { id: string; name: string; count: number }>()
  for (const s of items) {
    if (!s.sportId) continue
    const e = map.get(s.sportId) ?? { id: s.sportId, name: s.sportName ?? '—', count: 0 }
    e.count += 1
    map.set(s.sportId, e)
  }
  return [...map.values()].sort((x, y) => x.name.localeCompare(y.name, 'ro'))
}

function sortSessions(items: AdminSession[], status: SessionStatus) {
  const dir = status === 'past' || status === 'unmarked' ? -1 : 1
  return items.sort((x, y) => dir * x.startsAt.localeCompare(y.startsAt))
}

export function groupSessionsByOrganizer(
  all: AdminSession[],
  visible: AdminSession[],
  status: SessionStatus,
  now = Date.now(),
): SessionGroup[] {
  const totals = new Map<string, { unmarked: number; total: number }>()
  for (const s of all) {
    const t = totals.get(s.organizerKey) ?? { unmarked: 0, total: 0 }
    t.total += 1
    if (isUnmarked(s, now)) t.unmarked += 1
    totals.set(s.organizerKey, t)
  }
  const groups = new Map<string, SessionGroup>()
  for (const s of visible) {
    const g = groups.get(s.organizerKey) ?? {
      key: s.organizerKey,
      kind: s.organizerKind,
      name: s.organizerName,
      items: [],
      unmarkedCount: totals.get(s.organizerKey)?.unmarked ?? 0,
      totalCount: totals.get(s.organizerKey)?.total ?? 0,
    }
    g.items.push(s)
    groups.set(s.organizerKey, g)
  }
  for (const g of groups.values()) sortSessions(g.items, status)
  return [...groups.values()].sort(
    (x, y) =>
      (x.kind === y.kind ? 0 : x.kind === 'club' ? -1 : 1) || x.name.localeCompare(y.name, 'ro'),
  )
}
