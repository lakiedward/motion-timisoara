import { beforeEach, expect, test, vi } from 'vitest'

import {
  getTaberelemele,
  intervaleSuprapuse,
  slugDinTitlu,
  sumaCategoriilor,
} from './camps-admin'

let raspuns: Record<string, { data: unknown; error: unknown }> = {}
let cereri: Record<string, string[]> = {}

function tabela(nume: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[nume] ?? { data: [], error: null }))
      }
      return (...args: unknown[]) => {
        ;(cereri[nume] ??= []).push(`${prop}(${args.map(String).join(',')})`)
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (nume: string) => tabela(nume) },
}))

// Capetele intervalelor sunt incluse, ca în baza de date (00037): un copil de 8
// ani intră și în 6–8, și în 8–10, deci cele două se suprapun. Formularul arată
// exact perechea vinovată, nu doar „ceva nu e bine".
test('două intervale care împart un an se suprapun; vecinele nu', () => {
  expect(intervaleSuprapuse([{ age_from: 6, age_to: 8 }, { age_from: 8, age_to: 10 }])).toEqual([0, 1])
  expect(intervaleSuprapuse([{ age_from: 6, age_to: 8 }, { age_from: 9, age_to: 12 }])).toBeNull()
  expect(intervaleSuprapuse([])).toBeNull()
})

test('suprapunerea se găsește oriunde în listă, nu doar între vecine', () => {
  expect(
    intervaleSuprapuse([
      { age_from: 6, age_to: 8 },
      { age_from: 9, age_to: 12 },
      { age_from: 3, age_to: 7 },
    ]),
  ).toEqual([0, 2])
})

// Diacriticele românești au două forme în Unicode (virgulă și sedilă) și niciuna
// nu se descompune prin NFD, deci se scot pe nume. Restul — ă, â, î — se
// descompun, iar semnele rămase se taie cu un interval de caractere invizibile.
// Testul ăsta există ca să se vadă imediat dacă acea linie e ștearsă din greșeală.
test('slugul scoate diacriticele românești, în toate formele lor', () => {
  expect(slugDinTitlu('Tabără de mountain bike în Alpi')).toBe('tabara-de-mountain-bike-in-alpi')
  expect(slugDinTitlu('Ștefan și Țara')).toBe('stefan-si-tara')
  // Aceleași litere, dar cu sedilă în loc de virgulă — cum le scriu unele tastaturi.
  expect(slugDinTitlu('Ştefan şi Ţara')).toBe('stefan-si-tara')
  expect(slugDinTitlu('Stagiu ÎNOT — juniori, ediția a 3-a')).toBe('stagiu-inot-juniori-editia-a-3-a')
})

test('slugul nu lasă cratime la capete și nu trece de 60 de caractere', () => {
  expect(slugDinTitlu('  --- Tabără ---  ')).toBe('tabara')
  const lung = slugDinTitlu('a'.repeat(58) + ' coada')
  expect(lung.length).toBeLessThanOrEqual(60)
  expect(lung.endsWith('-')).toBe(false)
})

test('un titlu fără litere latine dă slug gol, nu unul din cratime', () => {
  expect(slugDinTitlu('!!! ???')).toBe('')
})

test('suma categoriilor se face în bani, nu în lei', () => {
  expect(sumaCategoriilor([{ amount: 140000 }, { amount: 90000 }, { amount: 60000 }, { amount: 30000 }])).toBe(320000)
  expect(sumaCategoriilor([])).toBe(0)
})

// Un câmp gol din formular ajunge NaN înainte să fie validat; suma trebuie să
// rămână un număr, altfel comparația cu prețul dă mereu fals și utilizatorul
// vede „nu se potrivește" fără să înțeleagă de ce.
test('o sumă încă necompletată nu otrăvește totalul', () => {
  expect(sumaCategoriilor([{ amount: 100 }, { amount: Number.NaN }])).toBe(100)
})

beforeEach(() => {
  raspuns = {}
  cereri = {}
})

const CAMP_BY_AGE = {
  id: 'camp-age',
  pricing_mode: 'by_age',
  price: 0,
  club_id: 'club-1',
  coach_id: null,
}
const CAMP_SINGLE = {
  id: 'camp-single',
  pricing_mode: 'single',
  price: 90000,
  club_id: 'club-1',
  coach_id: null,
}

test('lista by_age numără prețurile pe vârstă, nu itemele globale', async () => {
  raspuns = {
    camps: { data: [CAMP_BY_AGE, CAMP_SINGLE], error: null },
    enrollments: { data: [], error: null },
    camp_price_items: {
      data: [{ camp_id: 'camp-age' }, { camp_id: 'camp-single' }, { camp_id: 'camp-single' }],
      error: null,
    },
    camp_coaches: { data: [], error: null },
    camp_age_prices: {
      data: [
        { camp_id: 'camp-age', amount: 0 },
        { camp_id: 'camp-age', amount: 60000 },
      ],
      error: null,
    },
  }
  const lista = await getTaberelemele({ clubId: 'club-1', coachUserId: null })
  expect(cereri.camps.some((f) => f.includes('eq(club_id,club-1)'))).toBe(true)
  expect(cereri.camp_age_prices.some((f) => f.includes('in(camp_id'))).toBe(true)
  const peVarsta = lista.find((t) => t.id === 'camp-age')
  const unica = lista.find((t) => t.id === 'camp-single')
  expect(peVarsta?.categorii).toBe(2)
  expect(peVarsta?.preturiPeVarsta).toEqual([0, 60000])
  expect(unica?.categorii).toBe(2)
  expect(unica?.preturiPeVarsta).toEqual([])
})

test('fără prețuri pe vârstă, by_age rămâne cu zero categorii', async () => {
  raspuns = {
    camps: { data: [CAMP_BY_AGE], error: null },
    enrollments: { data: [], error: null },
    camp_price_items: { data: [{ camp_id: 'camp-age' }], error: null },
    camp_coaches: { data: [], error: null },
    camp_age_prices: { data: [], error: null },
  }
  const [tabara] = await getTaberelemele({ clubId: 'club-1', coachUserId: null })
  expect(tabara.categorii).toBe(0)
  expect(tabara.preturiPeVarsta).toEqual([])
})
