import type { PaymentMethod } from '@/api/checkout'

export function checkoutStepLabels(free: boolean, method: PaymentMethod): string[] {
  if (free) return ['Copii', 'Detalii']
  if (method === 'CARD') return ['Copii', 'Detalii', 'Facturare', 'Plată']
  return ['Copii', 'Detalii', 'Plată']
}

export function checkoutIsFree(selectedCount: number, pricesReady: boolean, total: number) {
  return selectedCount > 0 && pricesReady && total === 0
}

export function enrollmentNeedsCardPayment(total: number, requiresPaymentIntent: boolean) {
  return total > 0 && requiresPaymentIntent
}
