import { expect, test } from 'vitest'

import { plural } from './plural'

// Regresie (secțiunea UI #707): rândul de rezumat era construit fix la plural, așa
// că un părinte cu o singură ședință citea „1 prezențe din 1 ședințe înregistrate".
test('la unu se folosește singularul', () => {
  expect(plural(1, 'prezență', 'prezențe')).toBe('1 prezență')
  expect(plural(1, 'ședință înregistrată', 'ședințe înregistrate')).toBe('1 ședință înregistrată')
})

test('de la doi până la nouăsprezece se folosește pluralul simplu', () => {
  expect(plural(2, 'prezență', 'prezențe')).toBe('2 prezențe')
  expect(plural(19, 'ședință', 'ședințe')).toBe('19 ședințe')
})

// Regula care se uită ușor: de la 20 în sus numeralul cere „de".
test('de la douăzeci în sus numeralul cere „de”', () => {
  expect(plural(20, 'ședință', 'ședințe')).toBe('20 de ședințe')
  expect(plural(21, 'ședință', 'ședințe')).toBe('21 de ședințe')
  expect(plural(99, 'ședință', 'ședințe')).toBe('99 de ședințe')
})

// Nu se uită după numărul întreg, ci după ultimele două cifre: 101 nu cere „de”.
test('peste o sută, „de” urmează ultimele două cifre', () => {
  expect(plural(100, 'ședință', 'ședințe')).toBe('100 de ședințe')
  expect(plural(101, 'ședință', 'ședințe')).toBe('101 ședințe')
  expect(plural(119, 'ședință', 'ședințe')).toBe('119 ședințe')
  expect(plural(120, 'ședință', 'ședințe')).toBe('120 de ședințe')
})

test('zero se poartă ca pluralul', () => {
  expect(plural(0, 'prezență', 'prezențe')).toBe('0 prezențe')
})

// Apelantul îngroașă cifra separat, deci are nevoie doar de coada textului.
test('fără număr întoarce doar cuvântul, cu „de” cu tot', () => {
  expect(plural(1, 'prezență', 'prezențe', true)).toBe('prezență')
  expect(plural(3, 'prezență', 'prezențe', true)).toBe('prezențe')
  expect(plural(21, 'ședință', 'ședințe', true)).toBe('de ședințe')
})
