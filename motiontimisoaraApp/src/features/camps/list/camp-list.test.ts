import type { TabaraDinLista } from '@/api/camps-admin'
import { campStatus, filterCamps, groupByStatus, statusCounts } from './camp-list'

const today = new Date(2026, 9, 21, 12)

const camp = (id: string, period_start: string, period_end: string, title = id) =>
  ({ id, title, period_start, period_end, location_text: 'Băile Herculane' }) as TabaraDinLista

const camps = [
  camp('far', '2027-01-04', '2027-01-08'),
  camp('ongoing', '2026-10-18', '2026-10-21'),
  camp('soon', '2026-10-23', '2026-10-28'),
  camp('old', '2026-03-01', '2026-03-05'),
  camp('recent', '2026-10-01', '2026-10-20'),
]

test('starea taberei ține cont de ziua de azi inclusiv', () => {
  expect(campStatus(camps[1], today)).toBe('ongoing')
  expect(campStatus(camps[2], today)).toBe('upcoming')
  expect(campStatus(camps[4], today)).toBe('ended')
})

test('grupurile apar în ordinea în desfășurare, viitoare, încheiate', () => {
  const groups = groupByStatus(camps, today)
  expect(groups.map((g) => g.status)).toEqual(['ongoing', 'upcoming', 'ended'])
  expect(groups[1].items.map((c) => c.id)).toEqual(['soon', 'far'])
  expect(groups[2].items.map((c) => c.id)).toEqual(['recent', 'old'])
})

test('numărătorile și filtrul de stare folosesc aceeași regulă', () => {
  expect(statusCounts(camps, today)).toEqual({ ongoing: 1, upcoming: 2, ended: 2, all: 5 })
  expect(filterCamps(camps, { status: 'ended', query: '' }, today).map((c) => c.id)).toEqual([
    'old',
    'recent',
  ])
})

test('căutarea ignoră diacriticele și caută și în locație', () => {
  expect(filterCamps(camps, { status: 'all', query: 'baile' }, today)).toHaveLength(5)
  expect(filterCamps(camps, { status: 'all', query: 'SOON' }, today).map((c) => c.id)).toEqual([
    'soon',
  ])
})
