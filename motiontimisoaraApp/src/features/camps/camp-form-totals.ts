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
