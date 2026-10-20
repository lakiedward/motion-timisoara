import type { AdminSession } from '@/api/attendance/admin-sessions'
import {
  filterSessions,
  formatDay,
  groupSessionsByOrganizer,
  isUnmarked,
  sessionStatusCounts,
  sportCounts,
} from './attendance-overview'

const NOW = new Date('2026-10-20T12:00:00').getTime()

function session(p: Partial<AdminSession> & { id: string; startsAt: string }): AdminSession {
  return {
    endsAt: p.startsAt,
    courseId: 'k1',
    courseName: 'Înot mic',
    locationName: 'Bazinul Olimpic',
    sportId: 's1',
    sportName: 'Înot',
    coachName: 'Radu Stan',
    organizerKey: 'club:c1',
    organizerKind: 'club',
    organizerName: 'Clubul Delfinul',
    enrolledCount: 4,
    markedCount: 0,
    ...p,
  }
}

const at = (d: string) => new Date(d).toISOString()

const items = [
  session({ id: 'past-unmarked', startsAt: at('2026-10-18T17:00:00') }),
  session({ id: 'past-partial', startsAt: at('2026-10-19T17:00:00'), markedCount: 2 }),
  session({ id: 'past-done', startsAt: at('2026-10-17T17:00:00'), markedCount: 4 }),
  session({ id: 'past-empty', startsAt: at('2026-10-16T17:00:00'), enrolledCount: 0 }),
  session({ id: 'today-early', startsAt: at('2026-10-20T09:00:00') }),
  session({
    id: 'today-later',
    startsAt: at('2026-10-20T18:00:00'),
    organizerKey: 'coach:u1',
    organizerKind: 'coach',
    organizerName: 'Ana Rusu',
    sportId: 's2',
    sportName: 'Tenis',
    courseName: 'Tenis copii',
    locationName: 'Baza Bega',
  }),
  session({ id: 'next', startsAt: at('2026-10-22T17:00:00') }),
]

describe('attendance overview', () => {
  it('treats only started sessions with unmarked children as unmarked', () => {
    expect(items.filter((s) => isUnmarked(s, NOW)).map((s) => s.id)).toEqual([
      'past-unmarked',
      'past-partial',
      'today-early',
    ])
  })

  it('counts every status', () => {
    expect(sessionStatusCounts(items, NOW)).toEqual({
      today: 2,
      unmarked: 3,
      upcoming: 2,
      past: 5,
      all: 7,
    })
  })

  it('filters by status, sport and folded query', () => {
    const f = { status: 'all' as const, sport: '', query: '' }
    expect(filterSessions(items, { ...f, sport: 's2' }, NOW).map((s) => s.id)).toEqual([
      'today-later',
    ])
    expect(filterSessions(items, { ...f, query: 'BEGA' }, NOW).map((s) => s.id)).toEqual([
      'today-later',
    ])
    expect(filterSessions(items, { ...f, query: 'radu' }, NOW)).toHaveLength(7)
    expect(filterSessions(items, { ...f, status: 'upcoming' }, NOW).map((s) => s.id)).toEqual([
      'today-later',
      'next',
    ])
  })

  it('lists sports with counts in name order', () => {
    expect(sportCounts(items)).toEqual([
      { id: 's1', name: 'Înot', count: 6 },
      { id: 's2', name: 'Tenis', count: 1 },
    ])
  })

  it('groups clubs before independent coaches with unmarked totals', () => {
    const visible = filterSessions(items, { status: 'unmarked', sport: '', query: '' }, NOW)
    const groups = groupSessionsByOrganizer(items, visible, 'unmarked', NOW)
    expect(groups.map((g) => [g.name, g.unmarkedCount, g.totalCount])).toEqual([
      ['Clubul Delfinul', 3, 6],
    ])
    expect(groups[0].items.map((s) => s.id)).toEqual([
      'today-early',
      'past-partial',
      'past-unmarked',
    ])
    const all = groupSessionsByOrganizer(items, items, 'all', NOW)
    expect(all.map((g) => g.kind)).toEqual(['club', 'coach'])
  })

  it('labels days relative to today', () => {
    expect(formatDay(at('2026-10-20T18:00:00'), NOW)).toBe('Azi, marți 20 octombrie')
    expect(formatDay(at('2026-10-19T18:00:00'), NOW)).toBe('Ieri, luni 19 octombrie')
    expect(formatDay(at('2026-10-21T18:00:00'), NOW)).toBe('Mâine, miercuri 21 octombrie')
    expect(formatDay(at('2026-10-15T18:00:00'), NOW)).toBe('Joi 15 octombrie')
  })
})
