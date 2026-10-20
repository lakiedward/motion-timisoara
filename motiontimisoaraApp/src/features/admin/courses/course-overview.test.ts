import type { AdminCourse } from '@/api/admin'
import {
  attentionReason,
  filterCourses,
  groupByOrganizer,
  overviewLine,
  sportCounts,
  statusCounts,
} from './course-overview'

function curs(over: Partial<AdminCourse> & { id: string }): AdminCourse {
  return {
    name: over.id,
    active: true,
    capacity: 10,
    sport_id: 's1',
    sport: { name: 'Înot' },
    club_id: null,
    club: null,
    coach_id: 'k1',
    coach: { name: 'Ana Pop' },
    enrollments: { active: 2, pending: 0 },
    ...over,
  } as AdminCourse
}

test('motivul de verificat: inactiv cu copii, apoi cereri in asteptare, apoi locuri epuizate', () => {
  expect(
    attentionReason(curs({ id: 'a', active: false, enrollments: { active: 1, pending: 3 } })),
  ).toBe('Inactiv, dar are 1 înscriere activă')
  expect(attentionReason(curs({ id: 'b', enrollments: { active: 1, pending: 20 } }))).toBe(
    '20 de înscrieri în așteptare',
  )
  expect(
    attentionReason(curs({ id: 'c', capacity: 2, enrollments: { active: 2, pending: 0 } })),
  ).toBe('Locuri epuizate')
  expect(
    attentionReason(curs({ id: 'd', capacity: null, enrollments: { active: 9, pending: 0 } })),
  ).toBeNull()
  expect(
    attentionReason(curs({ id: 'e', active: false, enrollments: { active: 0, pending: 0 } })),
  ).toBeNull()
})

test('numaratorii pe stare si pe sport', () => {
  const lista = [
    curs({ id: 'a' }),
    curs({
      id: 'b',
      active: false,
      sport_id: 's2',
      sport: { name: 'Ciclism' },
      enrollments: { active: 0, pending: 0 },
    }),
    curs({ id: 'c', enrollments: { active: 0, pending: 1 } }),
  ]
  expect(statusCounts(lista)).toEqual({ active: 2, inactive: 1, attention: 1, all: 3 })
  expect(sportCounts(lista)).toEqual([
    { id: 's2', name: 'Ciclism', count: 1 },
    { id: 's1', name: 'Înot', count: 2 },
  ])
})

test('cautarea acopera cursul, antrenorul si clubul, fara diacritice', () => {
  const lista = [
    curs({ id: 'Înot copii' }),
    curs({ id: 'x', club_id: 'c1', club: { name: 'CSM Timișoara' } }),
  ]
  const cauta = (query: string) =>
    filterCourses(lista, { status: 'all', sport: '', query }).map((c) => c.id)
  expect(cauta('inot')).toEqual(['Înot copii'])
  expect(cauta('timisoara')).toEqual(['x'])
  expect(cauta('ana pop')).toEqual(['Înot copii', 'x'])
})

test('gruparea pe organizator pastreaza rezumatul intreg chiar daca filtrul ascunde cursuri', () => {
  const toate = [
    curs({
      id: 'a',
      club_id: 'c1',
      club: { name: 'Club' },
      enrollments: { active: 4, pending: 0 },
    }),
    curs({ id: 'b', club_id: 'c1', club: { name: 'Club' }, active: false }),
    curs({ id: 'c' }),
    curs({ id: 'd', coach_id: 'k2', coach: { name: 'Bogdan' }, active: false }),
  ]
  const vizibile = filterCourses(toate, { status: 'active', sport: '', query: '' })
  const grupuri = groupByOrganizer(toate, vizibile)

  expect(grupuri.map((g) => [g.kind, g.name, g.courses.map((c) => c.id)])).toEqual([
    ['coach', 'Ana Pop', ['c']],
    ['club', 'Club', ['a']],
  ])
  expect(grupuri[1]).toMatchObject({
    activeCount: 1,
    totalCount: 2,
    enrolledChildren: 4,
    attentionCount: 1,
  })
  expect(overviewLine(grupuri, 'active', 2)).toBe(
    '2 cursuri active la 1 club și 1 antrenor independent',
  )
})
