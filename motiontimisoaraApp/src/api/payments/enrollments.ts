import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import type { BillingDetails } from '@/api/checkout'
import { bucharestMonth, MONTHLY } from '@/lib/course-packages/package-month'

export type EnrollmentPayment = Pick<
  Tables<'enrollments'>,
  | 'id'
  | 'status'
  | 'kind'
  | 'entity_id'
  | 'purchased_sessions'
  | 'remaining_sessions'
  | 'adult_profile_id'
> & {
  child: { id: string; name: string } | null
  payments: Pick<
    Tables<'payments'>,
    | 'id'
    | 'created_at'
    | 'amount'
    | 'currency'
    | 'status'
    | 'method'
    | 'pricing_snapshot'
    | 'billing_name'
    | 'billing_email'
    | 'billing_address_line1'
    | 'billing_city'
    | 'billing_postal_code'
  >[]
}

export class EnrollmentPaymentUnavailableError extends Error {}

export async function getEnrollmentPayments(ids: string[]): Promise<EnrollmentPayment[]> {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      'id,status,kind,entity_id,purchased_sessions,remaining_sessions,adult_profile_id,child:children(id,name),payments(id,created_at,amount,currency,status,method,pricing_snapshot,billing_name,billing_email,billing_address_line1,billing_city,billing_postal_code)',
    )
    .in('id', [...new Set(ids)])
  if (error) throw new Error('Nu am putut verifica plățile. Reîncearcă.', { cause: error })
  if (!data || data.length !== new Set(ids).size) {
    throw new EnrollmentPaymentUnavailableError('Înscrierea nu este disponibilă în acest cont.')
  }
  const rows = (data as EnrollmentPayment[]).map((row) => ({
    ...row,
    payments: currentFirst(row.payments),
  }))
  if (
    rows.some(
      (row) =>
        (!row.child && !row.adult_profile_id) ||
        row.payments.length === 0 ||
        openPayments(row.payments) > 1,
    )
  ) {
    throw new EnrollmentPaymentUnavailableError(
      'Plata are nevoie de verificare. Contactează clubul.',
    )
  }
  return ids.map((id) => rows.find((row) => row.id === id)!)
}

const OPEN = ['PENDING', 'FAILED']

function openPayments(payments: { status: string }[]) {
  return payments.filter((payment) => OPEN.includes(payment.status)).length
}

export function currentFirst<T extends { status: string; created_at?: string | null }>(
  payments: T[],
): T[] {
  const time = (payment: T) => Date.parse(payment.created_at ?? '') || 0
  return [...payments].sort(
    (a, b) =>
      Number(OPEN.includes(b.status)) - Number(OPEN.includes(a.status)) || time(b) - time(a),
  )
}

export function paymentBilling(row: EnrollmentPayment): BillingDetails {
  const payment = row.payments[0]
  return {
    name: payment.billing_name ?? '',
    email: payment.billing_email ?? '',
    addressLine1: payment.billing_address_line1 ?? '',
    city: payment.billing_city ?? '',
    postalCode: payment.billing_postal_code ?? '',
  }
}

export function enrollmentPaid(row: EnrollmentPayment) {
  return row.payments[0]?.status === 'SUCCEEDED'
}

export function expiredMonthlyPayment(
  payment: { status: string; pricing_snapshot?: unknown } | undefined,
  month = bucharestMonth(new Date()),
): boolean {
  if (!payment || !OPEN.includes(payment.status)) return false
  const snapshot = payment.pricing_snapshot
  if (!snapshot || typeof snapshot !== 'object') return false
  const { validity, validMonth } = snapshot as { validity?: string; validMonth?: string }
  return (
    validity === MONTHLY &&
    typeof validMonth === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(validMonth) &&
    validMonth < month
  )
}

export function expiredCardPayment(
  payment: { method: string; status: string; pricing_snapshot?: unknown } | undefined,
  now = new Date(),
): boolean {
  return payment?.method === 'CARD' && expiredMonthlyPayment(payment, bucharestMonth(now))
}

export function enrollmentPayable(row: {
  status: string
  kind?: string
  payments: { method: string; status: string; pricing_snapshot?: unknown }[]
}) {
  const renewal = row.status === 'ACTIVE' && row.kind === 'COURSE'
  return (
    (row.status === 'PENDING' || renewal) &&
    openPayments(row.payments) === 1 &&
    (renewal || row.payments.length === 1) &&
    row.payments[0].method === 'CARD' &&
    OPEN.includes(row.payments[0].status) &&
    !expiredCardPayment(row.payments[0])
  )
}
