import { expect, test } from 'vitest'

import type { AdminActivity } from '@/api/activities/admin-activities'
import {
  NO_ACTIVITY_FILTERS,
  activitySportCounts,
  activityStatusCounts,
  activityWhen,
  countActivities,
  filterActivities,
  groupActivitiesByOrganizer,
  hasActivityFilters,
  organizerOf,
  todayInBucharest,
} from './activity-overview'

const TODAY = '2026-10-20'

function act(p: Partial<AdminActivity> & { id: string; name: string }): AdminActivity {
  return {
    activity_date: '2026-11-05',
    start_time: '10:00:00',
    end_time: '12:30:00',
    active: true,
    club_id: null,
    coach_id: 'u1',
    sport_id: 's1',
    price: 5000,
    currency: 'RON',
    capacity: 10,
    sport: { id: 's1', name: 'Înot' },
    coach: { id: 'u1', name: 'Ana Rusu' },
    location: { id: 'l1', name: 'Bazin Neptun' },
    club: null,
    enrolled: 0,
    ...p,
  } as AdminActivity
}

const delfin = { id: 'c1', name: 'Clubul Delfinul' }
const all = [
  act({ id: '1', name: 'Atelier ciclism', club_id: 'c1', club: delfin, enrolled: 3 }),
  act({ id: '2', name: 'Tură pe Bega', club_id: 'c1', club: delfin, activity_date: '2026-10-01' }),
  act({
    id: '3',
    name: 'Alergare în parc',
    sport_id: 's2',
    sport: { id: 's2', name: 'Alergare' },
    activity_date: '2026-10-20',
    start_time: '08:00:00',
    enrolled: 2,
  }),
  act({ id: '4', name: 'Șantier închis', active: false }),
]

test('organizerOf names the club or the independent coach', () => {
  expect(organizerOf(all[0])).toEqual({ key: 'club:c1', kind: 'club', name: 'Clubul Delfinul' })
  expect(organizerOf(all[2])).toEqual({ key: 'coach:u1', kind: 'coach', name: 'Ana Rusu' })
})

test('status counts treat today as upcoming and inactive separately', () => {
  expect(activityStatusCounts(all, TODAY)).toEqual({ upcoming: 2, past: 1, inactive: 1, all: 4 })
  expect(filterActivities(all, NO_ACTIVITY_FILTERS, TODAY).map((a) => a.id)).toEqual(['1', '3'])
})

test('query matches name, club, coach, location and sport without diacritics', () => {
  const ids = (query: string) =>
    filterActivities(all, { status: 'all', sport: '', query }, TODAY).map((a) => a.id)
  expect(ids('santier')).toEqual(['4'])
  expect(ids('delfinul')).toEqual(['1', '2'])
  expect(ids('neptun')).toHaveLength(4)
  expect(ids('alergare')).toEqual(['3'])
  expect(filterActivities(all, { status: 'all', sport: 's2', query: '' }, TODAY)).toHaveLength(1)
})

test('hasActivityFilters is false only for all statuses with no sport or query', () => {
  expect(hasActivityFilters({ status: 'all', sport: '', query: '  ' })).toBe(false)
  expect(hasActivityFilters(NO_ACTIVITY_FILTERS)).toBe(true)
})

test('sport counts are sorted by Romanian name', () => {
  expect(activitySportCounts(all)).toEqual([
    { id: 's2', name: 'Alergare', count: 1 },
    { id: 's1', name: 'Înot', count: 3 },
  ])
})

test('groups put clubs first and keep totals from every activity', () => {
  const visible = filterActivities(all, NO_ACTIVITY_FILTERS, TODAY)
  const groups = groupActivitiesByOrganizer(all, visible, TODAY, true)
  expect(groups.map((g) => [g.name, g.upcomingCount, g.totalCount, g.enrolled])).toEqual([
    ['Clubul Delfinul', 1, 2, 3],
    ['Ana Rusu', 1, 2, 2],
  ])
  const past = groupActivitiesByOrganizer(all, all, TODAY, false)
  expect(past[0].activities.map((a) => a.id)).toEqual(['1', '2'])
})

test('formats the date, time and count in Romanian', () => {
  expect(activityWhen(all[0])).toMatch(/^joi, 5 nov\.? · 10:00–12:30$/)
  expect(countActivities(1)).toBe('1 activitate')
  expect(countActivities(3)).toBe('3 activități')
  expect(todayInBucharest(new Date('2026-10-19T22:30:00Z'))).toBe('2026-10-20')
})
