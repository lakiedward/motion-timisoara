import type { AdminPayment, PaymentKind, PaymentRange } from '@/api/payments/admin-payments'
import { fold } from '@/features/admin/courses/course-overview'
import { baniToRon } from '@/lib/money'

const TZ = 'Europe/Bucharest'

export type PeriodPreset = 'today' | '7d' | 'month' | 'last-month' | 'custom'
export type PaymentStatusFilter = 'all' | 'paid' | 'cash' | 'refunded' | 'failed'
export type PaymentTypeFilter = '' | 'enrollments' | 'subscriptions'
export type PaymentMethodFilter = '' | 'CARD' | 'CASH'

export type PaymentFilters = {
  status: PaymentStatusFilter
  type: PaymentTypeFilter
  method: PaymentMethodFilter
  query: string
}

export const NO_PAYMENT_FILTERS: PaymentFilters = { status: 'all', type: '', method: '', query: '' }

export const KIND_LABEL: Record<PaymentKind, string> = {
  COURSE: 'Curs',
  ACTIVITY: 'Activitate',
  CAMP: 'Tabără',
  COMPETITION: 'Concurs',
  COACH: 'Abonament antrenor',
  CLUB: 'Abonament club',
}

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function zoned(date: Date) {
  const map = Object.fromEntries(parts.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    day: `${map.year}-${map.month}-${map.day}`,
    asUtc: Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second),
  }
}

export function bucharestDay(value: string | Date): string {
  return zoned(typeof value === 'string' ? new Date(value) : value).day
}

export function bucharestMidnight(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d)
  const offset = zoned(new Date(guess)).asUtc - guess
  let instant = guess - offset
  const corrected = zoned(new Date(instant)).asUtc - instant
  if (corrected !== offset) instant = guess - corrected
  return new Date(instant).toISOString()
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export type DayRange = { start: string; end: string }

export function presetDays(preset: Exclude<PeriodPreset, 'custom'>, now = new Date()): DayRange {
  const today = bucharestDay(now)
  if (preset === 'today') return { start: today, end: today }
  if (preset === '7d') return { start: addDays(today, -6), end: today }
  const first = `${today.slice(0, 7)}-01`
  if (preset === 'month') return { start: first, end: today }
  const lastMonthEnd = addDays(first, -1)
  return { start: `${lastMonthEnd.slice(0, 7)}-01`, end: lastMonthEnd }
}

export function rangeOf(days: DayRange): PaymentRange {
  return { from: bucharestMidnight(days.start), to: bucharestMidnight(addDays(days.end, 1)) }
}

export function validDays(days: DayRange): string | null {
  if (!days.start || !days.end) return 'Alege ambele date.'
  if (days.end < days.start) return 'Data de sfârșit este înaintea celei de început.'
  if (addDays(days.start, 366) < days.end) return 'Alege un interval de cel mult un an.'
  return null
}

export const paymentTime = (p: AdminPayment) => p.paid_at ?? p.created_at

export function statusOf(p: AdminPayment): 'paid' | 'cash' | 'pending' | 'refunded' | 'failed' {
  if (p.amount_refunded > 0 || p.status === 'REFUNDED') return 'refunded'
  if (p.status === 'FAILED') return 'failed'
  if (p.status === 'PENDING') return p.method === 'CASH' ? 'cash' : 'pending'
  return 'paid'
}

export const STATUS_LABEL: Record<ReturnType<typeof statusOf>, string> = {
  paid: 'Plătită',
  cash: 'De confirmat',
  pending: 'Neterminată',
  refunded: 'Rambursată',
  failed: 'Eșuată',
}

export function statusLabel(p: AdminPayment): string {
  const status = statusOf(p)
  if (status === 'refunded' && p.amount_refunded < p.amount) return 'Rambursată parțial'
  return STATUS_LABEL[status]
}

export function cardLabel(p: AdminPayment): string {
  if (p.method === 'CASH') return 'Cash'
  if (!p.card_last4) return 'Card'
  const brand = p.card_brand ? p.card_brand.charAt(0).toUpperCase() + p.card_brand.slice(1) : 'Card'
  return `${brand} •••• ${p.card_last4}`
}

export function describe(p: AdminPayment): string {
  return [KIND_LABEL[p.kind], p.offer_title].filter(Boolean).join(' · ')
}

function matches(p: AdminPayment, filters: PaymentFilters) {
  const status = statusOf(p)
  if (filters.status !== 'all' && filters.status !== status) return false
  if (filters.type === 'enrollments' && p.source !== 'PAYMENT') return false
  if (filters.type === 'subscriptions' && p.source !== 'SUBSCRIPTION_INVOICE') return false
  if (filters.method && p.method !== filters.method) return false
  const needle = fold(filters.query.trim())
  if (!needle) return true
  return fold(
    [p.payer_name, p.payer_email, p.participant_name, p.offer_title, p.gateway_ref, p.receiver_name]
      .filter(Boolean)
      .join(' '),
  ).includes(needle)
}

