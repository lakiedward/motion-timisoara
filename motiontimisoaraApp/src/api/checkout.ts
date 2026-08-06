import { supabase } from '@/lib/supabase'

export type EnrollmentKind = 'COURSE' | 'CAMP' | 'ACTIVITY'
export type PaymentMethod = 'CARD' | 'CASH'

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
}

export interface ValidationResponse {
  results: ChildValidation[]
  capacity: { available: number | null; requested: number; sufficient: boolean }
  allowCash: boolean
}

export interface CreateEnrollmentResponse {
  enrollmentId: string
  enrollmentIds: string[]
  requiresPaymentIntent: boolean
}

/** Unwraps a functions.invoke result, surfacing the Edge Function's own error text. */
async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // Edge Functions return { error } with a meaningful message; prefer it.
    const message =
      (data as { error?: string } | null)?.error ??
      (await readFunctionError(error)) ??
      error.message
    throw new Error(message)
  }
  if ((data as { error?: string } | null)?.error) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

async function readFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: Response }).context
  if (!context || typeof context.json !== 'function') return null
  try {
    const parsed = await context.json()
    return parsed?.error ?? null
  } catch {
    return null
  }
}

export function validateEnrollment(
  kind: EnrollmentKind,
  entityId: string,
  childIds: string[]
): Promise<ValidationResponse> {
  return invoke<ValidationResponse>('validate-enrollment', { kind, entityId, childIds })
}

export function createEnrollment(input: {
  kind: EnrollmentKind
  entityId: string
  childIds: string[]
  paymentMethod: PaymentMethod
  sessionPackageSize?: number
  billingDetails?: BillingDetails
}): Promise<CreateEnrollmentResponse> {
  return invoke<CreateEnrollmentResponse>('create-enrollment', input)
}

export function createPaymentIntent(enrollmentId: string): Promise<{ clientSecret: string }> {
  return invoke<{ clientSecret: string }>('create-payment-intent', { enrollmentId })
}

export function cancelDraftEnrollment(enrollmentIds: string[]): Promise<{ success: boolean }> {
  return invoke<{ success: boolean }>('cancel-draft-enrollment', { enrollmentIds })
}

/**
 * Waits for the stripe-webhook broadcast that flips the enrollment to ACTIVE.
 *
 * Card confirmation succeeding client-side only means Stripe accepted the
 * charge — the enrollment is still PENDING until the webhook lands. We give it
 * `timeoutMs` and then fall through: the payment is real either way, so a
 * timeout is reported as "processing", never as a failure.
 */
export function waitForEnrollmentReady(
  userId: string,
  enrollmentIds: string[],
  timeoutMs = 15000
): Promise<'ready' | 'failed' | 'timeout'> {
  return new Promise((resolve) => {
    const pending = new Set(enrollmentIds)
    const channel = supabase.channel(`user:${userId}:payments`)
    let settled = false

    const finish = (outcome: 'ready' | 'failed' | 'timeout') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      supabase.removeChannel(channel)
      resolve(outcome)
    }

    const timer = setTimeout(() => finish('timeout'), timeoutMs)

    channel
      .on('broadcast', { event: 'enrollment_ready' }, ({ payload }) => {
        pending.delete((payload as { enrollmentId: string }).enrollmentId)
        if (pending.size === 0) finish('ready')
      })
      .on('broadcast', { event: 'payment_failed' }, ({ payload }) => {
        if (pending.has((payload as { enrollmentId: string }).enrollmentId)) finish('failed')
      })
      .subscribe()
  })
}
