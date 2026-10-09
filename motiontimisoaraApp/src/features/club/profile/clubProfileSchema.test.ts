import { expect, test } from 'vitest'

import { isValidWebsite, normalizeWebsite } from './clubProfileSchema'

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
