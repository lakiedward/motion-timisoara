import { describe, expect, test } from 'vitest'
import type { Role } from '@/api/auth'
import {
  accountGroups,
  activeDestination,
  bottomNavigation,
  nativeScreen,
} from './navigation-model'

describe('native role navigation', () => {
  test.each<[Role, string[]]>([
    ['PARENT', ['/account', '/exploreaza', '/account/children', '/account/announcements', '/cont']],
    ['COACH', ['/coach', '/coach/courses', '/coach/camps', '/coach/attendance', '/cont']],
    ['CLUB', ['/club', '/club/courses', '/club/camps', '/club/announcements', '/cont']],
    ['ADMIN', ['/admin', '/admin/users', '/admin/clubs', '/admin/camps', '/cont']],
  ])('%s has the accepted five destinations in order', (role, routes) => {
    expect(bottomNavigation(role).map((item) => item.to)).toEqual(routes)
  })

  test('guest destinations do not expose a protected portal', () => {
    expect(bottomNavigation(null).map((item) => item.to)).toEqual([
      '/',
      '/exploreaza',
      '/harta',
      '/cont',
    ])
  })

  test.each<[Role, string[]]>([
    ['COACH', ['/coach/activities', '/coach/locations', '/coach/profile', '/coach/stripe']],
    ['CLUB', ['/club/profile', '/club/coaches', '/club/locations', '/club/stripe']],
    [
      'ADMIN',
      ['/admin/courses', '/admin/sports', '/admin/codes', '/coach/profile', '/coach/stripe'],
    ],
    ['PARENT', ['/account/enrollments', '/account/attendance']],
  ])('%s retains secondary functions in account', (role, expected) => {
    const routes = accountGroups(role).flatMap((group) => group.items.map((item) => item.to))
    expect(routes).toEqual(expect.arrayContaining(expected))
    expect(routes).toContain('/account/children')
    expect(routes.some((path) => path.startsWith('/admin'))).toBe(role === 'ADMIN')
    expect(routes.some((path) => path.startsWith('/club'))).toBe(role === 'CLUB')
  })

  test.each<[string, Role | null, string, string]>([
    ['/account/child/kid/qr', 'PARENT', '/account/children', '/account/children'],
    ['/coach/camps/camp/enrolled', 'COACH', '/coach/camps', '/coach/camps'],
    ['/club/courses/course/edit', 'CLUB', '/club/courses', '/club/courses'],
    ['/coach/children/kid/qr', 'COACH', '/coach/attendance', '/coach/attendance'],
    ['/club/children/kid/qr', 'CLUB', '/club/camps', '/club/camps'],
    ['/account/checkout', 'PARENT', '/cont', '/account/enrollments'],
    ['/tabere/camp', 'PARENT', '/exploreaza', '/tabere'],
    ['/register-coach', null, '/cont', '/signup'],
    ['/club/stripe/onboarding/complete', 'CLUB', '/cont', '/club/stripe'],
  ])('%s preserves context and has a direct-link back destination', (path, role, active, back) => {
    expect(activeDestination(path, role)).toBe(active)
    expect(nativeScreen(path, role).backTo).toBe(back)
  })

  test('route prefixes do not select an unrelated tab', () => {
    expect(activeDestination('/coach/courses-other', 'COACH')).toBe('/cont')
  })
})
