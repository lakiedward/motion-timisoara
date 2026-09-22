import { GOL } from '../camp-form-schema'
import type { SablonTabara } from '@/api/camps-admin'
import {
  aplicaSablon,
  formularAreDate,
  golesteCampuriCopiate,
  pasCuEroareSablon,
  payloadSablon,
} from './camp-template-draft'

const complet = {
  ...GOL,
  title: 'Tabără de înot',
  slug: 'tabara-inot',
  period_start: '2027-07-10',
  period_end: '2027-07-17',
  description: 'La lac',
  rules: 'Liniste',
  location_id: 'loc-1',
  location_text: 'Ponton',
  capacity: '20',
  allow_cash: true,
  necesar: [{ name: 'Echipament', items: [{ name: 'Sac', quantity: '1' }] }],
  varste: [{ age_from: '6', age_to: '9', componente: [{ name: 'Cazare', amount_lei: '400' }] }],
}

const sablon: SablonTabara = {
  id: 'sablon-1',
  name: 'Vara',
  description: 'In fiecare an',
  rules: 'Reguli',
  location_id: 'loc-2',
  location_text: 'Cabana',
  capacity: 12,
  allow_cash: false,
  currency: 'EUR',
  camp_requirements: [{ name: 'Haine', items: [{ name: 'Geaca', quantity: 2 }] }],
  age_prices: [{ age_from: 10, age_to: 12, components: [{ name: 'Masa', amount: 25000 }] }],
}

test('formularul gol nu cere confirmare', () => {
  expect(formularAreDate(GOL)).toBe(false)
})

test('un titlu tastat cere confirmare, iar golirea pastreaza titlul', () => {
  const cuTitlu = { ...GOL, title: 'Ediția 2027' }
  expect(formularAreDate(cuTitlu)).toBe(true)
  const golit = golesteCampuriCopiate({ ...complet, title: 'Ediția 2027', slug: 'editia' })
  expect(golit.title).toBe('Ediția 2027')
  expect(golit.slug).toBe('editia')
  expect(golit.period_start).toBe(complet.period_start)
  expect(golit.description).toBe('')
  expect(golit.currency).toBe('RON')
  expect(golit.varste[0].componente[0].name).toBe('')
})

test('aplicarea pastreaza titlul, adresa si perioada', () => {
  const aplicat = aplicaSablon(
    { ...complet, currency: 'EUR', eur_ron_rate: '5.26' },
    { ...sablon, currency: 'EUR' },
  )
  expect(aplicat.title).toBe(complet.title)
  expect(aplicat.slug).toBe(complet.slug)
  expect(aplicat.period_start).toBe(complet.period_start)
  expect(aplicat.period_end).toBe(complet.period_end)
  expect(aplicat.eur_ron_rate).toBe('5.26')
  expect(aplicat.description).toBe('In fiecare an')
  expect(aplicat.location_id).toBe('loc-2')
  expect(aplicat.capacity).toBe('12')
  expect(aplicat.necesar[0].items[0]).toEqual({ name: 'Geaca', quantity: '2' })
  expect(aplicat.varste[0].componente[0]).toEqual({ name: 'Masa', amount_lei: '250' })
})

test('schimbarea monedei nu pastreaza cursul vechi', () => {
  const aplicat = aplicaSablon({ ...complet, currency: 'RON', eur_ron_rate: '' }, sablon)
  expect(aplicat.currency).toBe('EUR')
  expect(aplicat.eur_ron_rate).toBe('')
})

test('salvarea sablonului ignora cursul lipsa si campurile de editie', () => {
  const eur = { ...complet, currency: 'EUR' as const, eur_ron_rate: '' }
  expect(pasCuEroareSablon(eur)).toBeNull()
  const payload = payloadSablon('  Vara  ', eur)
  expect(payload?.name).toBe('Vara')
  expect(payload?.currency).toBe('EUR')
  expect(payload?.age_prices[0].components[0]).toEqual({ name: 'Cazare', amount: 40000 })
  expect(payload).not.toHaveProperty('title')
  expect(payload).not.toHaveProperty('slug')
  expect(payload).not.toHaveProperty('period_start')
  expect(payload).not.toHaveProperty('eur_ron_rate')
})

test('pretul de adult nu blocheaza salvarea sablonului', () => {
  const faraAdult = {
    ...complet,
    adult: { componente: [{ name: '', amount_lei: '' }] },
  }
  expect(pasCuEroareSablon(faraAdult)).toBeNull()
  expect(payloadSablon('Vara', faraAdult)?.name).toBe('Vara')
})

test('o categorie invalida trimite inapoi la costuri', () => {
  expect(pasCuEroareSablon({ ...complet, varste: GOL.varste })).toBe(1)
  expect(payloadSablon('Vara', { ...complet, varste: GOL.varste })).toBeNull()
})
