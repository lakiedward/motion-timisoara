import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { invokeCheckoutFunction } from '@/api/checkout'

type CashPaymentRow = Database['public']['Functions']['get_cash_payments']['Returns'][number]

export const CASH_PAYMENTS_QUERY_KEY = ['cash-payments'] as const

export type CashOfferKind = 'COURSE' | 'ACTIVITY' | 'CAMP'

export type CashPayment = Omit<CashPaymentRow, 'kind' | 'sessions' | 'paid_at' | 'status'> & {
  kind: CashOfferKind
  sessions: number | null
  paid_at: string | null
  status: 'PENDING' | 'SUCCEEDED'
}

export async function getCashPayments(): Promise<CashPayment[]> {
  const { data, error } = await supabase.rpc('get_cash_payments')
  if (error) throw new Error('Nu am putut încărca plățile cash.', { cause: error })
  return (data ?? []) as CashPayment[]
}

export async function confirmCashPayment(paymentId: string): Promise<void> {
  await invokeCheckoutFunction('mark-cash-paid', { paymentId })
}
