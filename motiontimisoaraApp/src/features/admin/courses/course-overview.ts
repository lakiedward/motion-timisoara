import type { AdminCourse } from '@/api/admin'

export type StatusFilter = 'active' | 'inactive' | 'attention' | 'all'
export type OrganizerKind = 'club' | 'coach'

export type OrganizerGroup = {
  key: string
  kind: OrganizerKind
  name: string
  courses: AdminCourse[]
  activeCount: number
  totalCount: number
  enrolledChildren: number
  attentionCount: number
}

export type CourseFilters = { status: StatusFilter; sport: string; query: string }

export function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function plural(n: number, one: string, many: string) {
  if (n === 1) return `1 ${one}`
  const rest = n % 100
  return `${n}${n > 0 && (rest === 0 || rest > 19) ? ' de' : ''} ${many}`
}

export const countCourses = (n: number) => plural(n, 'curs', 'cursuri')

export function attentionReason(course: AdminCourse): string | null {
  const { active, pending } = course.enrollments
  if (!course.active && active > 0)
    return `Inactiv, dar are ${plural(active, 'înscriere activă', 'înscrieri active')}`
  if (pending > 0) return `${plural(pending, 'înscriere', 'înscrieri')} în așteptare`
  if (course.active && course.capacity != null && course.capacity > 0 && active >= course.capacity)
    return 'Locuri epuizate'
  return null
}

export function matchesStatus(course: AdminCourse, status: StatusFilter) {
  if (status === 'active') return course.active
  if (status === 'inactive') return !course.active
  if (status === 'attention') return attentionReason(course) !== null
  return true
}

export function matchesQuery(course: AdminCourse, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(`${course.name} ${course.coach?.name ?? ''} ${course.club?.name ?? ''}`).includes(
    needle,
  )
}

export function statusCounts(courses: AdminCourse[]): Record<StatusFilter, number> {
  return {
    active: courses.filter((c) => matchesStatus(c, 'active')).length,
    inactive: courses.filter((c) => matchesStatus(c, 'inactive')).length,
    attention: courses.filter((c) => matchesStatus(c, 'attention')).length,
    all: courses.length,
  }
}

export function sportCounts(courses: AdminCourse[]) {
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const c of courses) {
    if (!c.sport_id || !c.sport) continue
    const entry = counts.get(c.sport_id) ?? { id: c.sport_id, name: c.sport.name, count: 0 }
    entry.count += 1
    counts.set(c.sport_id, entry)
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro'))
}

export function filterCourses(courses: AdminCourse[], { status, sport, query }: CourseFilters) {
  return courses.filter(
    (c) => matchesStatus(c, status) && (!sport || c.sport_id === sport) && matchesQuery(c, query),
  )
}

function organizerOf(course: AdminCourse): { key: string; kind: OrganizerKind; name: string } {
  if (course.club_id)
    return { key: `club:${course.club_id}`, kind: 'club', name: course.club?.name ?? '—' }
  return { key: `coach:${course.coach_id}`, kind: 'coach', name: course.coach?.name ?? '—' }
}

export function groupByOrganizer(all: AdminCourse[], visible: AdminCourse[]): OrganizerGroup[] {
  const visibleIds = new Set(visible.map((c) => c.id))
  const groups = new Map<string, OrganizerGroup>()
  for (const course of all) {
    const org = organizerOf(course)
    const g =
      groups.get(org.key) ??
      ({
        ...org,
        courses: [],
        activeCount: 0,
        totalCount: 0,
        enrolledChildren: 0,
        attentionCount: 0,
      } as OrganizerGroup)
    g.totalCount += 1
    if (course.active) {
      g.activeCount += 1
      g.enrolledChildren += course.enrollments.active
    }
    if (attentionReason(course)) g.attentionCount += 1
    if (visibleIds.has(course.id)) g.courses.push(course)
    groups.set(org.key, g)
  }
  return [...groups.values()]
    .filter((g) => g.courses.length > 0)
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name, 'ro'))
}

export function overviewLine(groups: OrganizerGroup[], status: StatusFilter, shown: number) {
  const clubs = groups.filter((g) => g.kind === 'club').length
  const coaches = groups.length - clubs
  const what = {
    active: 'active',
    inactive: 'inactive',
    attention: 'de verificat',
    all: '',
  }[status]
  const parts = [
    clubs ? plural(clubs, 'club', 'cluburi') : null,
    coaches ? plural(coaches, 'antrenor independent', 'antrenori independenți') : null,
  ].filter(Boolean)
  return `${countCourses(shown)}${what ? ` ${what}` : ''} la ${parts.join(' și ')}`
}
