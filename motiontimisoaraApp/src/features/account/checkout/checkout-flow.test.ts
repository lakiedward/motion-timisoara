import { checkoutIsFree, checkoutStepLabels, enrollmentNeedsCardPayment } from './checkout-flow'

test('free checkout stops after confirming the zero total', () => {
  expect(checkoutStepLabels(true, 'CARD')).toEqual(['Copii', 'Detalii'])
  expect(checkoutStepLabels(true, 'CASH')).toEqual(['Copii', 'Detalii'])
})

test('an empty selection is not treated as a free enrollment', () => {
  expect(checkoutIsFree(0, true, 0)).toBe(false)
  expect(checkoutIsFree(1, true, 0)).toBe(true)
  expect(checkoutIsFree(1, false, 0)).toBe(false)
  expect(checkoutIsFree(1, true, 80000)).toBe(false)
})

test('paid checkout keeps billing only for card', () => {
  expect(checkoutStepLabels(false, 'CARD')).toEqual(['Copii', 'Detalii', 'Facturare', 'Plată'])
  expect(checkoutStepLabels(false, 'CASH')).toEqual(['Copii', 'Detalii', 'Plată'])
})

test('card payment is skipped when the accepted total is free', () => {
  expect(enrollmentNeedsCardPayment(0, true)).toBe(false)
  expect(enrollmentNeedsCardPayment(0, false)).toBe(false)
  expect(enrollmentNeedsCardPayment(12000, true)).toBe(true)
  expect(enrollmentNeedsCardPayment(12000, false)).toBe(false)
})
