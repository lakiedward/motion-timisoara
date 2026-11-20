import { describe, expect, test } from 'vitest'

import {
  choiceKey,
  choiceRequest,
  effectiveChoice,
  saleablePackages,
  type CheckoutChoice,
} from './checkout-choice'
import type { CoursePackage } from './course-packages'

const packages: CoursePackage[] = [
  { id: 'pkg-4', position: 1, sessions: 4, price: 18000, validity: 'NONE' },
  { id: 'pkg-m', position: 2, sessions: 12, price: 60000, validity: 'CALENDAR_MONTH' },
  { id: 'pkg-8', position: 0, sessions: 8, price: 32000, validity: 'NONE' },
]

describe('checkout package choice', () => {
  test('only no-expiry packages are sold, in the coach order', () => {
    expect(saleablePackages(packages).map((item) => item.id)).toEqual(['pkg-8', 'pkg-4'])
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
})
