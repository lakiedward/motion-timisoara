import { expect, test } from 'vitest'

import type { CopilInscris } from '@/api/camp-enrolled'
import {
  ageGroup,
  alertCounts,
  arrivalState,
  filterParticipants,
  groupByAge,
  matchesParticipantQuery,
  NO_PARTICIPANT_FILTERS,
} from './participant-list'

function p(partial: Partial<CopilInscris>): CopilInscris {
  return {
    enrollmentId: 'e',
    stare: 'ACTIVE',
    inscrisLa: '2026-09-01T00:00:00Z',
    fel: 'child',
    copilId: 'c',
    nume: 'Copil',
    dataNasterii: null,
    marimeTricou: null,
    alergii: null,
    contactUrgenta: null,
    telefonUrgenta: null,
    contactSecundar: null,
    telefonSecundar: null,
    acordFoto: null,
    cineRidica: null,
    inot: null,
    afectiuni: null,
    restrictiiAlimentare: null,
    ...partial,
  }
}

test('grupa de vârstă se calculează la începutul taberei', () => {
  expect(ageGroup(p({ dataNasterii: '2019-07-15' }), '2026-07-14')).toBe('u8')
  expect(ageGroup(p({ dataNasterii: '2018-07-14' }), '2026-07-14')).toBe('8-10')
  expect(ageGroup(p({ dataNasterii: '2013-01-01' }), '2026-07-14')).toBe('11-13')
  expect(ageGroup(p({ dataNasterii: '2012-01-01' }), '2026-07-14')).toBe('14+')
  expect(ageGroup(p({}), '2026-07-14')).toBe('unknown')
  expect(ageGroup(p({ fel: 'adult' }), '2026-07-14')).toBe('adult')
})

test('grupele sunt în ordine și sortate alfabetic', () => {
  const groups = groupByAge(
    [
      p({ enrollmentId: '1', nume: 'Zoe', dataNasterii: '2020-01-01' }),
      p({ enrollmentId: '2', nume: 'Adult', fel: 'adult' }),
      p({ enrollmentId: '3', nume: 'Ana', dataNasterii: '2020-02-01' }),
    ],
    '2026-07-14',
  )
  expect(groups.map((g) => g.key)).toEqual(['u8', 'adult'])
  expect(groups[0]!.items.map((x) => x.nume)).toEqual(['Ana', 'Zoe'])
})

test('căutarea ignoră diacriticele și caută și în contacte și telefoane', () => {
  const copil = p({
    nume: 'Ioana Ștefănescu',
    contactUrgenta: 'Mihai',
    telefonUrgenta: '0722111222',
  })
  expect(matchesParticipantQuery(copil, 'stefanescu')).toBe(true)
  expect(matchesParticipantQuery(copil, 'mihai')).toBe(true)
  expect(matchesParticipantQuery(copil, '0722111')).toBe(true)
  expect(matchesParticipantQuery(copil, 'radu')).toBe(false)
})

test('starea sosirii și filtrele se combină', () => {
  expect(arrivalState(null)).toBe('')
  const arrived = {
    enrollmentId: 'a',
    childName: 'A',
    arrivedAt: '2026-07-14T08:00:00Z',
    departedAt: null,
  }
  expect(arrivalState(arrived)).toBe('arrived')
  expect(arrivalState({ ...arrived, departedAt: '2026-07-20T08:00:00Z' })).toBe('departed')
  const list = [p({ enrollmentId: 'a', alergii: 'Arahide' }), p({ enrollmentId: 'b' })]
  const byEnrollment = new Map([['a', arrived]])
  expect(alertCounts(list).alergii).toBe(1)
  expect(
    filterParticipants(list, { ...NO_PARTICIPANT_FILTERS, arrival: 'arrived' }, byEnrollment),
  ).toHaveLength(1)
  expect(
    filterParticipants(list, { ...NO_PARTICIPANT_FILTERS, alert: 'alergii' }, byEnrollment)[0]!
      .enrollmentId,
  ).toBe('a')
})
