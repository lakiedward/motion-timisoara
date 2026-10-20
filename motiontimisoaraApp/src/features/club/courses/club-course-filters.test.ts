import type { ClubCourse } from '@/api/club'
import {
  NO_FILTERS,
  coachCounts,
  courseAgeLabel,
  filterClubCourses,
  hasFilters,
  sportCounts,
  statusCounts,
} from './club-course-filters'

function curs(over: Partial<ClubCourse> & { id: string }): ClubCourse {
  return {
    name: 'Înot începători',
    active: true,
    sport_id: 's1',
    sport: { id: 's1', name: 'Înot' },
    location: { id: 'l1', name: 'Bazin Olimpic Timișoara' },
    coach: { id: 'c1', name: 'Andrei Popescu' },
    ...over,
  } as ClubCourse
}

const lista = [
  curs({ id: '1' }),
  curs({
    id: '2',
    name: 'Atletism juniori',
    active: false,
    sport_id: 's2',
    sport: { id: 's2', name: 'Atletism' },
    location: { id: 'l2', name: 'Stadion Știința' },
    coach: { id: 'c2', name: 'Maria Ionescu' },
  }),
  curs({ id: '3', name: 'Înot avansați', coach: { id: 'c2', name: 'Maria Ionescu' } }),
]

test('căutarea ignoră diacriticele și caută în nume, locație și antrenor', () => {
  expect(filterClubCourses(lista, { ...NO_FILTERS, query: 'stiinta' }).map((c) => c.id)).toEqual([
    '2',
  ])
  expect(filterClubCourses(lista, { ...NO_FILTERS, query: 'ionescu' }).map((c) => c.id)).toEqual([
    '2',
    '3',
  ])
  expect(filterClubCourses(lista, { ...NO_FILTERS, query: 'inot' })).toHaveLength(2)
})

test('filtrele de stare, sport și antrenor se combină', () => {
  expect(filterClubCourses(lista, { ...NO_FILTERS, status: 'inactive' }).map((c) => c.id)).toEqual([
    '2',
  ])
  expect(
    filterClubCourses(lista, { ...NO_FILTERS, sport: 's1', coach: 'c2' }).map((c) => c.id),
  ).toEqual(['3'])
})

test('numărătorile pentru filtre', () => {
  expect(statusCounts(lista)).toEqual({ active: 2, inactive: 1, all: 3 })
  expect(sportCounts(lista)).toEqual([
    { id: 's2', name: 'Atletism', count: 1 },
    { id: 's1', name: 'Înot', count: 2 },
  ])
  expect(coachCounts(lista)).toEqual([
    { id: 'c1', name: 'Andrei Popescu', count: 1 },
    { id: 'c2', name: 'Maria Ionescu', count: 2 },
  ])
})

test('hasFilters și eticheta de vârstă', () => {
  expect(hasFilters(NO_FILTERS)).toBe(false)
  expect(hasFilters({ ...NO_FILTERS, coach: 'c1' })).toBe(true)
  expect(courseAgeLabel(8, 13)).toBe('8–13 ani')
  expect(courseAgeLabel(8, null)).toBe('de la 8 ani')
  expect(courseAgeLabel(null, null)).toBeNull()
})
