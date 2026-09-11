import { z } from 'zod'
import { baniToRon } from '@/lib/money'
import { intervaleSuprapuse } from '@/api/camps-admin'
import {
  offerAmountSchema,
  offerCurrencyShape,
  validateOfferCurrency,
  parseScaledDecimal,
} from '@/lib/pricing/offer-currency'

const lei = offerAmountSchema
const ani = z
  .string()
  .refine(
    (s) => s.trim() !== '' && Number.isInteger(Number(s)) && Number(s) >= 0 && Number(s) <= 25,
    'Între 0 și 25 de ani',
  )

export const schema = z
  .object({
    ...offerCurrencyShape,
    pricing_mode: z.enum(['single', 'by_age']),
    varste: z.array(
      z
        .object({
          age_from: ani,
          age_to: ani,
          amount_lei: lei,
        })
        .refine((c) => Number(c.age_from) <= Number(c.age_to), {
          message: 'Vârsta de început e după cea de sfârșit',
          path: ['age_to'],
        }),
    ),
    title: z.string().min(3, 'Minim 3 caractere'),
    slug: z
      .string()
      .min(3, 'Minim 3 caractere')
      .regex(/^[a-z0-9-]+$/, 'Doar litere mici, cifre și cratime'),
    period_start: z.string().min(1, 'Alege data de început'),
    period_end: z.string().min(1, 'Alege data de sfârșit'),
    location_id: z.string().optional(),
    location_text: z.string().optional(),
    capacity: z.string().optional(),
    price_lei: lei,
    allow_cash: z.boolean(),
    description: z.string().optional(),
    categorii: z.array(
      z.object({
        name: z.string().min(1, 'Numele lipsește'),
        amount_lei: lei,
        description: z.string().optional(),
      }),
    ),
  })
  .superRefine(validateOfferCurrency)
  .refine((v) => v.period_end >= v.period_start, {
    message: 'Sfârșitul nu poate fi înaintea începutului',
    path: ['period_end'],
  })
  .refine(
    (v) =>
      v.categorii.length === 0 ||
      parseScaledDecimal(v.price_lei, 2) ===
        v.categorii.reduce((t, c) => t + (parseScaledDecimal(c.amount_lei, 2) ?? 0), 0),
    { message: 'Suma categoriilor trebuie să dea exact prețul taberei', path: ['categorii'] },
  )
  .superRefine((v, ctx) => {
    if (v.pricing_mode !== 'by_age') return
    if (v.varste.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Prețul pe categorii are nevoie de cel puțin o categorie de vârstă',
        path: ['varste'],
      })
      return
    }
    const perechi = v.varste.map((c) => ({
      age_from: Number(c.age_from),
      age_to: Number(c.age_to),
    }))
    const suprapuse = intervaleSuprapuse(perechi)
    if (suprapuse) {
      const [a, b] = suprapuse
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Categoria ${perechi[a].age_from}–${perechi[a].age_to} ani se suprapune cu ${perechi[b].age_from}–${perechi[b].age_to} ani`,
        path: ['varste'],
      })
    }
  })

export type Values = z.infer<typeof schema>

export const GOL: Values = {
  currency: 'RON',
  eur_ron_rate: '',
  title: '',
  slug: '',
  period_start: '',
  period_end: '',
  location_id: '',
  location_text: '',
  capacity: '',
  price_lei: '',
  allow_cash: false,
  description: '',
  categorii: [],
  pricing_mode: 'single',
  varste: [],
}

export const num = (s: string | undefined) => (s && s.trim() ? Number(s) : null)

export const spreCamp = (c: { age_from: number; age_to: number; amount: number }) => ({
  age_from: String(c.age_from),
  age_to: String(c.age_to),
  amount_lei: String(baniToRon(c.amount)),
})
