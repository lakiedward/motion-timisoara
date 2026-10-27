import type { TabaraAdmin } from '@/api/camps-admin'
import {
  NO_ADMIN_CAMP_FILTERS,
  filterAdminCamps,
  groupCampsByOrganizer,
  organizerCounts,
  overviewLine,
} from './admin-camp-list'

const TODAY = new Date(2026, 9, 27)

const tabara = (id: string, p: Partial<TabaraAdmin> = {}) =>
  ({
    id,
    title: `Tabăra ${id}`,
    location_text: null,
    period_start: '2027-07-10',
    period_end: '2027-07-17',
    club_id: 'c1',
    coach_id: null,
    club: { name: 'Clubul Delfinii' },
    coach: null,
    locuriOcupate: 0,
    ...p,
  }) as TabaraAdmin

const camps = [
  tabara('vara', { locuriOcupate: 3 }),
  tabara('toamna', { period_start: '2026-09-01', period_end: '2026-09-05', locuriOcupate: 9 }),
  tabara('iarna', { period_start: '2027-01-03', period_end: '2027-01-09' }),
  tabara('schi', {
    club_id: null,
    coach_id: 'u1',
    club: null,
    coach: { name: 'Ana Ionescu' },
    location_text: 'Straja',
  }),
  tabara('fara', { club_id: null, coach_id: null, club: null, coach: null }),
]
const ids = (list: TabaraAdmin[]) => list.map((c) => c.id)

test('căutarea găsește după organizator și locație, fără diacritice', () => {
  const q = (query: string) =>
    ids(filterAdminCamps(camps, { ...NO_ADMIN_CAMP_FILTERS, query }, TODAY))
  expect(q('ionescu')).toEqual(['schi'])
  expect(q('straja')).toEqual(['schi'])
  expect(q('delfinii')).toEqual(['vara', 'toamna', 'iarna'])
})

test('filtrul de organizator și starea se combină', () => {
  expect(
    ids(
      filterAdminCamps(
        camps,
        { ...NO_ADMIN_CAMP_FILTERS, organizer: 'club', status: 'ended' },
        TODAY,
      ),
    ),
  ).toEqual(['toamna'])
  expect(organizerCounts(camps)).toEqual([
    { id: 'club', name: 'Club', count: 3 },
    { id: 'coach', name: 'Antrenor', count: 2 },
  ])
})

test('gruparea pune taberele active întâi, cele încheiate la coadă, și numără doar ce e activ', () => {
  const groups = groupCampsByOrganizer(camps, camps, TODAY)
  const club = groups.find((g) => g.key === 'club:c1')!
  expect(ids(club.camps)).toEqual(['iarna', 'vara', 'toamna'])
  expect(club).toMatchObject({ openCount: 2, totalCount: 3, enrolled: 3, kind: 'club' })
  expect(groups.find((g) => g.key === 'coach:null')?.name).toBe('Organizator necunoscut')
})

test('un filtru păstrează totalurile organizatorului, dar ascunde grupurile fără rezultate', () => {
  const visible = filterAdminCamps(camps, { ...NO_ADMIN_CAMP_FILTERS, query: 'vara' }, TODAY)
  const groups = groupCampsByOrganizer(camps, visible, TODAY)
  expect(groups).toHaveLength(1)
  expect(groups[0]).toMatchObject({ totalCount: 3, openCount: 2 })
  expect(ids(groups[0].camps)).toEqual(['vara'])
})

test('rezumatul spune câte tabere și la câți organizatori', () => {
  const groups = groupCampsByOrganizer(camps, camps, TODAY)
  expect(overviewLine(groups, 5)).toBe('5 tabere la 1 club și 2 antrenori independenți')
})
