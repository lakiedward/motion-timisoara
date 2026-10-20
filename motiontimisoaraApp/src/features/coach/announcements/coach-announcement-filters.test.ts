import { expect, test } from 'vitest'

import type { CoachAnnouncement } from '@/api/coach-announcements'
import {
  NO_FILTERS,
  courseCounts,
  filterCoachAnnouncements,
  groupAnnouncements,
  hasFilters,
  sourceCounts,
} from './coach-announcement-filters'

const row = (over: Partial<CoachAnnouncement>): CoachAnnouncement => ({
  id: crypto.randomUUID(),
  source: 'coach',
  courseId: 'c1',
  title: null,
  content: 'Antrenament mutat',
  pinned: false,
  priority: null,
  clubName: null,
  createdAt: '2026-10-10T10:00:00Z',
  ...over,
})

const names = { c1: 'Înot începători', c2: 'Atletism' }
const items = [
  row({ content: 'Ședința de joi se ține în bazinul mic' }),
  row({ source: 'club', courseId: 'c2', title: 'Echipament nou', clubName: 'CS Motion' }),
  row({ courseId: 'c2', pinned: true, createdAt: '2026-09-02T10:00:00Z' }),
]

test('caută fără diacritice în text, titlu, curs și club', () => {
  expect(filterCoachAnnouncements(items, { ...NO_FILTERS, query: 'sedinta' }, names)).toHaveLength(
    1,
  )
  expect(filterCoachAnnouncements(items, { ...NO_FILTERS, query: 'inot' }, names)).toHaveLength(1)
  expect(filterCoachAnnouncements(items, { ...NO_FILTERS, query: 'motion' }, names)).toHaveLength(1)
})

test('filtrează după sursă și curs, cu numărători', () => {
  expect(filterCoachAnnouncements(items, { ...NO_FILTERS, source: 'club' }, names)).toHaveLength(1)
  expect(filterCoachAnnouncements(items, { ...NO_FILTERS, course: 'c2' }, names)).toHaveLength(2)
  expect(sourceCounts(items)).toEqual({ all: 3, coach: 2, club: 1 })
  expect(
    courseCounts(items, [
      { id: 'c1', name: 'Înot începători' },
      { id: 'c3', name: 'Fără anunțuri' },
    ]),
  ).toEqual([{ id: 'c1', name: 'Înot începători', count: 1 }])
  expect(hasFilters(NO_FILTERS)).toBe(false)
  expect(hasFilters({ ...NO_FILTERS, course: 'c1' })).toBe(true)
})

test('anunțurile fixate stau primele, restul pe luni', () => {
  const groups = groupAnnouncements(items)
  expect(groups.map((g) => g.title)).toEqual(['Fixate sus', 'Octombrie 2026'])
  expect(groups[1].items).toHaveLength(2)
})
