import { expect, test } from 'vitest'
import { z } from 'zod'

import { formatAgeRange, validateAgeRangeFields } from './age-range'

test('intervalul valid se scrie cu o singură liniuță', () => {
  expect(formatAgeRange(8, 19)).toBe('8–19 ani')
  expect(formatAgeRange(0, 5)).toBe('0–5 ani')
  expect(formatAgeRange(7, 7)).toBe('7–7 ani')
})

test('o singură limită dă text de la / până la', () => {
  expect(formatAgeRange(8, null)).toBe('de la 8 ani')
  expect(formatAgeRange(null, 14)).toBe('până la 14 ani')
  expect(formatAgeRange(null, undefined)).toBeNull()
})

test('o limită negativă sau inversată nu mai produce „8–-19 ani”', () => {
  expect(formatAgeRange(8, -19)).toBe('de la 8 ani')
  expect(formatAgeRange(-3, 10)).toBe('până la 10 ani')
  expect(formatAgeRange(12, 6)).toBe('de la 12 ani')
  expect(formatAgeRange(-1, -2)).toBeNull()
  expect(formatAgeRange(8.5, 200)).toBeNull()
  for (const [from, to] of [
    [8, -19],
    [-8, -19],
    [3, -1],
  ]) {
    expect(formatAgeRange(from, to) ?? '').not.toContain('–-')
  }
})

const schema = z
  .object({ age_from: z.string().optional(), age_to: z.string().optional() })
  .superRefine(validateAgeRangeFields)

const issues = (age_from: string, age_to: string) => {
  const result = schema.safeParse({ age_from, age_to })
  return result.success ? [] : result.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`)
}

test('formularul acceptă intervale valide și câmpuri goale', () => {
  expect(issues('8', '19')).toEqual([])
  expect(issues('', '14')).toEqual([])
  expect(issues('', '')).toEqual([])
})

test('formularul refuză vârste negative, zecimale sau inversate', () => {
  expect(issues('8', '-19')).toEqual(['age_to: Vârsta trebuie să fie între 0 și 99 ani.'])
  expect(issues('6.5', '')).toEqual(['age_from: Scrie vârsta ca număr întreg.'])
  expect(issues('12', '6')).toEqual([
    'age_to: Vârsta maximă nu poate fi mai mică decât cea minimă.',
  ])
})
