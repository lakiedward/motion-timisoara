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

export function formatRon(bani: number): string {
  return `${numberFormatter.format(baniToRon(bani))} lei`
}

export function formatMoney(amount: number, currency: string): string {
  return `${numberFormatter.format(baniToRon(amount))} ${currency === 'RON' ? 'lei' : currency}`
}
