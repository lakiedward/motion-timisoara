import { supabase } from '@/lib/supabase'

export type BillingErrorDetails = {
  coachCount?: number
  coachLimit?: number
  coachesToRemove?: number
}

export class SubscriptionBillingError extends Error {
  readonly code: string | null
  readonly details: BillingErrorDetails

  constructor(message: string, code: string | null, details: BillingErrorDetails = {}) {
    super(message)
    this.name = 'SubscriptionBillingError'
    this.code = code
    this.details = details
  }
}

type FunctionBody = ({ error?: string; code?: string } & BillingErrorDetails) | null

const FALLBACK = 'Nu am putut deschide plata. Încearcă din nou.'
const UNREACHABLE = 'Serviciul de plăți nu răspunde deocamdată. Încearcă din nou.'

async function responseBody(
  error: unknown,
): Promise<{ status: number | null; body: FunctionBody }> {
  const context = (error as { context?: Response }).context
  if (!context || typeof context.json !== 'function') return { status: null, body: null }
  try {
    return { status: context.status ?? null, body: (await context.json()) as FunctionBody }
  } catch {
    return { status: context.status ?? null, body: null }
  }
}

function numberDetails(body: FunctionBody): BillingErrorDetails {
  const details: BillingErrorDetails = {}
  for (const key of ['coachCount', 'coachLimit', 'coachesToRemove'] as const) {
    const value = body?.[key]
    if (typeof value === 'number') details[key] = value
  }
  return details
}

async function invokeBilling<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return data as T
  const payload = data as FunctionBody
  const { status, body: raw } = await responseBody(error)
  const source = payload?.code || payload?.error ? payload : raw
  if (source?.error) {
    throw new SubscriptionBillingError(source.error, source.code ?? null, numberDetails(source))
  }
  throw new SubscriptionBillingError(
    status === null || status === 404 ? UNREACHABLE : FALLBACK,
    null,
  )
}

function requireUrl(value: { url?: unknown } | null): string {
  if (typeof value?.url !== 'string' || !value.url.startsWith('https://')) {
    throw new SubscriptionBillingError(FALLBACK, null)
  }
  return value.url
}

export async function startSubscriptionCheckout(planCode: string): Promise<string> {
  return requireUrl(await invokeBilling('create-subscription-checkout', { planCode }))
}

export async function openBillingPortal(): Promise<string> {
  return requireUrl(await invokeBilling('billing-portal', {}))
}

export type PlanChangeResult = {
  result: 'upgraded' | 'scheduled' | 'kept'
  planCode: string
  effectiveAt: string | null
}

export async function changeSubscriptionPlan(planCode: string): Promise<PlanChangeResult> {
  const data = await invokeBilling<Partial<PlanChangeResult> | null>('change-subscription-plan', {
    planCode,
  })
  if (
    !data ||
    (data.result !== 'upgraded' && data.result !== 'scheduled' && data.result !== 'kept') ||
    typeof data.planCode !== 'string'
  ) {
    throw new SubscriptionBillingError('Nu am putut schimba pachetul. Încearcă din nou.', null)
  }
  return {
    result: data.result,
    planCode: data.planCode,
    effectiveAt: typeof data.effectiveAt === 'string' ? data.effectiveAt : null,
  }
}
