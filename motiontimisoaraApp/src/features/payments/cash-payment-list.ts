import type { CashOfferKind, CashPayment } from '@/api/payments/cash-payments'
import { fold } from '@/features/admin/courses/course-overview'

export type CashStatusFilter = 'attention' | 'confirmed' | 'all'

export type CashFilters = { status: CashStatusFilter; kind: CashOfferKind | ''; query: string }

export const NO_CASH_FILTERS: CashFilters = { status: 'attention', kind: '', query: '' }

const KIND_PLURAL: Record<CashOfferKind, string> = {
  COURSE: 'Cursuri',
  ACTIVITY: 'Activități',
  CAMP: 'Tabere',
}

const KINDS: CashOfferKind[] = ['COURSE', 'ACTIVITY', 'CAMP']

export type CashGroup = {
  key: string
  kind: CashOfferKind
  title: string
  payments: CashPayment[]
  pending: number
}

const isPending = (payment: CashPayment) => payment.status === 'PENDING'

function matchesStatus(payment: CashPayment, status: CashStatusFilter) {
  if (status === 'all') return true
  return status === 'attention' ? isPending(payment) : !isPending(payment)
}

function matchesQuery(payment: CashPayment, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(`${payment.participant_name} ${payment.offer_title}`).includes(needle)
}

export function filterCashPayments(payments: CashPayment[], filters: CashFilters) {
  return payments.filter(
    (p) =>
      matchesStatus(p, filters.status) &&
      (!filters.kind || p.kind === filters.kind) &&
      matchesQuery(p, filters.query),
  )
}

export function cashStatusCounts(payments: CashPayment[]): Record<CashStatusFilter, number> {
  const pending = payments.filter(isPending).length
  return { attention: pending, confirmed: payments.length - pending, all: payments.length }
}

export function cashKindOptions(payments: CashPayment[], status: CashStatusFilter) {
  const inStatus = payments.filter((p) => matchesStatus(p, status))
  return KINDS.map((kind) => ({
    id: kind,
    name: KIND_PLURAL[kind],
    count: inStatus.filter((p) => p.kind === kind).length,
  })).filter((option) => option.count > 0)
}

export function groupCashPayments(payments: CashPayment[]): CashGroup[] {
  const groups = new Map<string, CashGroup>()
  for (const payment of payments) {
    const key = `${payment.kind}:${payment.entity_id}`
    const group = groups.get(key) ?? {
      key,
      kind: payment.kind,
      title: payment.offer_title,
      payments: [],
      pending: 0,
    }
    group.payments.push(payment)
    if (isPending(payment)) group.pending += 1
    groups.set(key, group)
  }
  return [...groups.values()].sort(
    (a, b) => Number(b.pending > 0) - Number(a.pending > 0) || a.title.localeCompare(b.title, 'ro'),
  )
}

export function hasCashFilters(filters: CashFilters) {
  return !!filters.kind || !!filters.query.trim()
}
