import type { EnrollmentRow, MonthlyPackage } from '@/api/account'
import {
  enrollmentPayable,
  expiredCardPayment,
  expiredMonthlyPayment,
} from '@/api/payments/enrollments'
import { dateLabel, monthName } from '@/lib/course-packages/package-month'
import { plural } from '@/lib/plural'

export const KIND_LABEL: Record<string, string> = {
  COURSE: 'Curs',
  CAMP: 'Tabără',
  ACTIVITY: 'Activitate',
  COMPETITION: 'Concurs',
}

export const STATUS: Record<
  string,
  { label: string; variant: 'success' | 'outline' | 'destructive' }
> = {
  ACTIVE: { label: 'Activ', variant: 'success' },
  PENDING: { label: 'În așteptare', variant: 'outline' },
  CANCELLED: { label: 'Anulat', variant: 'destructive' },
}

const PAY: Record<string, string> = {
  SUCCEEDED: 'Plătit',
  PENDING: 'Plată în așteptare',
  FAILED: 'Plată eșuată',
  REFUNDED: 'Returnat',
  PARTIAL: 'Plată parțială',
}

export function paymentLabel(status: string) {
  return PAY[status] ?? 'Stare plată necunoscută'
}

export function enrollmentTitle(e: EnrollmentRow) {
  return e.offerTitle?.trim() || KIND_LABEL[e.kind] || e.kind
}

export function participantName(e: EnrollmentRow) {
  return e.child?.name ?? (e.adult_profile_id ? 'Tu' : '')
}

type SessionsSource = {
  kind: string
  status: string
  purchased_sessions: number
  remaining_sessions: number
  monthly_packages?: MonthlyPackage[]
  payments?: EnrollmentRow['payments']
}

export function bucharestToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(now)
}

function packageName(item: MonthlyPackage): string {
  return item.validity === 'DAYS'
    ? `Pachet din ${dateLabel(item.valid_from)}`
    : `Pachet lunar ${monthName(item.valid_from.slice(0, 7))}`
}

function monthlyLine(item: MonthlyPackage, today: string): string {
  const name = packageName(item)
  if (item.valid_from > today)
    return `${name}: ${plural(item.sessions, 'ședință', 'ședințe')}, începe pe ${dateLabel(item.valid_from)}`
  return `${name}: ${item.sessions - item.sessions_used} rămase din ${item.sessions}, expiră pe ${dateLabel(item.valid_until)}`
}

export function sessionsLines(e: SessionsSource, today: string = bucharestToday()): string[] {
  if (e.kind !== 'COURSE') return []
  const monthly = [...(e.monthly_packages ?? [])].sort((a, b) =>
    a.valid_from.localeCompare(b.valid_from),
  )
  const running = monthly.filter((item) => item.valid_until >= today)
  const lines: string[] = []
  if (e.purchased_sessions > 0)
    lines.push(
      monthly.length
        ? `Ședințe fără expirare: ${e.remaining_sessions} rămase din ${e.purchased_sessions}`
        : `Ședințe: ${e.remaining_sessions} rămase din ${e.purchased_sessions}`,
    )
  lines.push(...running.map((item) => monthlyLine(item, today)))
  const expired = monthly.at(-1)
  if (!running.length && expired)
    lines.push(
      expired.validity === 'DAYS'
        ? `Pachetul din ${dateLabel(expired.valid_from)} a expirat pe ${dateLabel(expired.valid_until)}`
        : `Pachetul lunar din ${monthName(expired.valid_from.slice(0, 7))} a expirat pe ${dateLabel(expired.valid_until)}`,
    )
  if (
    !lines.length &&
    e.status === 'PENDING' &&
    !expiredMonthlyPayment(e.payments?.[0], today.slice(0, 7))
  )
    lines.push('Începe după confirmarea plății')
  return lines
}

export function sessionsLine(e: SessionsSource, today?: string): string | null {
  return sessionsLines(e, today)[0] ?? null
}

export function needsPayment(e: EnrollmentRow) {
  return enrollmentPayable(e)
}

export function byAttention(rows: EnrollmentRow[]) {
  return [...rows].sort((a, b) => Number(needsPayment(b)) - Number(needsPayment(a)))
}

export function canBuySessions(e: EnrollmentRow) {
  return (
    e.kind === 'COURSE' &&
    e.status === 'ACTIVE' &&
    Boolean(e.child) &&
    !e.payments.some(
      (payment) =>
        ['PENDING', 'FAILED'].includes(payment.status) &&
        payment.method !== 'CASH' &&
        !expiredCardPayment(payment),
    )
  )
}

export function buySessionsPath(e: EnrollmentRow) {
  const params = new URLSearchParams({ kind: 'COURSE', id: e.entity_id, renew: e.id })
  return `/account/checkout?${params.toString()}`
}
