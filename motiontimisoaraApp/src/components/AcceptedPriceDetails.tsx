import { formatMoney } from '@/lib/money'
import { formatExchangeRate } from '@/lib/pricing/offer-currency'

export function AcceptedPriceDetails({ snapshot }: { snapshot: unknown }) {
  if (!snapshot || typeof snapshot !== 'object') return null
  const price = snapshot as {
    sourceUnitAmount?: number
    sourceCurrency?: string
    quantity?: number
    eurRonRateMicros?: number
  }
  if (
    price.sourceCurrency !== 'EUR' ||
    !Number.isSafeInteger(price.sourceUnitAmount) ||
    !Number.isSafeInteger(price.quantity) ||
    !Number.isSafeInteger(price.eurRonRateMicros)
  )
    return null
  return (
    <p className="text-muted-foreground mt-1 text-sm">
      {formatMoney(price.sourceUnitAmount! * price.quantity!, 'EUR')}
      {price.quantity! > 1 &&
        ` (${price.quantity} × ${formatMoney(price.sourceUnitAmount!, 'EUR')})`}
      {' · '}1 EUR = {formatExchangeRate(price.eurRonRateMicros!)} lei
    </p>
  )
}
