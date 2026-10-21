import type { CoachActivity } from '@/api/coach'
import {
  activityDateLine,
  coachActivityStatusCounts,
  filterCoachActivities,
  groupByMonth,
  hasCoachActivityFilters,
  NO_COACH_ACTIVITY_FILTERS,
} from './coach-activity-overview'

const TODAY = '2026-10-20'

function act(p: Partial<CoachActivity> & { id: string }): CoachActivity {
  return {
    name: 'Atelier',
    activity_date: '2026-10-23',
    start_time: '09:00:00',
    end_time: '11:30:00',
    active: true,
    sport_id: 's1',
    sport: { id: 's1', code: 'swim', name: 'Înot' },
    location: { id: 'l1', name: 'Bazin Neptun' },
    price: 5000,
    currency: 'RON',
    enrolled: 0,
    ...p,
  } as CoachActivity
}

const list = [
  act({ id: 'today', activity_date: TODAY, start_time: '18:00:00' }),
  act({ id: 'soon', activity_date: TODAY, start_time: '08:00:00' }),
  act({ id: 'dec', activity_date: '2026-12-01' }),
  act({ id: 'old', activity_date: '2026-09-01' }),
  act({ id: 'older', activity_date: '2026-08-01' }),
  act({ id: 'off', active: false, activity_date: '2026-11-01' }),
]

test('counts by status in Bucharest days', () => {
  expect(coachActivityStatusCounts(list, TODAY)).toEqual({
    upcoming: 3,
    past: 2,
    inactive: 1,
    all: 6,
  })
})

test('upcoming sorts nearest first, past sorts most recent first', () => {
  const ids = (status: 'upcoming' | 'past') =>
    filterCoachActivities(list, { ...NO_COACH_ACTIVITY_FILTERS, status }, TODAY).map((a) => a.id)
  expect(ids('upcoming')).toEqual(['soon', 'today', 'dec'])
  expect(ids('past')).toEqual(['old', 'older'])
})

test('search ignores diacritics and matches the location', () => {
  const items = [
    act({ id: 'a', name: 'Înot liber' }),
    act({ id: 'b', name: 'Cros', location: { id: 'l2', name: 'Parcul Rozelor' } }),
  ]
  const find = (query: string) =>
    filterCoachActivities(items, { status: 'all', sport: '', query }, TODAY).map((a) => a.id)
  expect(find('inot')).toEqual(['a'])
  expect(find('rozelor')).toEqual(['b'])
})

test('groups by month with a counted title', () => {
  const months = groupByMonth(
    filterCoachActivities(list, { ...NO_COACH_ACTIVITY_FILTERS, status: 'all' }, TODAY),
  )
  expect(months.map((m) => m.title)).toEqual([
    'Decembrie 2026 · 1 activitate',
    'Noiembrie 2026 · 1 activitate',
    'Octombrie 2026 · 2 activități',
    'Septembrie 2026 · 1 activitate',
    'August 2026 · 1 activitate',
  ])
})

test('date line shows the Romanian weekday, date and time range', () => {
  expect(activityDateLine(act({ id: 'x' }))).toBe('Vineri, 23.10.2026 · 09:00–11:30')
})

test('only the cleared state has no filters', () => {
  expect(hasCoachActivityFilters(NO_COACH_ACTIVITY_FILTERS)).toBe(true)
  expect(hasCoachActivityFilters({ status: 'all', sport: '', query: ' ' })).toBe(false)
})
