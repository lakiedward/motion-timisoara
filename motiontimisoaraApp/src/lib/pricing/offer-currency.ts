import { z } from 'zod'

export function parseScaledDecimal(value: string, decimals: number): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const scaled = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'))
  return scaled <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(scaled) : null
}

export function millionthsToDecimal(millionths: number): string {
  const sign = millionths < 0 ? '-' : ''
  const abs = Math.abs(millionths)
  const whole = Math.trunc(abs / 1_000_000)
  const frac = String(abs % 1_000_000)
    .padStart(6, '0')
    .replace(/0+$/, '')
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`
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

export function eurFaraCurs(currency: string, rate: string | undefined) {
  return currency === 'EUR' && !(parseScaledDecimal(rate ?? '', 6)! > 0)
}

export function validateOfferCurrency(
  value: { currency: string; eur_ron_rate: string },
  ctx: z.RefinementCtx,
) {
  if (eurFaraCurs(value.currency, value.eur_ron_rate)) {
    ctx.addIssue({
      code: 'custom',
      path: ['eur_ron_rate'],
      message: 'Nu am putut citi cursul BNR. Reîncearcă.',
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
      value.eur_ron_rate_micros == null ? '' : millionthsToDecimal(value.eur_ron_rate_micros),
  }
}

export function formatExchangeRate(rateMicros: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 6 }).format(rateMicros / 1000000)
}
