import { expect, test } from 'vitest'

import { filterClubOffer, offerTotal, type ClubOffer } from './club-offer'

const offer = {
  courses: [
    { id: 'c1', name: 'Înot pentru începători', sport: { name: 'Înot' } },
    { id: 'c2', name: 'Grupa avansați', sport: { name: 'Atletism' } },
  ],
  camps: [{ id: 't1', title: 'Tabăra de vară la munte' }],
  activities: [{ id: 'a1', name: 'Ziua porților deschise', sportName: 'Înot' }],
} as unknown as ClubOffer

test('an empty search keeps every group untouched', () => {
  expect(filterClubOffer(offer, '  ')).toBe(offer)
  expect(offerTotal(offer)).toBe(4)
})

test('search matches names and sports across all three groups, ignoring case', () => {
  const result = filterClubOffer(offer, 'ÎNOT')
  expect(result.courses.map((c) => c.id)).toEqual(['c1'])
  expect(result.camps).toEqual([])
  expect(result.activities.map((a) => a.id)).toEqual(['a1'])
})

test('search finds a camp by its title', () => {
  const result = filterClubOffer(offer, 'munte')
  expect(offerTotal(result)).toBe(1)
  expect(result.camps[0]?.id).toBe('t1')
})
