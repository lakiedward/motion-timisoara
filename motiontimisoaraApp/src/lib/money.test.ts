import { baniToRon, ronToBani, formatRon } from '@/lib/money'

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
