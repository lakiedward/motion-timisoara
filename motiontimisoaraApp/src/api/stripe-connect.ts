import { supabase } from '@/lib/supabase'

export type StripeConnectStatus = {
  hasAccount: boolean
  onboardingComplete: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  requiresAction: boolean
  accountId?: string
}

async function invokeStripeConnect<T>(action: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('stripe-connect', { body: { action } })
  if (error) {
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
