import { z } from 'zod'
import { baniToRon } from '@/lib/money'
import { intervaleSuprapuse } from '@/api/camps-admin'
import {
  offerAmountSchema,
  offerCurrencyShape,
  validateOfferCurrency,
} from '@/lib/pricing/offer-currency'

const lei = offerAmountSchema
const ani = z
  .string()
  .refine(
    (s) => s.trim() !== '' && Number.isInteger(Number(s)) && Number(s) >= 0 && Number(s) <= 25,
    'Între 0 și 25 de ani',
  )
const numarNecesar = z
  .string()
  .refine(
    (s) => s.trim() !== '' && Number.isInteger(Number(s)) && Number(s) >= 1 && Number(s) <= 99,
    'Între 1 și 99',
  )

export const COMPONENTA_GOALA = { name: '', amount_lei: '' }
export const CATEGORIE_GOALA = {
  age_from: '',
  age_to: '',
  componente: [{ ...COMPONENTA_GOALA }],
}

export const CAMP_FORM_STEPS = ['Detalii', 'Categorii și costuri', 'Verificare'] as const
export const DETALII_FIELDS = [
  'title',
  'slug',
  'period_start',
  'period_end',
  'rules',
  'necesar',
] as const
export const COSTURI_FIELDS = ['currency', 'eur_ron_rate', 'varste'] as const

export const schema = z
  .object({
    ...offerCurrencyShape,
    varste: z
      .array(
        z
          .object({
            age_from: ani,
            age_to: ani,
            componente: z
              .array(
                z.object({
                  name: z.string().trim().min(1, 'Numele lipsește'),
                  amount_lei: lei,
                }),
              )
              .min(1, 'Adaugă cel puțin o componentă'),
          })
          .refine((c) => Number(c.age_from) <= Number(c.age_to), {
            message: 'Vârsta de început e după cea de sfârșit',
            path: ['age_to'],
          }),
      )
      .min(1, 'Prețul pe categorii are nevoie de cel puțin o categorie de vârstă'),
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
    allow_cash: z.boolean(),
    description: z.string().optional(),
    rules: z.string().max(8000, 'Regulamentul poate avea cel mult 8000 de caractere'),
    necesar: z.array(
      z.object({
        name: z.string().trim().min(1, 'Numele categoriei lipsește'),
        items: z
          .array(
            z.object({
              name: z.string().trim().min(1, 'Numele articolului lipsește'),
              quantity: numarNecesar,
            }),
          )
          .min(1, 'Adaugă cel puțin un articol'),
      }),
    ),
  })
  .superRefine(validateOfferCurrency)
  .refine((v) => v.period_end >= v.period_start, {
    message: 'Sfârșitul nu poate fi înaintea începutului',
    path: ['period_end'],
  })
  .superRefine((v, ctx) => {
    const perechi = v.varste.map((c) => ({
      age_from: Number(c.age_from),
      age_to: Number(c.age_to),
    }))
    const suprapuse = intervaleSuprapuse(perechi)
    if (!suprapuse) return
    const [a, b] = suprapuse
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Categoria ${perechi[a].age_from}–${perechi[a].age_to} ani se suprapune cu ${perechi[b].age_from}–${perechi[b].age_to} ani`,
      path: ['varste'],
    })
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
  allow_cash: false,
  description: '',
  rules: '',
  necesar: [],
  varste: [{ ...CATEGORIE_GOALA, componente: [{ ...COMPONENTA_GOALA }] }],
}

export const num = (s: string | undefined) => (s && s.trim() ? Number(s) : null)

export const spreCamp = (c: { age_from: number; age_to: number; amount: number }) => ({
  age_from: String(c.age_from),
  age_to: String(c.age_to),
  componente: [{ name: 'Participare', amount_lei: String(baniToRon(c.amount)) }],
})
