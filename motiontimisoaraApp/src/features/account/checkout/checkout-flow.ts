import type { BillingDetails, ChildValidation, PaymentMethod } from '@/api/checkout'

export function checkoutStepLabels(
  free: boolean,
  method: PaymentMethod,
  forCamp = false,
): string[] {
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

export function advanceHint(step: string, participantCount: number, accepted: boolean) {
  if (step === 'Copii' || step === 'Participanți') {
    return participantCount === 0 ? 'Alege cel puțin un participant ca să continui.' : null
  }
  if (step === 'Detalii') return accepted ? null : 'Bifează confirmarea sumei ca să continui.'
  if (step === 'Facturare') return 'Completează toate datele de facturare ca să continui.'
  return null
}

export const STEP_COPY: Record<string, { title: string; text: string }> = {
  Copii: { title: 'Cine participă?', text: 'Alege copiii pe care îi înscrii.' },
  Participanți: { title: 'Cine participă?', text: 'Alege cine merge în tabără.' },
  Detalii: { title: 'Verifică suma', text: 'Confirmă prețul înainte de plată.' },
  Facturare: { title: 'Date de facturare', text: 'Le folosim pentru chitanța plății cu cardul.' },
  Plată: { title: 'Cum plătești?', text: 'Alege metoda de plată și finalizează înscrierea.' },
}

export function billingIsValid(billing: BillingDetails): boolean {
  return (
    billing.name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(billing.email) &&
    billing.addressLine1.trim().length > 2 &&
    billing.city.trim().length > 1 &&
    billing.postalCode.trim().length > 2
  )
}
