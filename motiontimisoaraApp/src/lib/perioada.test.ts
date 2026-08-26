import { expect, test } from 'vitest'

import { inceputPerioada } from './perioada'

// Regresie (Bugbot pe PR #38): `new Date(an, luna - 3, zi)` dă pe dinafară când
// luna țintă n-are ziua cerută. Pe 31 mai, „acum 3 luni" devenea 3 martie, deci
// fereastra se deschidea mai târziu decât trebuie și pierdea ședințe care încă
// intrau în interval.
test('trei luni în urmă nu sare peste sfârșitul lunii scurte', () => {
  // 31 mai − 3 luni = februarie, care n-are 31 de zile.
  expect(inceputPerioada('trei-luni', new Date(2026, 4, 31))).toEqual(new Date(2026, 1, 28))
  // 31 decembrie − 3 luni = septembrie, cu 30 de zile.
  expect(inceputPerioada('trei-luni', new Date(2026, 11, 31))).toEqual(new Date(2026, 8, 30))
})

test('trei luni în urmă păstrează ziua când luna țintă o are', () => {
  expect(inceputPerioada('trei-luni', new Date(2026, 7, 26))).toEqual(new Date(2026, 4, 26))
})

// Trecerea peste an, cu lună negativă: ianuarie − 3 luni = octombrie anul trecut.
test('trei luni în urmă trece corect în anul precedent', () => {
  expect(inceputPerioada('trei-luni', new Date(2026, 0, 31))).toEqual(new Date(2025, 9, 31))
  expect(inceputPerioada('trei-luni', new Date(2026, 2, 31))).toEqual(new Date(2025, 11, 31))
})

test('luna curentă începe la întâi, iar tot istoricul nu are limită', () => {
  expect(inceputPerioada('luna', new Date(2026, 7, 26))).toEqual(new Date(2026, 7, 1))
  expect(inceputPerioada('toate', new Date(2026, 7, 26))).toBeNull()
})
