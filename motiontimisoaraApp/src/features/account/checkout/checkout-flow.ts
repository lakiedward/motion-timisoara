import type { PaymentMethod } from '@/api/checkout'
import type { ChildValidation } from '@/api/checkout'

export function checkoutStepLabels(free: boolean, method: PaymentMethod, forCamp = false): string[] {
  const first = forCamp ? 'Participanți' : 'Copii'
  if (free) return [first, 'Detalii']
  if (method === 'CARD') return [first, 'Detalii', 'Facturare', 'Plată']
  return [first, 'Detalii', 'Plată']
}

export function checkoutParticipantCount(childIds: string[], includeSelf: boolean) {
  return childIds.length + (includeSelf ? 1 : 0)
}

export function checkoutIsFree(selectedCount: number, pricesReady: boolean, total: number) {
  return selectedCount > 0 && pricesReady && total === 0
}

export function enrollmentNeedsCardPayment(total: number, requiresPaymentIntent: boolean) {
  return total > 0 && requiresPaymentIntent
}

export function quoteIsPriced(
  verdict:
    | Pick<ChildValidation, 'eligible' | 'amount' | 'currency' | 'priceVersion'>
    | null
    | undefined,
) {
  return (
    verdict?.eligible === true &&
    Number.isSafeInteger(verdict.amount) &&
    verdict.amount! >= 0 &&
    verdict.currency === 'RON' &&
    Boolean(verdict.priceVersion)
  )
}
