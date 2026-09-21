import { baniToRon, ronToBani, formatRon, formatOfferPrice, formatRonOffer, rezumatPretPeVarsta } from '@/lib/money'

test('baniToRon converts minor units to major', () => {
  expect(baniToRon(12345)).toBe(123.45)
  expect(baniToRon(0)).toBe(0)
})

test('ronToBani converts major units to integer minor units', () => {
  expect(ronToBani(123.45)).toBe(12345)
  expect(ronToBani(10)).toBe(1000)
})

test('ronToBani rounds to the nearest bani (no float drift)', () => {
  expect(ronToBani(19.99)).toBe(1999)
})

test('formatRon renders Romanian currency from bani', () => {
  const out = formatRon(12345)
  expect(out).toContain('123,45')
  expect(out.toLowerCase()).toContain('lei')
})

test('zero offer prices are shown as Gratuit', () => {
  expect(formatOfferPrice(0, 'RON')).toBe('Gratuit')
  expect(formatOfferPrice(0, 'EUR')).toBe('Gratuit')
  expect(formatRonOffer(0)).toBe('Gratuit')
  expect(formatOfferPrice(60000, 'RON')).toContain('600,00')
})

test('age-price summary uses the same en dash as a date range', () => {
  expect(rezumatPretPeVarsta([], 'RON')).toBe('Gratuit')
  expect(rezumatPretPeVarsta([0], 'EUR')).toBe('Gratuit')
  expect(rezumatPretPeVarsta([60000, 60000], 'RON')).toBe(formatOfferPrice(60000, 'RON'))
  expect(rezumatPretPeVarsta([0, 60000], 'RON')).toBe('Gratuit – 600,00 lei')
  expect(rezumatPretPeVarsta([40000, 80000], 'EUR')).toBe('400,00 EUR – 800,00 EUR')
})
