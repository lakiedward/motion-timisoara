import { baniToRon } from '@/lib/money'
import { offerCurrencyInput, parseScaledDecimal } from '@/lib/pricing/offer-currency'
import { CATEGORIE_GOALA, COMPONENTA_GOALA, spreCamp, type Values } from './camp-form-schema'

export function totalCategorieBani(componente: { amount_lei?: string }[] | undefined): number {
  return (componente ?? []).reduce(
    (t, c) => t + (parseScaledDecimal(c?.amount_lei ?? '', 2) ?? 0),
    0,
  )
}

export function preturiPeVarstaDinDraft(varste: Values['varste']) {
  return varste.map((c) => ({
    age_from: Number(c.age_from),
    age_to: Number(c.age_to),
    amount: totalCategorieBani(c.componente),
    components: c.componente.map((item) => ({
      name: item.name.trim(),
      amount: parseScaledDecimal(item.amount_lei, 2) ?? 0,
    })),
  }))
}

export function ofertaDinDraft(values: Values) {
  return {
    amount: 0,
    breakdown: [] as { name: string; amount: number; description: string | null }[],
    offer: offerCurrencyInput(values),
    mode: 'by_age' as const,
    agePrices: preturiPeVarstaDinDraft(values.varste),
    adultPrice: {
      amount: totalCategorieBani(values.adult.componente),
      components: values.adult.componente.map((item) => ({
        name: item.name.trim(),
        amount: parseScaledDecimal(item.amount_lei, 2) ?? 0,
      })),
    },
  }
}

export function varsteDinDateSalvate(input: {
  agePrices: { age_from: number; age_to: number; amount: number; components?: unknown }[]
  priceItems: { name: string; amount: number }[]
  campPrice: number
}): Values['varste'] {
  if (input.agePrices.length > 0) return input.agePrices.map(spreCamp)
  if (input.priceItems.length > 0) {
    return [
      {
        age_from: '',
        age_to: '',
        componente: input.priceItems.map((item) => ({
          name: item.name,
          amount_lei: String(baniToRon(item.amount)),
        })),
      },
    ]
  }
  return [
    {
      age_from: '',
      age_to: '',
      componente: [{ name: 'Participare', amount_lei: String(baniToRon(input.campPrice)) }],
    },
  ]
}

export function categorieNoua(): Values['varste'][number] {
  return { ...CATEGORIE_GOALA, componente: [{ ...COMPONENTA_GOALA }] }
}

export function componenteCompletate(componente: { amount_lei?: string }[] | undefined): boolean {
  const lista = componente ?? []
  return lista.length > 0 && lista.every((c) => parseScaledDecimal(c?.amount_lei ?? '', 2) !== null)
}

export function etichetaVarsta(age_from: string | undefined, age_to: string | undefined): string {
  const de = (age_from ?? '').trim()
  const pana = (age_to ?? '').trim()
  if (!de && !pana) return 'Vârstă necompletată'
  return `${de || '?'}–${pana || '?'} ani`
}

export function varsteNeacoperite(
  varste: { age_from?: string; age_to?: string }[] | undefined,
): number[] {
  const intervale = (varste ?? [])
    .map((c) => [Number((c.age_from ?? '').trim() || NaN), Number((c.age_to ?? '').trim() || NaN)])
    .filter(([de, pana]) => Number.isInteger(de) && Number.isInteger(pana) && de <= pana)
  if (intervale.length < 2) return []
  const min = Math.min(...intervale.map(([de]) => de))
  const max = Math.max(...intervale.map(([, pana]) => pana))
  const lipsa: number[] = []
  for (let v = min; v <= max; v++) {
    if (!intervale.some(([de, pana]) => v >= de && v <= pana)) lipsa.push(v)
  }
  return lipsa
}

export function mesajVarsteNeacoperite(lipsa: number[]): string | null {
  if (lipsa.length === 0) return null
  const lista =
    lipsa.length === 1
      ? `${lipsa[0]} ani`
      : `${lipsa.slice(0, -1).join(', ')} și ${lipsa[lipsa.length - 1]} ani`
  const verb = lipsa.length === 1 ? 'Vârsta de' : 'Vârstele de'
  const nu = lipsa.length === 1 ? 'nu are preț' : 'nu au preț'
  return `${verb} ${lista} ${nu}: copiii de ${lista} nu se pot înscrie.`
}
