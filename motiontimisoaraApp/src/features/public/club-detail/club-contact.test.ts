import { expect, test } from 'vitest'

import type { ClubListItem } from '@/api/public'
import { clubAddress, clubContactRows, websiteHref, websiteLabel } from './club-contact'

const base = {
  address: null,
  city: null,
  phone: null,
  public_email: null,
  website: null,
} as unknown as ClubListItem

test('a website without a protocol gets https and shows only the domain', () => {
  expect(websiteHref('club.ro')).toBe('https://club.ro')
  expect(websiteHref('http://club.ro/x')).toBe('http://club.ro/x')
  expect(websiteLabel('https://www.club.ro/despre')).toBe('club.ro')
})

test('the address joins street and city and skips blanks', () => {
  expect(clubAddress({ address: ' Str. A 1 ', city: 'Timișoara' })).toBe('Str. A 1, Timișoara')
  expect(clubAddress({ address: '  ', city: null })).toBe('')
})

test('rows keep the order address, phone, email, website and only the present ones', () => {
  const rows = clubContactRows({
    ...base,
    city: 'Timișoara',
    phone: '+40 722 123 456',
    website: 'club.ro',
  })
  expect(rows.map((r) => r.kind)).toEqual(['address', 'phone', 'website'])
  expect(rows[1].href).toBe('tel:+40722123456')
  expect(clubContactRows(base)).toEqual([])
})
