import { schema, type Values } from './camp-form-schema'
import { ofertaDinDraft, totalCategorieBani, varsteDinDateSalvate } from './camp-form-totals'

test('totalul categoriei adună componentele în bani', () => {
  expect(
    totalCategorieBani([{ amount_lei: '400' }, { amount_lei: '200.5' }, { amount_lei: '0' }]),
  ).toBe(60050)
  expect(totalCategorieBani([])).toBe(0)
})

test('oferta din draft nu are preț global și păstrează suma pe categorie', () => {
  const values = {
    currency: 'RON',
    eur_ron_rate: '',
    title: 'Tabără de munte',
    slug: 'tabara-de-munte',
    period_start: '2027-07-10',
    period_end: '2027-07-17',
    location_id: '',
    location_text: '',
    capacity: '',
    allow_cash: false,
    description: '',
    rules: '',
    necesar: [],
    varste: [
      {
        age_from: '6',
        age_to: '8',
        componente: [
          { name: 'Cazare', amount_lei: '400' },
          { name: 'Masă', amount_lei: '200' },
        ],
      },
      {
        age_from: '9',
        age_to: '12',
        componente: [{ name: 'Cazare', amount_lei: '0' }],
      },
    ],
  } satisfies Values
  const oferta = ofertaDinDraft(values)
  expect(oferta.amount).toBe(0)
  expect(oferta.breakdown).toEqual([])
  expect(oferta.mode).toBe('by_age')
  expect(oferta.agePrices).toEqual([
    {
      age_from: 6,
      age_to: 8,
      amount: 60000,
      components: [
        { name: 'Cazare', amount: 40000 },
        { name: 'Masă', amount: 20000 },
      ],
    },
    {
      age_from: 9,
      age_to: 12,
      amount: 0,
      components: [{ name: 'Cazare', amount: 0 }],
    },
  ])
})

test('datele salvate pe vârstă revin ca o componentă Participare', () => {
  expect(
    varsteDinDateSalvate({
      agePrices: [{ age_from: 6, age_to: 8, amount: 70000 }],
      priceItems: [{ name: 'Cazare', amount: 50000 }],
      campPrice: 90000,
    }),
  ).toEqual([
    {
      age_from: '6',
      age_to: '8',
      componente: [{ name: 'Participare', amount_lei: '700' }],
    },
  ])
})

test('componentele salvate pe categorie revin cu numele lor', () => {
  expect(
    varsteDinDateSalvate({
      agePrices: [
        {
          age_from: 6,
          age_to: 8,
          amount: 60000,
          components: [
            { name: 'Cazare', amount: 40000 },
            { name: 'Masă', amount: 20000 },
          ],
        },
      ],
      priceItems: [],
      campPrice: 0,
    }),
  ).toEqual([
    {
      age_from: '6',
      age_to: '8',
      componente: [
        { name: 'Cazare', amount_lei: '400' },
        { name: 'Masă', amount_lei: '200' },
      ],
    },
  ])
})

test('fără vârste, desfășurarea veche devine componentele primei categorii', () => {
  expect(
    varsteDinDateSalvate({
      agePrices: [],
      priceItems: [
        { name: 'Cazare', amount: 50000 },
        { name: 'Masă', amount: 40000 },
      ],
      campPrice: 90000,
    }),
  ).toEqual([
    {
      age_from: '',
      age_to: '',
      componente: [
        { name: 'Cazare', amount_lei: '500' },
        { name: 'Masă', amount_lei: '400' },
      ],
    },
  ])
})

test('schema respinge intervalele suprapuse', () => {
  const rezultat = schema.safeParse({
    currency: 'RON',
    eur_ron_rate: '',
    title: 'Tabără de munte',
    slug: 'tabara-de-munte',
    period_start: '2027-07-10',
    period_end: '2027-07-17',
    allow_cash: false,
    rules: '',
    necesar: [],
    varste: [
      {
        age_from: '6',
        age_to: '8',
        componente: [{ name: 'Cazare', amount_lei: '100' }],
      },
      {
        age_from: '8',
        age_to: '10',
        componente: [{ name: 'Cazare', amount_lei: '100' }],
      },
    ],
  })
  expect(rezultat.success).toBe(false)
  if (rezultat.success) return
  expect(rezultat.error.issues.some((i) => i.message.includes('se suprapune'))).toBe(true)
})
