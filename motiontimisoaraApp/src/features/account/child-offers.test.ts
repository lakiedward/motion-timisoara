import { describe, expect, it } from 'vitest'

import { activeOffersByChild } from './child-offers'

describe('activeOffersByChild', () => {
  it('groups current enrollments per child without duplicates', () => {
    const map = activeOffersByChild([
      { child_id: 'a', status: 'ACTIVE', offerTitle: 'Înot' },
      { child_id: 'a', status: 'PENDING', offerTitle: 'Tabăra de vară' },
      { child_id: 'a', status: 'ACTIVE', offerTitle: 'Înot' },
      { child_id: 'b', status: 'ACTIVE', offerTitle: 'Ciclism' },
    ])
    expect(map.get('a')).toEqual(['Înot', 'Tabăra de vară'])
    expect(map.get('b')).toEqual(['Ciclism'])
  })

  it('skips cancelled, adult and untitled enrollments', () => {
    const map = activeOffersByChild([
      { child_id: 'a', status: 'CANCELLED', offerTitle: 'Înot' },
      { child_id: null, status: 'ACTIVE', offerTitle: 'Alergare' },
      { child_id: 'a', status: 'ACTIVE', offerTitle: null },
    ])
    expect(map.size).toBe(0)
  })
})
