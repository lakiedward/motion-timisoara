import type { EnrollmentRow } from '@/api/account'
import { enrollmentPayable } from '@/api/payments/enrollments'

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

export function sessionsLine(e: {
  kind: string
  status: string
  purchased_sessions: number
  remaining_sessions: number
}) {
  if (e.kind !== 'COURSE') return null
  if (e.purchased_sessions > 0)
    return `Ședințe: ${e.remaining_sessions} rămase din ${e.purchased_sessions}`
  return e.status === 'PENDING' ? 'Începe după confirmarea plății' : null
}

export function needsPayment(e: EnrollmentRow) {
  return enrollmentPayable(e)
}

export function byAttention(rows: EnrollmentRow[]) {
  return [...rows].sort((a, b) => Number(needsPayment(b)) - Number(needsPayment(a)))
}
