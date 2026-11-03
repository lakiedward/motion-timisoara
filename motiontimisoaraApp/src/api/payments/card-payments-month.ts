import { supabase } from '@/lib/supabase'

export const CARD_PAYMENTS_MONTH_QUERY_KEY = ['card-payments-month'] as const

export type CardPaymentsMonth = {
  monthStart: string
  collected: number
  stripeFee: number
  net: number
  paymentCount: number
  unsettledCount: number
}

export async function getCardPaymentsMonth(): Promise<CardPaymentsMonth> {
  const { data, error } = await supabase.rpc('get_card_payments_month')
  if (error) throw new Error('Nu am putut încărca plățile online.', { cause: error })
  const row = data?.[0]
  if (!row) throw new Error('Nu am putut încărca plățile online.')
  return {
    monthStart: row.month_start,
    collected: row.collected,
    stripeFee: row.stripe_fee,
    net: row.net,
    paymentCount: row.payment_count,
    unsettledCount: row.unsettled_count,
  }
}
