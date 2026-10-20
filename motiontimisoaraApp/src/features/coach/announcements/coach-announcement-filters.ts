import type { CoachAnnouncement } from '@/api/coach-announcements'

export type SourceFilter = 'all' | 'coach' | 'club'

export type CoachAnnouncementFilters = {
  query: string
  source: SourceFilter
  course: string
}

export const NO_FILTERS: CoachAnnouncementFilters = { query: '', source: 'all', course: '' }

export const hasFilters = (f: CoachAnnouncementFilters) =>
  f.query.trim() !== '' || f.source !== 'all' || f.course !== ''

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('ro-RO')

export function filterCoachAnnouncements(
  items: CoachAnnouncement[],
  filters: CoachAnnouncementFilters,
  courseNames: Record<string, string>,
): CoachAnnouncement[] {
  const query = normalize(filters.query.trim())
  return items.filter((a) => {
    if (filters.source !== 'all' && a.source !== filters.source) return false
    if (filters.course && a.courseId !== filters.course) return false
    if (!query) return true
    const text = [a.title, a.content, courseNames[a.courseId], a.clubName].filter(Boolean).join(' ')
    return normalize(text).includes(query)
  })
}

export function sourceCounts(items: CoachAnnouncement[]): Record<SourceFilter, number> {
  const coach = items.filter((a) => a.source === 'coach').length
  return { all: items.length, coach, club: items.length - coach }
}

export function courseCounts(
  items: CoachAnnouncement[],
  courses: { id: string; name: string }[],
): { id: string; name: string; count: number }[] {
  return courses
    .map((c) => ({ ...c, count: items.filter((a) => a.courseId === c.id).length }))
    .filter((c) => c.count > 0)
}

const monthFormat = new Intl.DateTimeFormat('ro-RO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Bucharest',
})

export function groupAnnouncements(items: CoachAnnouncement[]) {
  const groups: { key: string; title: string; items: CoachAnnouncement[] }[] = []
  const pinned = items.filter((a) => a.pinned)
  if (pinned.length) groups.push({ key: 'pinned', title: 'Fixate sus', items: pinned })
  for (const a of items.filter((x) => !x.pinned)) {
    const raw = monthFormat.format(new Date(a.createdAt))
    const title = raw.charAt(0).toLocaleUpperCase('ro-RO') + raw.slice(1)
    const group = groups.find((g) => g.key === title)
    if (group) group.items.push(a)
    else groups.push({ key: title, title, items: [a] })
  }
  return groups
}