export function filterPayments(payments: AdminPayment[], filters: PaymentFilters) {
  return payments.filter((p) => matches(p, filters))
}

export function hasPaymentFilters(filters: PaymentFilters) {
  return filters.status !== 'all' || !!filters.type || !!filters.method || !!filters.query.trim()
}

export function statusCounts(payments: AdminPayment[]): Record<PaymentStatusFilter, number> {
  const counts: Record<PaymentStatusFilter, number> = {
    all: payments.length,
    paid: 0,
    cash: 0,
    refunded: 0,
    failed: 0,
  }
  for (const p of payments) {
    const status = statusOf(p)
    if (status !== 'pending') counts[status] += 1
  }
  return counts
}

export type PaymentTotals = {
  collected: number
  collectedCount: number
  refunded: number
  refundCount: number
  net: number
  cashPending: number
  cashPendingCount: number
}

export function paymentTotals(payments: AdminPayment[]): PaymentTotals {
  const totals: PaymentTotals = {
    collected: 0,
    collectedCount: 0,
    refunded: 0,
    refundCount: 0,
    net: 0,
    cashPending: 0,
    cashPendingCount: 0,
  }
  for (const p of payments) {
    if (p.status === 'SUCCEEDED' || p.status === 'REFUNDED' || p.status === 'PARTIAL') {
      totals.collected += p.amount
      totals.collectedCount += 1
    }
    if (p.status === 'PENDING' && p.method === 'CASH') {
      totals.cashPending += p.amount
      totals.cashPendingCount += 1
    }
    totals.refunded += p.amount_refunded
    totals.refundCount += p.refunds.filter((r) => r.status === 'succeeded').length
  }
  totals.net = totals.collected - totals.refunded
  return totals
}

export type PaymentDay = { day: string; payments: AdminPayment[]; total: number }

export function groupByDay(payments: AdminPayment[]): PaymentDay[] {
  const days = new Map<string, PaymentDay>()
  for (const p of payments) {
    const day = bucharestDay(paymentTime(p))
    const group = days.get(day) ?? { day, payments: [], total: 0 }
    group.payments.push(p)
    const status = statusOf(p)
    if (status === 'paid' || status === 'refunded') group.total += p.amount - p.amount_refunded
    days.set(day, group)
  }
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day))
}

export function refundableAmount(p: AdminPayment): number {
  if (p.status !== 'SUCCEEDED' && p.status !== 'REFUNDED') return 0
  if (p.method === 'CARD' && !p.gateway_ref) return 0
  const reserved = p.refunds
    .filter(
      (r) => r.status === 'pending' || r.status === 'succeeded' || r.status === 'requires_action',
    )
    .reduce((sum, r) => sum + r.amount, 0)
  return Math.max(0, p.amount - Math.max(reserved, p.amount_refunded))
}

export function parseRonInput(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const bani = Math.round(Number(normalized) * 100)
  return bani > 0 ? bani : null
}

const csvNumber = new Intl.NumberFormat('ro-RO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
})

const timeFormat = new Intl.DateTimeFormat('ro-RO', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})

const dayFormat = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function dayTitle(day: string) {
  const label = dayFormat.format(new Date(`${day}T12:00:00Z`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export const timeOf = (value: string) => timeFormat.format(new Date(value))

export function statusVariant(p: AdminPayment) {
  const status = statusOf(p)
  if (status === 'paid') return 'success' as const
  if (status === 'failed') return 'destructive' as const
  if (status === 'cash') return 'highlight' as const
  return 'outline' as const
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function paymentsCsv(payments: AdminPayment[]): string {
  const header = [
    'Data',
    'Ora',
    'Tip',
    'Ofertă sau plan',
    'Participant',
    'Plătitor',
    'Email',
    'Metodă',
    'Sumă (lei)',
    'Rambursat (lei)',
    'Stare',
    'Primește banii',
    'Referință',
  ]
  const rows = payments.map((p) => [
    bucharestDay(paymentTime(p)),
    timeOf(paymentTime(p)),
    KIND_LABEL[p.kind],
    p.offer_title,
    p.participant_name,
    p.payer_name,
    p.payer_email,
    cardLabel(p),
    csvNumber.format(baniToRon(p.amount)),
    csvNumber.format(baniToRon(p.amount_refunded)),
    statusLabel(p),
    p.receiver_name,
    p.gateway_ref,
  ])
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`
}
