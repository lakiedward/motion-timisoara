import { expect, test } from 'vitest'

import type { CompetitionListItem } from '@/api/competition/competition-list'
import {
  NO_COMPETITION_FILTERS,
  competitionPrice,
  competitionStatus,
  competitionWhen,
  filterCompetitions,
  groupByOrganizer,
  groupByStatus,
  registrationsClosed,
  statusCounts,
} from './competition-list'

const now = new Date('2026-11-02T12:00:00Z')

function item(over: Partial<CompetitionListItem>): CompetitionListItem {
  return {
    id: 'k',
    slug: 'k',
    title: 'Concurs',
    description: '',
    hero_photo_storage_path: null,
    club_id: 'c1',
    coach_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    start_at: '2026-12-01T08:00:00Z',
    end_at: '2026-12-01T14:00:00Z',
    registration_deadline_at: '2026-11-30T21:59:00Z',
    location_id: null,
    location_text: 'Timișoara',
    allow_cash: false,
    organizer: { key: 'club:c1', kind: 'club', name: 'Club Delfin' },
    prices: [],
    routesCount: 0,
    registeredCount: 0,
    ...over,
  }
}

const viitor = item({ id: 'a', title: 'Cupa de înot' })
const inCurs = item({ id: 'b', start_at: '2026-11-02T08:00:00Z', end_at: '2026-11-02T16:00:00Z' })
const incheiat = item({
  id: 'c',
  start_at: '2026-10-01T08:00:00Z',
  end_at: '2026-10-01T12:00:00Z',
  organizer: { key: 'coach:u1', kind: 'coach', name: 'Ana Pop' },
  registeredCount: 5,
})

test('starea vine din orele concursului', () => {
  expect(competitionStatus(viitor, now)).toBe('upcoming')
  expect(competitionStatus(inCurs, now)).toBe('ongoing')
  expect(competitionStatus(incheiat, now)).toBe('ended')
  expect(competitionStatus(item({ start_at: null, end_at: null }), now)).toBe('upcoming')
  expect(statusCounts([viitor, inCurs, incheiat], now)).toEqual({
    ongoing: 1,
    upcoming: 1,
    ended: 1,
    all: 3,
  })
})

test('înscrierile închise după termen', () => {
  expect(registrationsClosed(viitor, now)).toBe(false)
  expect(registrationsClosed(item({ registration_deadline_at: '2026-11-01T00:00:00Z' }), now)).toBe(
    true,
  )
})

test('data în ora României, pe o zi sau pe mai multe', () => {
  expect(competitionWhen(viitor)).toBe('01.12.2026 · 10:00–16:00')
  expect(competitionWhen(item({ end_at: '2026-12-02T14:00:00Z' }))).toBe('01.12.2026 – 02.12.2026')
  expect(competitionWhen(item({ start_at: null }))).toBe('Fără dată')
})

test('prețul rezumă categoriile', () => {
  expect(competitionPrice(viitor)).toBeNull()
  expect(competitionPrice(item({ prices: [0, 5000] }))).toBe('Gratuit – 50,00 lei')
})

test('căutarea ignoră diacriticele și găsește organizatorul', () => {
  const all = [viitor, inCurs, incheiat]
  expect(filterCompetitions(all, { ...NO_COMPETITION_FILTERS, query: 'inot' }, now)).toEqual([
    viitor,
  ])
  expect(filterCompetitions(all, { ...NO_COMPETITION_FILTERS, query: 'ana' }, now)).toEqual([
    incheiat,
  ])
  expect(filterCompetitions(all, { ...NO_COMPETITION_FILTERS, organizer: 'coach' }, now)).toEqual([
    incheiat,
  ])
  expect(filterCompetitions(all, { ...NO_COMPETITION_FILTERS, status: 'ongoing' }, now)).toEqual([
    inCurs,
  ])
})

test('grupare pe stare și pe organizator', () => {
  const all = [incheiat, viitor, inCurs]
  expect(groupByStatus(all, now).map((g) => [g.status, g.items.map((i) => i.id)])).toEqual([
    ['ongoing', ['b']],
    ['upcoming', ['a']],
    ['ended', ['c']],
  ])
  const groups = groupByOrganizer(all, all, now)
  expect(groups.map((g) => [g.name, g.openCount, g.totalCount, g.registered])).toEqual([
    ['Club Delfin', 2, 2, 0],
    ['Ana Pop', 0, 1, 0],
  ])
})
