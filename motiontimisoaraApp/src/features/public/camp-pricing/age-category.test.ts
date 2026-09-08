import { describe, expect, it } from 'vitest'
import { ageAtCampStart, matchesAgeCategory } from './age-category'

describe('age at the camp start date', () => {
  it.each([
    ['2018-09-13', '2026-09-12', 7],
    ['2018-09-13', '2026-09-13', 8],
    ['2018-09-13', '2026-09-14', 8],
    ['2020-02-29', '2027-02-28', 6],
    ['2020-02-29', '2027-03-01', 7],
    ['2020-02-29', '2028-02-29', 8],
    ['2026-09-13', '2026-09-13', 0],
    ['2027-01-01', '2026-09-13', null],
    ['2025-02-29', '2026-09-13', null],
    ['invalid', '2026-09-13', null],
  ])('%s at %s is %s', (birthDate, startDate, age) => {
    expect(ageAtCampStart(birthDate, startDate)).toBe(age)
  })

  it('includes both interval limits and excludes adjacent ages', () => {
    const category = { age_from: 6, age_to: 8 }
    expect([null, 5, 6, 7, 8, 9].map((age) => matchesAgeCategory(age, category)))
      .toEqual([false, false, true, true, true, false])
  })
})
