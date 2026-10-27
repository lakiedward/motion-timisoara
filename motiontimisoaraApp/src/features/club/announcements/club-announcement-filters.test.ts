import type { ClubAnnouncement } from '@/api/club'
import {
  NO_FILTERS,
  filterClubAnnouncements,
  hasFilters,
  statusCounts,
  targetCounts,
} from './club-announcement-filters'

const NOW = new Date('2026-10-27T12:00:00Z')

const anunt = (id: string, p: Partial<ClubAnnouncement> = {}) =>
  ({
    id,
    title: `Anunț ${id}`,
    content: 'Text',
    is_active: true,
    publish_at: null,
    expires_at: null,
    audience_kind: 'CLUB',
    audience_id: null,
    created_at: '2026-10-20T09:00:00Z',
    ...p,
  }) as ClubAnnouncement

const items = [
  anunt('vizibil'),
  anunt('programat', { publish_at: '2026-11-01T09:00:00Z' }),
  anunt('expirat', { expires_at: '2026-10-01T09:00:00Z' }),
  anunt('ascuns', { is_active: false }),
  anunt('curs', { audience_kind: 'COURSE', audience_id: 'c1' }),
]

const nume = (a: ClubAnnouncement) => (a.audience_id === 'c1' ? 'Curs: Înot' : 'Tot clubul')
const ids = (list: ClubAnnouncement[]) => list.map((a) => a.id)

test('fiecare stare lasă doar anunțurile ei, iar cele ascunse nu apar ca vizibile', () => {
  const f = (status: typeof NO_FILTERS.status) =>
    ids(filterClubAnnouncements(items, { ...NO_FILTERS, status }, nume, NOW))
  expect(f('live')).toEqual(['vizibil', 'curs'])
  expect(f('scheduled')).toEqual(['programat'])
  expect(f('expired')).toEqual(['expirat'])
  expect(f('hidden')).toEqual(['ascuns'])
  expect(f('all')).toHaveLength(5)
})

test('numărătorile corespund filtrelor', () => {
  expect(statusCounts(items, NOW)).toEqual({
    all: 5,
    live: 2,
    scheduled: 1,
    expired: 1,
    hidden: 1,
  })
})

test('ținta și căutarea se combină, căutarea ignoră diacriticele', () => {
  expect(
    ids(filterClubAnnouncements(items, { ...NO_FILTERS, target: 'COURSE:c1' }, nume, NOW)),
  ).toEqual(['curs'])
  expect(ids(filterClubAnnouncements(items, { ...NO_FILTERS, query: 'inot' }, nume, NOW))).toEqual([
    'curs',
  ])
})

test('țintele apar doar dacă au anunțuri, cu numărul lor', () => {
  expect(
    targetCounts(items, [
      { kind: 'COURSE', id: 'c1', name: 'Înot', active: true },
      { kind: 'ACTIVITY', id: 'a1', name: 'Cros', active: true },
    ]),
  ).toEqual([
    { id: 'CLUB', name: 'Tot clubul', count: 4 },
    { id: 'COURSE:c1', name: 'Curs: Înot', count: 1 },
  ])
})

test('filtrele goale nu contează ca filtru activ', () => {
  expect(hasFilters(NO_FILTERS)).toBe(false)
  expect(hasFilters({ ...NO_FILTERS, query: '  ' })).toBe(false)
  expect(hasFilters({ ...NO_FILTERS, status: 'hidden' })).toBe(true)
})
