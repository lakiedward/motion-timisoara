import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import type { BillingDetails } from '@/api/checkout'

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

export async function getEnrollmentPayments(ids: string[]): Promise<EnrollmentPayment[]> {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      'id,status,kind,entity_id,purchased_sessions,remaining_sessions,adult_profile_id,child:children(id,name),payments(id,amount,currency,status,method,pricing_snapshot,billing_name,billing_email,billing_address_line1,billing_city,billing_postal_code)',
    )
    .in('id', [...new Set(ids)])
  if (error) throw new Error('Nu am putut verifica plățile. Reîncearcă.', { cause: error })
  if (!data || data.length !== new Set(ids).size) {
    throw new Error('Înscrierea nu este disponibilă în acest cont.')
  }
  const rows = data as EnrollmentPayment[]
  if (rows.some((row) => (!row.child && !row.adult_profile_id) || row.payments.length !== 1)) {
    throw new Error('Plata are nevoie de verificare. Contactează clubul.')
  }
  return ids.map((id) => rows.find((row) => row.id === id)!)
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

export function enrollmentPayable(row: {
  status: string
  payments: { method: string; status: string }[]
}) {
  return (
    row.status === 'PENDING' &&
    row.payments.length === 1 &&
    row.payments[0].method === 'CARD' &&
    ['PENDING', 'FAILED'].includes(row.payments[0].status)
  )
}
