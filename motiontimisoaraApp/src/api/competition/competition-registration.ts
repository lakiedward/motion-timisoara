import {
  invokeCheckoutFunction,
  type BillingDetails,
  type CreateEnrollmentResponse,
  type PaymentMethod,
} from '@/api/checkout'
import type { PriceSnapshot } from '../../../../supabase/functions/_shared/price-snapshot'

export type CompetitionSelection = { childId: string; categoryId: string }

export type CompetitionRegistrationVerdict = {
  childId: string
  categoryId: string
  routeId: string
  name: string
  eligible: boolean
  reason?: string
  amount?: number
  currency?: 'RON'
  priceVersion?: string
  pricingSnapshot?: PriceSnapshot
}

export type CompetitionRegistrationValidation = {
  results: CompetitionRegistrationVerdict[]
  allowCash: boolean
}

export function validateCompetitionRegistration(
  competitionId: string,
  selections: CompetitionSelection[],
): Promise<CompetitionRegistrationValidation> {
  return invokeCheckoutFunction('validate-competition-registration', { competitionId, selections })
}

export function createCompetitionRegistration(input: {
  competitionId: string
  selections: CompetitionSelection[]
  paymentMethod: PaymentMethod
  priceVersions: Record<string, string>
  billingDetails?: BillingDetails
}): Promise<CreateEnrollmentResponse> {
  return invokeCheckoutFunction('create-competition-registration', input)
}
