import { adminPayment } from '@/test/admin-payment-fixture'
import {
  NO_PAYMENT_FILTERS,
  bucharestDay,
  bucharestMidnight,
  cardLabel,
  filterPayments,
  groupByDay,
  parseRonInput,
  paymentTotals,
  paymentsCsv,
  presetDays,
  rangeOf,
  refundableAmount,
  statusCounts,
  statusLabel,
  validDays,
} from './payment-history'

test('zilele și intervalele folosesc ora României, inclusiv la schimbarea orei', () => {
  expect(bucharestDay('2026-11-03T22:30:00Z')).toBe('2026-11-04')
  expect(bucharestMidnight('2026-11-04')).toBe('2026-11-03T22:00:00.000Z')
  expect(bucharestMidnight('2026-07-01')).toBe('2026-06-30T21:00:00.000Z')
  expect(bucharestMidnight('2026-10-25')).toBe('2026-10-24T21:00:00.000Z')
  expect(rangeOf({ start: '2026-11-01', end: '2026-11-04' })).toEqual({
    from: '2026-10-31T22:00:00.000Z',
    to: '2026-11-04T22:00:00.000Z',
  })
})

test('perioadele rapide pornesc de la ziua de azi din România', () => {
  const now = new Date('2026-11-04T10:00:00Z')
  expect(presetDays('today', now)).toEqual({ start: '2026-11-04', end: '2026-11-04' })
  expect(presetDays('7d', now)).toEqual({ start: '2026-10-29', end: '2026-11-04' })
  expect(presetDays('month', now)).toEqual({ start: '2026-11-01', end: '2026-11-04' })
  expect(presetDays('last-month', now)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
  expect(presetDays('last-month', new Date('2026-01-10T10:00:00Z'))).toEqual({
    start: '2025-12-01',
    end: '2025-12-31',
  })
})

test('intervalul ales trebuie să fie complet, în ordine și de cel mult un an', () => {
  expect(validDays({ start: '', end: '2026-11-04' })).toBe('Alege ambele date.')
  expect(validDays({ start: '2026-11-04', end: '2026-11-01' })).toMatch(/înaintea/)
  expect(validDays({ start: '2025-01-01', end: '2026-11-04' })).toMatch(/un an/)
  expect(validDays({ start: '2025-11-04', end: '2026-11-04' })).toBeNull()
})

test('starea, cardul și filtrele descriu plata', () => {
  const payments = [
    adminPayment(),
    adminPayment({
      id: 'p2',
      method: 'CASH',
      card_brand: null,
      card_last4: null,
      status: 'PENDING',
      paid_at: null,
      payer_name: 'Mihai Ionescu',
    }),
    adminPayment({ id: 'p3', amount_refunded: 20000, payer_name: 'Ioana Stan' }),
    adminPayment({ id: 'p4', status: 'FAILED', paid_at: null }),
    adminPayment({
      id: 'p5',
      source: 'SUBSCRIPTION_INVOICE',
      kind: 'CLUB',
      offer_title: 'Club',
      participant_name: null,
      gateway_ref: 'in_1',
      card_last4: null,
    }),
  ]
  expect(payments.map(statusLabel)).toEqual([
    'Plătită',
    'De confirmat',
    'Rambursată parțial',
    'Eșuată',
    'Plătită',
  ])
  expect(cardLabel(payments[0])).toBe('Visa •••• 4242')
  expect(cardLabel(payments[1])).toBe('Cash')
  expect(cardLabel(payments[4])).toBe('Card')
  expect(statusCounts(payments)).toEqual({ all: 5, paid: 2, cash: 1, refunded: 1, failed: 1 })
  const ids = (filters: Partial<typeof NO_PAYMENT_FILTERS>) =>
    filterPayments(payments, { ...NO_PAYMENT_FILTERS, ...filters }).map((p) => p.id)
  expect(ids({ status: 'refunded' })).toEqual(['p3'])
  expect(ids({ type: 'subscriptions' })).toEqual(['p5'])
  expect(ids({ type: 'enrollments', method: 'CASH' })).toEqual(['p2'])
  expect(ids({ query: 'ionescu' })).toEqual(['p2'])
  expect(ids({ query: 'in_1' })).toEqual(['p5'])
})

test('totalurile și zilele adună doar banii încasați', () => {
  const payments = [
    adminPayment(),
    adminPayment({ id: 'p2', method: 'CASH', status: 'PENDING', paid_at: null, amount: 120000 }),
    adminPayment({
      id: 'p3',
      amount: 40000,
      amount_refunded: 20000,
      paid_at: '2026-11-03T18:20:00Z',
      refunds: [
        {
          id: 'r1',
          amount: 20000,
          status: 'succeeded',
          reason: 'x',
          origin: 'ADMIN',
          admin_name: 'A',
          failure_reason: null,
          cancel_enrollment: false,
          created_at: '2026-11-04T09:58:00Z',
        },
      ],
    }),
    adminPayment({ id: 'p4', status: 'FAILED', paid_at: null, amount: 9999 }),
  ]
  expect(paymentTotals(payments)).toEqual({
    collected: 88000,
    collectedCount: 2,
    refunded: 20000,
    refundCount: 1,
    net: 68000,
    cashPending: 120000,
    cashPendingCount: 1,
  })
  const days = groupByDay(payments)
  expect(days.map((d) => [d.day, d.payments.length, d.total])).toEqual([
    ['2026-11-04', 3, 48000],
    ['2026-11-03', 1, 20000],
  ])
})

test('suma rambursabilă scade rambursările în curs și cere referință Stripe la card', () => {
  const pending = {
    id: 'r',
    amount: 10000,
    status: 'pending' as const,
    reason: 'x',
    origin: 'ADMIN' as const,
    admin_name: null,
    failure_reason: null,
    cancel_enrollment: false,
    created_at: '2026-11-04T09:00:00Z',
  }
  expect(refundableAmount(adminPayment())).toBe(48000)
  expect(refundableAmount(adminPayment({ refunds: [pending] }))).toBe(38000)
  expect(refundableAmount(adminPayment({ refunds: [{ ...pending, status: 'failed' }] }))).toBe(
    48000,
  )
  expect(refundableAmount(adminPayment({ gateway_ref: null }))).toBe(0)
  expect(refundableAmount(adminPayment({ method: 'CASH', gateway_ref: null }))).toBe(48000)
  expect(refundableAmount(adminPayment({ status: 'PENDING' }))).toBe(0)
  expect(refundableAmount(adminPayment({ status: 'REFUNDED', amount_refunded: 48000 }))).toBe(0)
})

test('suma scrisă în lei devine bani', () => {
  expect(parseRonInput('120')).toBe(12000)
  expect(parseRonInput('120,5')).toBe(12050)
  expect(parseRonInput(' 1 200.75 ')).toBe(120075)
  expect(parseRonInput('0')).toBeNull()
  expect(parseRonInput('12,345')).toBeNull()
  expect(parseRonInput('abc')).toBeNull()
})

test('exportul CSV se deschide corect în Excel românesc și nu execută formule', () => {
  const csv = paymentsCsv([
    adminPayment({ payer_name: '=HYPERLINK("x")', offer_title: 'Înot; copii' }),
  ])
  const [header, row] = csv.replace('﻿', '').trim().split('\r\n')
  expect(csv.startsWith('﻿')).toBe(true)
  expect(header.split(';')[0]).toBe('Data')
  expect(row).toContain('2026-11-04;10:42;Curs;"Înot; copii";Matei;')
  expect(row).toContain(`"'=HYPERLINK(""x"")"`)
  expect(row).toContain(';Visa •••• 4242;480,00;0,00;Plătită;Club Delfinii;cs_test_1')
})
