import { describe, expect, test } from 'vitest'

import {
  choiceDays,
  choiceKey,
  choiceRequest,
  effectiveChoice,
  saleablePackages,
  type CheckoutChoice,
} from './checkout-choice'
import type { CoursePackage } from './course-packages'

const packages: CoursePackage[] = [
  { id: 'pkg-4', position: 1, sessions: 4, price: 18000, validity: 'NONE', validity_days: null },
  { id: 'pkg-m', position: 2, sessions: 12, price: 60000, validity: 'CALENDAR_MONTH', validity_days: null },
  { id: 'pkg-8', position: 0, sessions: 8, price: 32000, validity: 'NONE', validity_days: null },
]

describe('checkout package choice', () => {
  test('packages with and without expiry are sold, in the coach order', () => {
    expect(saleablePackages(packages).map((item) => item.id)).toEqual(['pkg-8', 'pkg-4', 'pkg-m'])
    expect(saleablePackages(undefined)).toEqual([])
  })

  test('a package course always has one of its packages chosen', () => {
    const sold = saleablePackages(packages)
    expect(effectiveChoice(sold, { sessions: 10 })).toEqual({ sessions: 8, packageId: 'pkg-8' })
    expect(effectiveChoice(sold, { sessions: 4, packageId: 'pkg-4' })).toEqual({
      sessions: 4,
      packageId: 'pkg-4',
    })
    expect(effectiveChoice(sold, { sessions: 4, packageId: 'removed' }).packageId).toBe('pkg-8')
  })

  test('a course without packages keeps the free session count', () => {
    expect(effectiveChoice([], { sessions: 7 })).toEqual({ sessions: 7 })
    expect(effectiveChoice([], { sessions: 8, packageId: 'pkg-8' })).toEqual({ sessions: 10 })
  })

  test('the request names the package or the session count, never both', () => {
    const chosen: CheckoutChoice = { sessions: 8, packageId: 'pkg-8' }
    expect(choiceRequest(chosen)).toEqual({ coursePackageId: 'pkg-8' })
    expect(choiceRequest({ sessions: 5 })).toEqual({ sessionPackageSize: 5 })
    expect(choiceKey(chosen)).toBe('pkg-8')
    expect(choiceKey({ sessions: 5 })).toBe('5')
  })

  test('a monthly package carries the current or next Bucharest month', () => {
    const sold = saleablePackages(packages)
    const lateNovember = new Date('2026-11-30T21:30:00Z')
    const earlyDecember = new Date('2026-11-30T22:30:00Z')
    expect(effectiveChoice(sold, { sessions: 12, packageId: 'pkg-m' }, lateNovember)).toEqual({
      sessions: 12,
      packageId: 'pkg-m',
      month: '2026-11',
    })
    expect(
      effectiveChoice(sold, { sessions: 12, packageId: 'pkg-m', month: '2026-12' }, lateNovember)
        .month,
    ).toBe('2026-12')
    expect(
      effectiveChoice(sold, { sessions: 12, packageId: 'pkg-m', month: '2026-11' }, earlyDecember)
        .month,
    ).toBe('2026-12')
    const chosen: CheckoutChoice = { sessions: 12, packageId: 'pkg-m', month: '2026-12' }
    expect(choiceRequest(chosen)).toEqual({ coursePackageId: 'pkg-m', packageMonth: '2026-12' })
    expect(choiceKey(chosen)).toBe('pkg-m:2026-12')
  })
})

describe('packages that expire after N days', () => {
  const days: CoursePackage[] = [
    { id: 'pkg-d', position: 0, sessions: 8, price: 32000, validity: 'DAYS', validity_days: 45 },
  ]

  test('are sold without a month and report their days', () => {
    expect(saleablePackages(days).map((item) => item.id)).toEqual(['pkg-d'])
    const choice = effectiveChoice(days, { sessions: 10 })
    expect(choice).toEqual({ sessions: 8, packageId: 'pkg-d' })
    expect(choiceRequest(choice)).toEqual({ coursePackageId: 'pkg-d' })
    expect(choiceDays(days, choice)).toBe(45)
    expect(choiceDays(packages, { sessions: 8, packageId: 'pkg-8' })).toBeUndefined()
  })
})
