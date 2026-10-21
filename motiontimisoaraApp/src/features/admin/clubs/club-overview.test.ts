import type { AdminClub, AdminCourse } from '@/api/admin'
import {
  NO_CITY,
  NO_CLUB_FILTERS,
  clubCityCounts,
  filterClubs,
  groupClubs,
  hasClubFilters,
  summarizeClubs,
} from './club-overview'

const club = (id: string, name: string, city: string | null, email: string | null): AdminClub => ({
  id,
  name,
  approved_at: '2026-09-01T00:00:00Z',
  city,
  email,
})

const course = (club_id: string | null, active: boolean) => ({ club_id, active }) as AdminCourse

const clubs = [
  club('z', 'Zebra', 'Arad', 'z@club.ro'),
  club('a', 'Alpha', 'Timișoara', null),
  club('m', 'Mișcare', null, 'miscare@club.ro'),
]
const courses = [course('a', true), course('a', false), course('z', false), course(null, true)]

test('summarizeClubs sorts A→Z and counts active and total courses per club', () => {
  const s = summarizeClubs(clubs, courses)
  expect(s.map((c) => [c.name, c.activeCourses, c.totalCourses])).toEqual([
    ['Alpha', 1, 2],
    ['Mișcare', 0, 0],
    ['Zebra', 0, 1],
  ])
})

test('filterClubs combines city and diacritic-insensitive query', () => {
  const s = summarizeClubs(clubs, courses)
  const names = (f: Partial<typeof NO_CLUB_FILTERS>) =>
    filterClubs(s, { ...NO_CLUB_FILTERS, ...f }).map((c) => c.name)
  expect(names({})).toEqual(['Alpha', 'Mișcare', 'Zebra'])
  expect(names({ city: 'arad' })).toEqual(['Zebra'])
  expect(names({ city: NO_CITY })).toEqual(['Mișcare'])
  expect(names({ query: 'miscare@' })).toEqual(['Mișcare'])
  expect(names({ query: 'timisoara' })).toEqual(['Alpha'])
  expect(names({ city: 'arad', query: 'alpha' })).toEqual([])
})

test('city counts cover the whole list; clubs without a city sort last', () => {
  const s = summarizeClubs(clubs, courses)
  expect(clubCityCounts(s)).toEqual([
    { id: 'arad', name: 'Arad', count: 1 },
    { id: 'timisoara', name: 'Timișoara', count: 1 },
    { id: NO_CITY, name: 'Fără oraș', count: 1 },
  ])
})

test('city spellings with and without diacritics share one group, named by the commonest', () => {
  const s = summarizeClubs(
    [
      club('1', 'A', 'Timișoara', null),
      club('2', 'B', 'Timisoara', null),
      club('3', 'C', 'Timișoara ', null),
    ],
    [],
  )
  expect(clubCityCounts(s)).toEqual([{ id: 'timisoara', name: 'Timișoara', count: 3 }])
})

test('activity groups split active, inactive-only and no-course clubs, skipping empty ones', () => {
  const s = summarizeClubs(clubs, courses)
  expect(groupClubs(s).map((g) => [g.key, g.clubs.map((c) => c.name)])).toEqual([
    ['active', ['Alpha']],
    ['inactive', ['Zebra']],
    ['none', ['Mișcare']],
  ])
})

test('hasClubFilters ignores a blank query', () => {
  expect(hasClubFilters(NO_CLUB_FILTERS)).toBe(false)
  expect(hasClubFilters({ ...NO_CLUB_FILTERS, query: '  ' })).toBe(false)
  expect(hasClubFilters({ ...NO_CLUB_FILTERS, city: 'Arad' })).toBe(true)
})
