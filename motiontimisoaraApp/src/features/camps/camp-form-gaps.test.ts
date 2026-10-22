import {
  componenteCompletate,
  etichetaVarsta,
  mesajVarsteNeacoperite,
  varsteNeacoperite,
} from './camp-form-totals'

test('găsește vârstele rămase fără preț între categorii', () => {
  expect(
    varsteNeacoperite([
      { age_from: '7', age_to: '10' },
      { age_from: '12', age_to: '14' },
    ]),
  ).toEqual([11])
  expect(
    varsteNeacoperite([
      { age_from: '6', age_to: '8' },
      { age_from: '9', age_to: '12' },
    ]),
  ).toEqual([])
  expect(varsteNeacoperite([{ age_from: '7', age_to: '10' }])).toEqual([])
  expect(
    varsteNeacoperite([
      { age_from: '5', age_to: '6' },
      { age_from: '', age_to: '' },
      { age_from: '10', age_to: '12' },
    ]),
  ).toEqual([7, 8, 9])
})

test('mesajul pentru vârste fără preț', () => {
  expect(mesajVarsteNeacoperite([])).toBeNull()
  expect(mesajVarsteNeacoperite([11])).toBe(
    'Vârsta de 11 ani nu are preț: copiii de 11 ani nu se pot înscrie.',
  )
  expect(mesajVarsteNeacoperite([7, 8, 9])).toBe(
    'Vârstele de 7, 8 și 9 ani nu au preț: copiii de 7, 8 și 9 ani nu se pot înscrie.',
  )
})

test('totalul se arată doar când toate sumele sunt completate', () => {
  expect(componenteCompletate([{ amount_lei: '' }])).toBe(false)
  expect(componenteCompletate([{ amount_lei: '0' }])).toBe(true)
  expect(componenteCompletate([{ amount_lei: '100' }, { amount_lei: '' }])).toBe(false)
  expect(componenteCompletate([])).toBe(false)
})

test('eticheta vârstei din antetul categoriei', () => {
  expect(etichetaVarsta('7', '10')).toBe('7–10 ani')
  expect(etichetaVarsta('', '')).toBe('Vârstă necompletată')
  expect(etichetaVarsta('7', '')).toBe('7–? ani')
})
