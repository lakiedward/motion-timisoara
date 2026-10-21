import { describe, expect, it } from 'vitest'

import { activeAccountTab } from './account-nav'

describe('activeAccountTab', () => {
  it.each([
    ['/account', '/account'],
    ['/account/', '/account'],
    ['/account/children', '/account/children'],
    ['/account/child/new', '/account/children'],
    ['/account/child/abc', '/account/children'],
    ['/account/child/abc/qr', '/account/children'],
    ['/account/enrollments', '/account/enrollments'],
    ['/account/checkout', '/account/enrollments'],
    ['/account/competitions/maraton/register', '/account/enrollments'],
    ['/account/attendance', '/account/attendance'],
    ['/account/announcements', '/account/announcements'],
    ['/account/profile', '/account/profile'],
  ])('%s lights up %s', (path, tab) => {
    expect(activeAccountTab(path)).toBe(tab)
  })

  it('leaves unknown account paths without an active tab', () => {
    expect(activeAccountTab('/account/childrenx')).toBeNull()
    expect(activeAccountTab('/account/unknown')).toBeNull()
  })
})
