import { expect, test } from 'vitest'

import { formatLevel, toLevelSlug } from './level'

// Regresie (secțiunea UI #447): în `children.level` s-au strâns și valori cu
// diacritice. Un `<select>` cu opțiuni pe slug nu le potrivea, cădea pe „fără
// selecție", iar prima salvare ștergea nivelul fără ca părintele să atingă câmpul.
test('nivelul scris cu diacritice ajunge la slugul din listă', () => {
  expect(toLevelSlug('începător')).toBe('incepator')
  expect(toLevelSlug('Începător')).toBe('incepator')
})

test('majusculele și spațiile în plus nu încurcă potrivirea', () => {
  expect(toLevelSlug('  AVANSAT ')).toBe('avansat')
  expect(toLevelSlug('Intermediar')).toBe('intermediar')
})

// Nu inventăm un nivel pe care nimeni nu l-a ales: apelantul decide ce face cu o
// valoare pe care n-o recunoaștem (formularul o păstrează ca opțiune în plus).
test('o valoare necunoscută nu e forțată într-un slug', () => {
  expect(toLevelSlug('expert')).toBe('')
  expect(toLevelSlug('')).toBe('')
  expect(toLevelSlug(null)).toBe('')
  expect(toLevelSlug(undefined)).toBe('')
})

test('eticheta afișată rămâne cea cu diacritice', () => {
  expect(formatLevel('incepator')).toBe('Începător')
  expect(formatLevel('avansat')).toBe('Avansat')
})

// `formatLevel` cade înapoi pe valoarea brută, deci un nivel străin se vede ca atare
// în loc să dispară de pe ecran.
test('un nivel necunoscut se afișează așa cum e scris', () => {
  expect(formatLevel('expert')).toBe('expert')
  expect(formatLevel(null)).toBeNull()
})
