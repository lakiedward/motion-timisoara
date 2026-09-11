import { z } from 'zod'

export function parseScaledDecimal(value: string, decimals: number): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const scaled = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'))
  return scaled <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(scaled) : null
}

export const offerAmountSchema = z
  .string()
  .refine(
    (value) => parseScaledDecimal(value, 2) !== null,
    'Introdu o sumă pozitivă sau zero, cu cel mult două zecimale',
  )

export const offerCurrencyShape = {
  currency: z.enum(['RON', 'EUR']),
  eur_ron_rate: z.string(),
}

export function validateOfferCurrency(
  value: { currency: string; eur_ron_rate: string },
  ctx: z.RefinementCtx,
) {
  if (value.currency === 'EUR' && !(parseScaledDecimal(value.eur_ron_rate, 6)! > 0)) {
    ctx.addIssue({
      code: 'custom',
      path: ['eur_ron_rate'],
      message: 'Introdu un curs pozitiv, cu cel mult șase zecimale',
    })
  }
}

export function offerCurrencyInput(value: { currency: 'RON' | 'EUR'; eur_ron_rate: string }) {
  return {
    currency: value.currency,
    eur_ron_rate_micros:
      value.currency === 'EUR' ? parseScaledDecimal(value.eur_ron_rate, 6) : null,
  }
}

export function offerCurrencyValues(value: {
  currency: string
  eur_ron_rate_micros?: number | null
}) {
  return {
    currency: value.currency === 'EUR' ? ('EUR' as const) : ('RON' as const),
    eur_ron_rate:
      value.eur_ron_rate_micros == null ? '' : String(value.eur_ron_rate_micros / 1000000),
  }
}

export function formatExchangeRate(rateMicros: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 6 }).format(rateMicros / 1000000)
}
