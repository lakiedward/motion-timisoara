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

export async function createEnrollment(input: {
  kind: EnrollmentKind
  entityId: string
  childIds: string[]
  paymentMethod: PaymentMethod
  sessionPackageSize?: number
  billingDetails?: BillingDetails
}): Promise<CreateEnrollmentResponse> {
  const data = await invoke<CreateEnrollmentResponse>('create-enrollment', input)
  // Older deployments returned only enrollmentId; always settle every child.
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
  }
}

export function createPaymentIntent(
  enrollmentId: string
): Promise<{ clientSecret: string; alreadySucceeded?: boolean }> {
  return invoke<{ clientSecret: string; alreadySucceeded?: boolean }>('create-payment-intent', {
    enrollmentId,
  })
}

export function cancelDraftEnrollment(enrollmentIds: string[]): Promise<{ success: boolean }> {
  return invoke<{ success: boolean }>('cancel-draft-enrollment', { enrollmentIds })
}

export type EnrollmentReadyOutcome = 'ready' | 'failed' | 'partial' | 'timeout'

/**
 * Subscribes to the stripe-webhook broadcast that flips enrollments to ACTIVE.
 *
 * Call this *before* confirming card payments so events that land during
 * confirmCardPayment are not missed. Await `whenSubscribed`, run confirms,
 * then call `startWaiting()` and await `outcome`.
 *
 * Card confirmation succeeding client-side only means Stripe accepted the
 * charge — the enrollment is still PENDING until the webhook lands. We give it
 * `timeoutMs` (from startWaiting) and then fall through: the payment is real
 * either way, so a timeout is reported as "processing", never as a failure.
 */
export function listenForEnrollmentReady(
  userId: string,
  enrollmentIds: string[],
  timeoutMs = 15000
): {
  whenSubscribed: Promise<void>
  startWaiting: () => void
  dispose: () => void
  outcome: Promise<EnrollmentReadyOutcome>
} {
  let resolveSubscribed!: () => void
  const whenSubscribed = new Promise<void>((resolve) => {
    resolveSubscribed = resolve
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  let startWaiting!: () => void
  let dispose!: () => void

  const outcome = new Promise<EnrollmentReadyOutcome>((resolve) => {
    const pending = new Set(enrollmentIds)
    const failed = new Set<string>()
    const channel = supabase.channel(`user:${userId}:payments`)
    let settled = false

    const finish = (result: EnrollmentReadyOutcome) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
      resolve(result)
    }

    const settleWhenIdle = () => {
      if (pending.size > 0) return
      if (failed.size === 0) finish('ready')
      else if (failed.size === enrollmentIds.length) finish('failed')
      else finish('partial')
    }

    startWaiting = () => {
      if (settled || timer) return
      // Already received every event while confirms were in flight.
      if (pending.size === 0) {
        settleWhenIdle()
        return
      }
      timer = setTimeout(() => finish('timeout'), timeoutMs)
    }

    dispose = () => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
      resolve('timeout')
    }

    channel
      .on('broadcast', { event: 'enrollment_ready' }, ({ payload }) => {
        pending.delete((payload as { enrollmentId: string }).enrollmentId)
        settleWhenIdle()
      })
      .on('broadcast', { event: 'payment_failed' }, ({ payload }) => {
        const id = (payload as { enrollmentId: string }).enrollmentId
        if (!pending.has(id)) return
        pending.delete(id)
        failed.add(id)
        settleWhenIdle()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') resolveSubscribed()
      })
  })

  return { whenSubscribed, startWaiting, dispose, outcome }
}

/** @deprecated Prefer listenForEnrollmentReady so subscribe starts before confirms. */
export function waitForEnrollmentReady(
  userId: string,
  enrollmentIds: string[],
  timeoutMs = 15000
): Promise<EnrollmentReadyOutcome> {
  const listener = listenForEnrollmentReady(userId, enrollmentIds, timeoutMs)
  listener.startWaiting()
  return listener.outcome
}
