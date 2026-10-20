import type { CoachCourse } from '@/api/coach'
import {
  NO_FILTERS,
  filterCoachCourses,
  hasFilters,
  sportCounts,
  statusCounts,
} from './coach-course-filters'

function course(id: string, name: string, sport: string, location: string, active: boolean) {
  return {
    id,
    name,
    active,
    sport_id: sport,
    sport: { id: sport, code: sport, name: sport },
    location: { id: location, name: location, city: 'Timișoara' },
  } as unknown as CoachCourse
}

const courses = [
  course('1', 'Înot începători', 'Înot', 'Bazin Olimpic', true),
  course('2', 'Înot avansați', 'Înot', 'Bazin Audit Motion', false),
  course('3', 'Alergare juniori', 'Alergare', 'Stadion Atletism', true),
]

test('search ignores diacritics and matches the location too', () => {
  expect(filterCoachCourses(courses, { ...NO_FILTERS, query: 'inot' }).map((c) => c.id)).toEqual([
    '1',
    '2',
  ])
  expect(filterCoachCourses(courses, { ...NO_FILTERS, query: 'stadion' }).map((c) => c.id)).toEqual(
    ['3'],
  )
})

test('status and sport filters combine', () => {
  expect(
    filterCoachCourses(courses, { status: 'active', sport: 'Înot', query: '' }).map((c) => c.id),
  ).toEqual(['1'])
  expect(filterCoachCourses(courses, { ...NO_FILTERS, status: 'inactive' })).toHaveLength(1)
  expect(filterCoachCourses(courses, NO_FILTERS)).toHaveLength(3)
})

test('counts per status and per sport, sports sorted by name', () => {
  expect(statusCounts(courses)).toEqual({ active: 2, inactive: 1, all: 3 })
  expect(sportCounts(courses)).toEqual([
    { id: 'Alergare', name: 'Alergare', count: 1 },
    { id: 'Înot', name: 'Înot', count: 2 },
  ])
})

test('hasFilters ignores blank search', () => {
  expect(hasFilters({ ...NO_FILTERS, query: '  ' })).toBe(false)
  expect(hasFilters({ ...NO_FILTERS, sport: 'Înot' })).toBe(true)
})
