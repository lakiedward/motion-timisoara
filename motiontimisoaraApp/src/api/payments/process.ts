import { createPaymentIntent, type BillingDetails } from '@/api/checkout'
import {
  enrollmentPaid,
  enrollmentPayable,
  getEnrollmentPayments,
  paymentBilling,
  type EnrollmentPayment,
} from './enrollments'

export interface PaymentAdapter {
  testOnly?: boolean
  confirm: (input: {
    clientSecret: string
    billing: BillingDetails
  }) => Promise<'completed' | 'canceled'>
}

export interface PaymentProgress {
  index: number
  total: number
  child: string
  confirming: boolean
}

export interface PaymentResult {
  outcome: 'ready' | 'pending' | 'canceled' | 'failed' | 'partial'
  completed: number
  total: number
  message?: string
}

interface PaymentDependencies {
  read: typeof getEnrollmentPayments
  intent: typeof createPaymentIntent
  pause: () => Promise<void>
}

const dependencies: PaymentDependencies = {
  read: getEnrollmentPayments,
  intent: createPaymentIntent,
  pause: () => new Promise((resolve) => setTimeout(resolve, 1000)),
}

export async function processEnrollmentPayments(
  ids: string[],
  adapter: PaymentAdapter,
  onProgress: (value: PaymentProgress) => void,
  signal?: AbortSignal,
  services: PaymentDependencies = dependencies,
): Promise<PaymentResult> {
  const selected = [...new Set(ids)]
  if (!selected.length) throw new Error('Nu există înscrieri de plătit.')
  let rows = await services.read(selected)
  let stopped: 'canceled' | 'failed' | null = null
  let message: string | undefined
  for (const [index, id] of selected.entries()) {
    if (signal?.aborted) break
    const row = rows.find((item) => item.id === id)!
    if (enrollmentPaid(row)) continue
    if (!enrollmentPayable(row)) {
      stopped = 'failed'
      message = 'Această înscriere nu mai poate fi plătită. Verifică starea în Înscrieri.'
      break
    }
    onProgress({
      index: index + 1,
      total: selected.length,
      child: row.child!.name,
      confirming: false,
    })
    try {
      const intent = await services.intent(id)
      if (signal?.aborted) break
      if (intent.alreadySucceeded || intent.alreadyProcessing) continue
      if (adapter.testOnly && intent.testMode !== true) {
        throw new Error('Plata Android este disponibilă momentan numai în mediul de test.')
      }
      const result = await adapter.confirm({
        clientSecret: intent.clientSecret,
        billing: paymentBilling(row),
      })
      if (result === 'canceled') {
        stopped = 'canceled'
        break
      }
    } catch (error) {
      stopped = 'failed'
      message = error instanceof Error ? error.message : 'Plata nu a putut fi finalizată.'
      break
    }
  }
  onProgress({ index: selected.length, total: selected.length, child: '', confirming: true })
  try {
    for (let attempt = 0; attempt < (stopped || signal?.aborted ? 1 : 12); attempt++) {
      rows = await services.read(selected)
      if (rows.every(enrollmentPaid)) break
      if (attempt < 11 && !stopped && !signal?.aborted) await services.pause()
    }
  } catch {
    return {
      outcome: 'pending',
      completed: rows.filter(enrollmentPaid).length,
      total: selected.length,
      message: 'Nu am putut verifica confirmarea. Verifică starea înainte de a relua plata.',
    }
  }
  return resultFor(rows, stopped, message)
}

function resultFor(
  rows: EnrollmentPayment[],
  stopped: 'canceled' | 'failed' | null,
  message?: string,
): PaymentResult {
  const completed = rows.filter(enrollmentPaid).length
  return {
    outcome:
      completed === rows.length ? 'ready' : completed > 0 ? 'partial' : (stopped ?? 'pending'),
    completed,
    total: rows.length,
    message,
  }
}

export function paymentResultMessage(result: PaymentResult): string {
  if (result.outcome === 'ready') return 'Plată confirmată. Înscrierea este activă.'
  if (result.outcome === 'partial') {
    return `Plata este confirmată pentru ${result.completed} din ${result.total} copii. Poți relua separat plățile rămase din Înscrieri.`
  }
  if (result.outcome === 'canceled') {
    return 'Ai închis plata. Înscrierea și suma sunt salvate; poți relua plata din Înscrieri.'
  }
  return (
    result.message ??
    (result.outcome === 'failed'
      ? 'Plata nu a reușit. O poți relua din Înscrieri, cu aceeași sumă.'
      : 'Confirmarea plății este în curs. Verifică starea în Înscrieri.')
  )
}
