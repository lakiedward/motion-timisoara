import { POSTGREST_MAX_ROWS } from '@/api/admin'
import { supabase } from '@/lib/supabase'

export const ADMIN_SESSION_WINDOW_DAYS = 30

export type AdminSession = {
  id: string
  startsAt: string
  endsAt: string
  courseId: string
  courseName: string
  locationName: string | null
  sportId: string | null
  sportName: string | null
  coachName: string | null
  organizerKey: string
  organizerKind: 'club' | 'coach'
  organizerName: string
  enrolledCount: number
  markedCount: number
}

type Named = { id: string; name: string } | null
type SessionRow = {
  id: string
  starts_at: string
  ends_at: string
  course: {
    id: string
    name: string
    location: { name: string } | null
    sport: Named
    club: Named
    coach: Named
  } | null
}

const SELECT =
  'id, starts_at, ends_at, course:courses!inner(id, name, location:locations(name), sport:sports(id,name), club:clubs(id,name), coach:profiles!courses_coach_id_fkey(id,name))'

const nameOf = (n: Named) => n?.name?.trim() || '—'

async function allPages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += POSTGREST_MAX_ROWS) {
    const { data, error } = await run(from, from + POSTGREST_MAX_ROWS - 1)
    if (error) throw error
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < POSTGREST_MAX_ROWS) return rows
  }
}

const ID_CHUNK = 150

function chunks(ids: string[]) {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) out.push(ids.slice(i, i + ID_CHUNK))
  return out
}

async function inChunks<T>(
  ids: string[],
  run: (part: string[], from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
) {
  const parts = await Promise.all(chunks(ids).map((part) => allPages<T>((a, b) => run(part, a, b))))
  return parts.flat()
}

function tally<K extends string>(rows: Record<K, string>[], key: K) {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r[key], (counts.get(r[key]) ?? 0) + 1)
  return counts
}

export async function getAdminSessions(now = Date.now()): Promise<AdminSession[]> {
  const span = ADMIN_SESSION_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const from = new Date(now - span).toISOString()
  const to = new Date(now + span).toISOString()
  const sessions = await allPages<SessionRow>((a, b) =>
    supabase
      .from('course_occurrences')
      .select(SELECT)
      .gte('starts_at', from)
      .lt('starts_at', to)
      .order('starts_at', { ascending: true })
      .order('id', { ascending: true })
      .range(a, b),
  )
  if (!sessions.length) return []

  const courseIds = [...new Set(sessions.map((s) => s.course!.id))]
  const occurrenceIds = sessions.map((s) => s.id)
  const [enrollments, attendance] = await Promise.all([
    inChunks<{ entity_id: string }>(courseIds, (part, a, b) =>
      supabase
        .from('enrollments')
        .select('entity_id')
        .eq('kind', 'COURSE')
        .eq('status', 'ACTIVE')
        .in('entity_id', part)
        .order('id', { ascending: true })
        .range(a, b),
    ),
    inChunks<{ occurrence_id: string }>(occurrenceIds, (part, a, b) =>
      supabase
        .from('attendance')
        .select('occurrence_id')
        .in('occurrence_id', part)
        .order('id', { ascending: true })
        .range(a, b),
    ),
  ])
  const enrolled = tally(enrollments, 'entity_id')
  const marked = tally(attendance, 'occurrence_id')

  return sessions.map((s) => {
    const c = s.course!
    const owner = c.club
      ? { key: `club:${c.club.id}`, kind: 'club' as const, name: nameOf(c.club) }
      : { key: `coach:${c.coach?.id ?? '—'}`, kind: 'coach' as const, name: nameOf(c.coach) }
    return {
      id: s.id,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      courseId: c.id,
      courseName: c.name,
      locationName: c.location?.name ?? null,
      sportId: c.sport?.id ?? null,
      sportName: c.sport?.name ?? null,
      coachName: c.coach ? nameOf(c.coach) : null,
      organizerKey: owner.key,
      organizerKind: owner.kind,
      organizerName: owner.name,
      enrolledCount: enrolled.get(c.id) ?? 0,
      markedCount: marked.get(s.id) ?? 0,
    }
  })
}
