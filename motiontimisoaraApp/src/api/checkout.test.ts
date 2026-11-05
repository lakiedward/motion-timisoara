import { checkoutErrorMessage, PARENT_ACCOUNT_REQUIRED } from './checkout'

test('mesajul serverului pentru cont fără rol de părinte apare în română', () => {
  expect(checkoutErrorMessage('Only parents can enroll children')).toBe(PARENT_ACCOUNT_REQUIRED)
})

test('mesajele englezești cu valori se traduc păstrând numele și numerele', () => {
  expect(checkoutErrorMessage('Child already enrolled: Ana')).toBe('Ana are deja o înscriere aici.')
  expect(checkoutErrorMessage('Not enough spots. Requested: 3, Available: 1')).toBe(
    'Locuri insuficiente: mai sunt 1, ai nevoie de 3.',
  )
  expect(checkoutErrorMessage('Cash payments not allowed for this camp')).toBe(
    'La această tabără se plătește doar cu cardul.',
  )
})

test('mesajele deja în română trec neschimbate', () => {
  expect(
    checkoutErrorMessage('Prețul s-a schimbat. Revino la Detalii și verifică din nou suma.'),
  ).toBe('Prețul s-a schimbat. Revino la Detalii și verifică din nou suma.')
})
