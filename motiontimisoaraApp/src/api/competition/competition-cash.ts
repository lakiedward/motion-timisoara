import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { invokeCheckoutFunction } from '@/api/checkout'

export type CompetitionCashPayment = {
  payment_id: string
  enrollment_id: string
  participant_name: string
  category_name: string
  amount: number
  currency: string
  status: string
}

type CashDatabase = Database & {
  public: Database['public'] & {
    Functions: Database['public']['Functions'] & {
      get_competition_cash_payments: {
        Args: { p_competition_id: string }
        Returns: CompetitionCashPayment[]
      }
    }
  }
}

const cashDb = supabase as SupabaseClient<CashDatabase>

export async function getCompetitionCashPayments(
  competitionId: string,
): Promise<CompetitionCashPayment[]> {
  const { data, error } = await cashDb.rpc('get_competition_cash_payments', {
    p_competition_id: competitionId,
  })
  if (error) throw error
  return data ?? []
}

export async function confirmCompetitionCashPayment(paymentId: string): Promise<void> {
  await invokeCheckoutFunction('mark-cash-paid', { paymentId })
}
