/** All monetary amounts are stored in the DB as minor units (bani). */
export function baniToRon(bani: number): number {
  return Math.round(bani) / 100
}

export function ronToBani(ron: number): number {
  return Math.round(ron * 100)
}

const numberFormatter = new Intl.NumberFormat('ro-RO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Renders bani as Romanian currency, e.g. 12345 -> "123,45 lei". */
export function formatRon(bani: number): string {
  return `${numberFormatter.format(baniToRon(bani))} lei`
}
