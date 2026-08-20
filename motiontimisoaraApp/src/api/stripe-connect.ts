import { supabase } from '@/lib/supabase'

export type StripeConnectStatus = {
  hasAccount: boolean
  onboardingComplete: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  requiresAction: boolean
  accountId?: string
}

/** Marker returned by the stripe-connect Edge Function when STRIPE_SECRET_KEY is
 *  missing. Keep in sync with supabase/functions/stripe-connect/index.ts. */
const STRIPE_NOT_CONFIGURED = 'stripe_not_configured'

/**
 * Card payments cannot be set up right now, and it is not the user's fault.
 * Either the platform has no Stripe keys yet, or the Edge Function is not
 * reachable. Screens render a setup-pending state for this instead of an error,
 * so an unfinished platform integration never looks like a broken page.
 */
export class StripeUnavailableError extends Error {
  readonly reason: 'not_configured' | 'unreachable'

  constructor(reason: 'not_configured' | 'unreachable', message: string) {
    super(message)
    this.name = 'StripeUnavailableError'
    this.reason = reason
  }
}

export function isStripeUnavailable(err: unknown): err is StripeUnavailableError {
  return err instanceof StripeUnavailableError
}

type FunctionErrorBody = { error?: string; code?: string } | null

async function readFunctionError(
  error: unknown,
): Promise<{ hasResponse: boolean; status: number | null; body: FunctionErrorBody }> {
  const context = (error as { context?: Response }).context
  if (!context || typeof context.json !== 'function') {
    return { hasResponse: false, status: null, body: null }
  }
  try {
    return {
      hasResponse: true,
      status: context.status ?? null,
      body: (await context.json()) as FunctionErrorBody,
    }
  } catch {
    return { hasResponse: true, status: context.status ?? null, body: null }
  }
}

const NOT_CONFIGURED_MESSAGE = 'Plățile cu cardul nu sunt încă activate pe platformă.'

async function invokeStripeConnect<T>(action: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('stripe-connect', { body: { action } })
  const payload = data as FunctionErrorBody

  if (error) {
    const { hasResponse, status, body } = await readFunctionError(error)
    const code = payload?.code ?? body?.code
    // supabase-js puts the parsed body in `data` for some failures and only in
    // the raw Response for others, so both are consulted before deciding.
    const message = payload?.error ?? body?.error ?? null

    if (code === STRIPE_NOT_CONFIGURED) {
      throw new StripeUnavailableError('not_configured', message ?? NOT_CONFIGURED_MESSAGE)
    }

    // The function answered with something specific — surface it as-is.
    if (message) throw new Error(message)

    // Nothing came back: no HTTP response at all (network/CORS), or the
    // function is not deployed on this project.
    if (!hasResponse || status === 404) {
      throw new StripeUnavailableError('unreachable', 'Serviciul de plăți nu răspunde deocamdată.')
    }

    throw new Error(error.message)
  }

  if (payload?.code === STRIPE_NOT_CONFIGURED) {
    throw new StripeUnavailableError('not_configured', payload.error ?? NOT_CONFIGURED_MESSAGE)
  }
  if (payload?.error) throw new Error(payload.error)

  return data as T
}

export function refreshStripeStatus(): Promise<StripeConnectStatus> {
  return invokeStripeConnect<StripeConnectStatus>('refresh-status')
}

export function getStripeDashboardLink(): Promise<{ url: string }> {
  return invokeStripeConnect<{ url: string }>('dashboard-link')
}

/** Creates the Connect account if needed, then returns the hosted onboarding URL. */
export async function startStripeOnboarding(): Promise<string> {
  await invokeStripeConnect<{ accountId?: string }>('create-account')
  const { url } = await invokeStripeConnect<{ url: string }>('onboarding-link')
  if (!url) throw new Error('Nu am putut deschide configurarea Stripe.')
  return url
}
