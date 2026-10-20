import { POSTGREST_MAX_ROWS } from '@/api/admin'
import { supabase } from '@/lib/supabase'

export type AdminAnnouncementSource = 'club' | 'coach'
export type AdminOrganizerKind = 'club' | 'coach'

export type AdminAnnouncement = {
  id: string
  source: AdminAnnouncementSource
  title: string | null
  content: string
  createdAt: string
  visible: boolean
  pinned: boolean
  priority: string | null
  organizerKey: string
  organizerKind: AdminOrganizerKind
  organizerName: string
  audience: string
  coachName: string | null
  mediaCount: number
}

type Named = { id: string; name: string } | null
type CourseRef = { id: string; name: string; club: Named; coach: Named }

const AUDIENCE_LABEL: Record<string, string> = {
  COURSE: 'Curs',
  ACTIVITY: 'Activitate',
  CAMP: 'Tabără',
}

const nameOf = (n: Named) => n?.name?.trim() || '—'

async function namesById(table: 'courses' | 'activities', ids: string[]) {
  if (!ids.length) return new Map<string, string>()
  const { data, error } = await supabase.from(table).select('id, name').in('id', ids)
  if (error) throw error
  return new Map((data ?? []).map((r) => [r.id, r.name]))
}

async function campNames(ids: string[]) {
  if (!ids.length) return new Map<string, string>()
  const { data, error } = await supabase.from('camps').select('id, title').in('id', ids)
  if (error) throw error
  return new Map((data ?? []).map((r) => [r.id, r.title]))
}

export function audienceLabel(kind: string, id: string | null, names: Map<string, string>) {
  if (kind === 'CLUB') return 'Toți părinții clubului'
  const label = AUDIENCE_LABEL[kind] ?? kind
  const name = id ? names.get(`${kind}:${id}`) : undefined
  if (name) return `${label}: ${name}`
  return kind === 'COURSE' ? 'Curs indisponibil' : `${label} indisponibilă`
}

async function getAttachmentOwners() {
  const rows: { club_announcement_id: string | null; announcement_id: string | null }[] = []
  for (let from = 0; ; from += POSTGREST_MAX_ROWS) {
    const { data, error } = await supabase
      .from('announcement_attachments')
      .select('club_announcement_id, announcement_id')
      .order('id')
      .range(from, from + POSTGREST_MAX_ROWS - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < POSTGREST_MAX_ROWS) return rows
  }
}

export function countMedia(
  rows: { club_announcement_id: string | null; announcement_id: string | null }[],
) {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const key = r.club_announcement_id
      ? `club:${r.club_announcement_id}`
      : r.announcement_id
        ? `coach:${r.announcement_id}`
        : null
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export async function getAllAnnouncementsAdmin(): Promise<AdminAnnouncement[]> {
  const [club, course, media] = await Promise.all([
    supabase
      .from('club_announcements')
      .select('*, club:clubs(id,name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('course_announcements')
      .select(
        'id, content, pinned, created_at, course:courses(id, name, club:clubs(id,name), coach:profiles!courses_coach_id_fkey(id,name))',
      )
      .order('created_at', { ascending: false }),
    getAttachmentOwners(),
  ])
  if (club.error) throw club.error
  if (course.error) throw course.error

  const clubRows = club.data ?? []
  const idsOf = (kind: string) => [
    ...new Set(
      clubRows.filter((a) => a.audience_kind === kind && a.audience_id).map((a) => a.audience_id!),
    ),
  ]
  const [courses, activities, camps] = await Promise.all([
    namesById('courses', idsOf('COURSE')),
    namesById('activities', idsOf('ACTIVITY')),
    campNames(idsOf('CAMP')),
  ])
  const names = new Map<string, string>([
    ...[...courses].map(([id, n]) => [`COURSE:${id}`, n] as const),
    ...[...activities].map(([id, n]) => [`ACTIVITY:${id}`, n] as const),
    ...[...camps].map(([id, n]) => [`CAMP:${id}`, n] as const),
  ])

  const fromClubs: AdminAnnouncement[] = clubRows.map((a) => {
    const c = a.club as Named
    return {
      id: a.id,
      source: 'club',
      title: a.title,
      content: a.content,
      createdAt: a.created_at,
      visible: a.is_active,
      pinned: false,
      priority: a.priority,
      organizerKey: `club:${a.club_id}`,
      organizerKind: 'club',
      organizerName: nameOf(c),
      audience: audienceLabel(a.audience_kind, a.audience_id, names),
      coachName: null,
      mediaCount: 0,
    }
  })
  const fromCoaches: AdminAnnouncement[] = (course.data ?? []).map((a) => {
    const ref = a.course as unknown as CourseRef | null
    const owner = ref?.club
      ? { key: `club:${ref.club.id}`, kind: 'club' as const, name: nameOf(ref.club) }
      : {
          key: `coach:${ref?.coach?.id ?? '—'}`,
          kind: 'coach' as const,
          name: nameOf(ref?.coach ?? null),
        }
    return {
      id: a.id,
      source: 'coach',
      title: null,
      content: a.content,
      createdAt: a.created_at,
      visible: true,
      pinned: a.pinned,
      priority: null,
      organizerKey: owner.key,
      organizerKind: owner.kind,
      organizerName: owner.name,
      audience: ref ? `Curs: ${ref.name}` : 'Curs indisponibil',
      coachName: ref?.coach ? nameOf(ref.coach) : null,
      mediaCount: 0,
    }
  })
  const counts = countMedia(media)
  return [...fromClubs, ...fromCoaches]
    .map((a) => ({ ...a, mediaCount: counts.get(`${a.source}:${a.id}`) ?? 0 }))
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
}

export async function getIndependentCoachCourses(
  coachId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, name')
    .eq('coach_id', coachId)
    .is('club_id', null)
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}
