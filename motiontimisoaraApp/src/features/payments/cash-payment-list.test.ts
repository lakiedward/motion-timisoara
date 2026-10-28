import { expect, test } from 'vitest'

import type { CashPayment } from '@/api/payments/cash-payments'
import {
  NO_CASH_FILTERS,
  cashKindOptions,
  cashStatusCounts,
  filterCashPayments,
  groupCashPayments,
  hasCashFilters,
} from './cash-payment-list'

function payment(over: Partial<CashPayment>): CashPayment {
  return {
    payment_id: 'p',
    enrollment_id: 'e',
    kind: 'COURSE',
    entity_id: 'c1',
    offer_title: 'Înot',
    participant_name: 'Ana',
    is_adult: false,
    sessions: 8,
    amount: 40000,
    currency: 'RON',
    status: 'PENDING',
    created_at: '2026-10-28T10:00:00Z',
    paid_at: null,
    ...over,
  }
}

const payments = [
  payment({ payment_id: 'p1' }),
  payment({ payment_id: 'p2', participant_name: 'Ștefan', status: 'SUCCEEDED' }),
  payment({ payment_id: 'p3', kind: 'CAMP', entity_id: 't1', offer_title: 'Tabăra de vară' }),
  payment({
    payment_id: 'p4',
    kind: 'ACTIVITY',
    entity_id: 'a1',
    offer_title: 'Alergare',
    status: 'SUCCEEDED',
  }),
]

const ids = (list: CashPayment[]) => list.map((p) => p.payment_id)

test('default filter shows only payments waiting for confirmation', () => {
  expect(ids(filterCashPayments(payments, NO_CASH_FILTERS))).toEqual(['p1', 'p3'])
  expect(ids(filterCashPayments(payments, { ...NO_CASH_FILTERS, status: 'confirmed' }))).toEqual([
    'p2',
    'p4',
  ])
  expect(cashStatusCounts(payments)).toEqual({ attention: 2, confirmed: 2, all: 4 })
})

test('search folds diacritics over participant and offer, kind narrows the list', () => {
  const all = { ...NO_CASH_FILTERS, status: 'all' as const }
  expect(ids(filterCashPayments(payments, { ...all, query: 'stefan' }))).toEqual(['p2'])
  expect(ids(filterCashPayments(payments, { ...all, query: 'TABARA' }))).toEqual(['p3'])
  expect(ids(filterCashPayments(payments, { ...all, kind: 'ACTIVITY' }))).toEqual(['p4'])
  expect(hasCashFilters(NO_CASH_FILTERS)).toBe(false)
  expect(hasCashFilters({ ...NO_CASH_FILTERS, query: ' ana ' })).toBe(true)
})

test('kind options count only the selected status and hide empty kinds', () => {
  expect(cashKindOptions(payments, 'attention')).toEqual([
    { id: 'COURSE', name: 'Cursuri', count: 1 },
    { id: 'CAMP', name: 'Tabere', count: 1 },
  ])
})

test('groups by offer, with offers that still wait for money first', () => {
  const groups = groupCashPayments(payments)
  expect(groups.map((g) => [g.title, g.payments.length, g.pending])).toEqual([
    ['Înot', 2, 1],
    ['Tabăra de vară', 1, 1],
    ['Alergare', 1, 0],
  ])
})
