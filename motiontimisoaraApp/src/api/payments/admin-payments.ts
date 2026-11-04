import { supabase } from '@/lib/supabase'
import { invokeCheckoutFunction } from '@/api/checkout'

export const ADMIN_PAYMENTS_QUERY_KEY = ['admin-payments'] as const

export type PaymentSource = 'PAYMENT' | 'SUBSCRIPTION_INVOICE'
export type PaymentKind = 'COURSE' | 'ACTIVITY' | 'CAMP' | 'COMPETITION' | 'COACH' | 'CLUB'
export type AdminPaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'PARTIAL'
export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled' | 'requires_action'

export type AdminRefund = {
  id: string
  amount: number
  status: RefundStatus
  reason: string
  origin: 'ADMIN' | 'STRIPE'
  admin_name: string | null
  failure_reason: string | null
  cancel_enrollment: boolean
  created_at: string
}

export type AdminPayment = {
  source: PaymentSource
  id: string
  kind: PaymentKind
  offer_title: string | null
  participant_name: string | null
  is_adult: boolean
  payer_name: string | null
  payer_email: string | null
  receiver_name: string
  method: 'CARD' | 'CASH'
  card_brand: string | null
  card_last4: string | null
  amount: number
  amount_refunded: number
  stripe_fee_amount: number | null
  currency: string
  status: AdminPaymentStatus
  gateway_ref: string | null
  created_at: string
  paid_at: string | null
  enrollment_status: string | null
  refunds: AdminRefund[]
  transferred: boolean
}

export type PaymentRange = { from: string; to: string }

export async function getAdminPayments(range: PaymentRange): Promise<AdminPayment[]> {
  const { data, error } = await supabase.rpc('get_admin_payments', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error('Nu am putut încărca plățile.', { cause: error })
  return (data ?? []).map((row) => ({
    ...row,
    refunds: Array.isArray(row.refunds) ? (row.refunds as AdminRefund[]) : [],
  })) as AdminPayment[]
}

export type RefundInput = {
  source: PaymentSource
  id: string
  amount: number
  reason: string
  cancelEnrollment: boolean
}

export type RefundResult = { refundId: string; status: RefundStatus; warning?: string }

export async function refundPayment(input: RefundInput): Promise<RefundResult> {
  return invokeCheckoutFunction<RefundResult>('admin-refund-payment', input)
}
