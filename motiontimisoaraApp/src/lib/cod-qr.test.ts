import { expect, test } from 'vitest'

import { codQr, tokenDinCod } from './cod-qr'

const TOKEN = '3f1c2a9e8b7d4c6f5a2e1d0c9b8a7f6e'

test('codul poartă versiunea formatului înaintea tokenului', () => {
  expect(codQr(TOKEN)).toBe(`MT1:${TOKEN}`)
})

test('un cod de-al nostru se citește înapoi, cu spații în plus cu tot', () => {
  expect(tokenDinCod(`  MT1:${TOKEN}\n`)).toBe(TOKEN)
})

// Un scanner primește orice: URL-uri, bilete, alte aplicații. Nimic din ce nu e
// exact formatul nostru nu devine „un copil".
test('un cod străin sau stricat nu dă token', () => {
  expect(tokenDinCod('https://example.com/x')).toBeNull()
  expect(tokenDinCod(`MT2:${TOKEN}`)).toBeNull()
  expect(tokenDinCod('MT1:scurt')).toBeNull()
  expect(tokenDinCod(`MT1:${TOKEN.toUpperCase()}`)).toBeNull()
  expect(tokenDinCod('')).toBeNull()
})
