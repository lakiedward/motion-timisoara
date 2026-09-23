import { supabase } from '@/lib/supabase'
import type { PriceSnapshot } from '../../../supabase/functions/_shared/price-snapshot'

export type EnrollmentKind = 'COURSE' | 'CAMP' | 'ACTIVITY'
export type PaymentMethod = 'CARD' | 'CASH'

export async function getCheckoutCamp(id: string | null, slug: string | null) {
  if (!id && !slug) return null
  const query = supabase.from('camps').select('*')
  const { data, error } = await (slug ? query.eq('slug', slug) : query.eq('id', id!)).maybeSingle()
  if (error) throw error
  return data
}

export interface BillingDetails {
  name: string
  email: string
  addressLine1: string
  city: string
  postalCode: string
}

export interface ChildValidation {
  childId: string
  name: string
  eligible: boolean
  severity?: 'error' | 'warning'
  reason?: string
  amount?: number
  currency?: string
  priceVersion?: string
  pricingSnapshot?: PriceSnapshot
}

export interface AdultValidation {
  adultProfileId: string
  name: string
  eligible: boolean
  severity?: 'error' | 'warning'
  reason?: string
  amount?: number
  currency?: string
  priceVersion?: string
  pricingSnapshot?: PriceSnapshot
}

export interface ValidationResponse {
  results: ChildValidation[]
  adult?: AdultValidation | null
  capacity: { available: number | null; requested: number; sufficient: boolean }
  allowCash: boolean
}

export interface CreateEnrollmentResponse {
  enrollmentId: string
  enrollmentIds: string[]
  requiresPaymentIntent: boolean
  prices?: { childId?: string; adultProfileId?: string; amount: number; currency: string }[]
}

interface FunctionErrorBody {
  error?: string
  code?: string
}

export class EnrollmentRequestError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'EnrollmentRequestError'
    this.code = code
  }
}

export async function invokeCheckoutFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const details = (data as FunctionErrorBody | null)?.error
      ? (data as FunctionErrorBody)
      : await readFunctionError(error)
    throw new EnrollmentRequestError(details?.error ?? error.message, details?.code)
  }
  if ((data as { error?: string } | null)?.error) {
    const details = data as FunctionErrorBody
    throw new EnrollmentRequestError(details.error!, details.code)
  }
  return data as T
}

async function readFunctionError(error: unknown): Promise<FunctionErrorBody | null> {
  const context = (error as { context?: Response }).context
  if (!context || typeof context.json !== 'function') return null
  try {
    const parsed = await context.json()
    return parsed?.error ? parsed : null
  } catch {
    return null
  }
}

export function validateEnrollment(
  kind: EnrollmentKind,
  entityId: string,
  childIds: string[],
  sessionPackageSize = 1,
): Promise<ValidationResponse> {
  return invokeCheckoutFunction<ValidationResponse>('validate-enrollment', {
    kind,
    entityId,
    childIds,
    sessionPackageSize,
  })
}

export async function createEnrollment(input: {
  kind: EnrollmentKind
  entityId: string
  childIds: string[]
  includeSelf?: boolean
  paymentMethod: PaymentMethod
  sessionPackageSize?: number
  priceVersions?: Record<string, string>
  billingDetails?: BillingDetails
}): Promise<CreateEnrollmentResponse> {
  const data = await invokeCheckoutFunction<CreateEnrollmentResponse>('create-enrollment', input)
  const enrollmentIds =
    data.enrollmentIds?.length > 0
      ? data.enrollmentIds
      : data.enrollmentId
        ? [data.enrollmentId]
        : []
  if (enrollmentIds.length === 0) {
    throw new Error('Nu s-au creat înscrieri. Încearcă din nou.')
  }
  return {
    enrollmentId: data.enrollmentId ?? enrollmentIds[0],
    enrollmentIds,
    requiresPaymentIntent: data.requiresPaymentIntent,
    prices: data.prices,
  }
}

export interface PaymentIntentResponse {
  clientSecret: string
  alreadySucceeded?: boolean
  alreadyProcessing?: boolean
  amount?: number
  currency?: string
  testMode?: boolean
}

export function createPaymentIntent(enrollmentId: string): Promise<PaymentIntentResponse> {
  return invokeCheckoutFunction<PaymentIntentResponse>('create-payment-intent', { enrollmentId })
}
