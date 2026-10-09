import { expect, test } from 'vitest'

import {
  isValidCui,
  isValidRomanianIban,
  isValidWebsite,
  normalizeIban,
  normalizeWebsite,
} from './clubProfileSchema'

test('website gets https when missing and rejects text that is not a link', () => {
  expect(normalizeWebsite('clubul-tau.ro')).toBe('https://clubul-tau.ro')
  expect(normalizeWebsite('http://clubul-tau.ro')).toBe('http://clubul-tau.ro')
  expect(normalizeWebsite('  ')).toBe('')
  expect(isValidWebsite('clubul-tau.ro')).toBe(true)
  expect(isValidWebsite('https://www.clubul-tau.ro/despre')).toBe(true)
  expect(isValidWebsite('')).toBe(true)
  expect(isValidWebsite('exemplu')).toBe(false)
  expect(isValidWebsite('ftp://clubul-tau.ro')).toBe(false)
  expect(isValidWebsite('nu e link.ro')).toBe(false)
})

test('IBAN must be a Romanian IBAN with valid check digits', () => {
  expect(isValidRomanianIban('RO49AAAA1B31007593840000')).toBe(true)
  expect(isValidRomanianIban('ro49 aaaa 1b31 0075 9384 0000')).toBe(true)
  expect(normalizeIban('ro49 aaaa 1b31 0075 9384 0000')).toBe('RO49AAAA1B31007593840000')
  expect(isValidRomanianIban('RO48AAAA1B31007593840000')).toBe(false)
  expect(isValidRomanianIban('DE89370400440532013000')).toBe(false)
  expect(isValidRomanianIban('123')).toBe(false)
  expect(isValidRomanianIban('')).toBe(true)
})

test('CUI is digits with an optional RO prefix', () => {
  expect(isValidCui('12345678')).toBe(true)
  expect(isValidCui('RO12345678')).toBe(true)
  expect(isValidCui('ro 12345678')).toBe(true)
  expect(isValidCui('')).toBe(true)
  expect(isValidCui('RO12A45')).toBe(false)
  expect(isValidCui('1')).toBe(false)
})
