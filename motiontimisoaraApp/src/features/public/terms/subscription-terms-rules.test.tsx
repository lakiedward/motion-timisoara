import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'

import { baniToRon } from '@/lib/money'
import { PAST_DUE_GRACE_DAYS } from '@/features/subscriptions/subscription-state'

import TermsPage from '../TermsPage'
import { CLUB_PLANS, COACH_PLAN } from '../pricing/pricing-content'
import {
  SUBSCRIPTION_CANCEL_SECTION,
  SUBSCRIPTION_PLANS_SECTION,
} from './subscription-terms-sections'

const migration = readFileSync(
  resolve(process.cwd(), '../supabase/migrations/00107_subscriptions.sql'),
  'utf8',
)
const billing = readFileSync(
  resolve(process.cwd(), '../supabase/functions/_shared/subscription-billing.ts'),
  'utf8',
)

function randeaza() {
  return render(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>,
  )
}

function sectiunePlanuri() {
  return screen.getByRole('region', { name: /Abonamente: planuri, plată și facturare/ })
}

function sectiuneAnulare() {
  return screen.getByRole('region', { name: /Abonamente: anulare, rambursare și expirare/ })
}

test('planurile apar pe câte un rând, cu prețurile de pe pagina Prețuri', () => {
  randeaza()
  const rows = within(
    within(sectiunePlanuri()).getByRole('list', { name: 'Planurile și prețurile lor' }),
  ).getAllByRole('listitem')
  const plans = [COACH_PLAN, ...CLUB_PLANS]
  expect(rows).toHaveLength(plans.length)
  plans.forEach((plan, i) => {
    expect(rows[i]).toHaveTextContent(new RegExp(`: ${baniToRon(plan.priceBani)} lei\\.$`))
  })
  expect(sectiunePlanuri()).toHaveTextContent(
    'Operatorul nu este plătitor de TVA, deci nu adaugă TVA',
  )
})

test('secțiunea de planuri are operatorul în prima frază și cele 9 puncte cu etichetă', () => {
  randeaza()
  const sectiune = sectiunePlanuri()
  expect(sectiune.querySelector('p')).toHaveTextContent(
    /Părinții folosesc Motion România gratuit\. Un antrenor independent sau un club .* TITUS CLUB SWIM&FUN S\.R\.L\. \(CUI 49252540, J35\/4752\/2023\)/,
  )
  const etichete = Array.from(sectiune.querySelectorAll('li > strong')).map((e) => e.textContent)
  expect(etichete).toEqual([
    'Prețuri:',
    'Cine plătește:',
    'Perioada gratuită:',
    'Plata:',
    'Schimbarea planului:',
    'Schimbarea prețurilor:',
    'Facturare:',
    'Acceptare:',
    'Plățile de la părinți:',
  ])
  expect(sectiune).toHaveTextContent('Nu ți se cere cardul în această perioadă')
  expect(sectiune).toHaveTextContent(
    'pe datele de facturare pe care le completezi înainte de prima plată',
  )
})

test('cifrele din termeni coincid cu regulile implementate', () => {
  randeaza()
  const launchTrialDays = Number(
    migration.match(/launch_trial_days INTEGER NOT NULL DEFAULT (\d+)/)?.[1],
  )
  const signupTrialDays = Number(
    migration.match(/signup_trial_days INTEGER NOT NULL DEFAULT (\d+)/)?.[1],
  )
  const minTrialHours = Number(billing.match(/MIN_TRIAL_MS = (\d+) \* 3_600_000/)?.[1])
  const graceSql = Number(migration.match(/past_due_since \+ interval '(\d+) days'/)?.[1])

  const planuri = sectiunePlanuri()
  expect(launchTrialDays % 30).toBe(0)
  expect(planuri).toHaveTextContent(`primesc ${launchTrialDays / 30} luni gratuite`)
  expect(planuri).toHaveTextContent(`primesc ${signupTrialDays} de zile gratuite`)
  expect(planuri).toHaveTextContent(`mai puțin de ${minTrialHours} de ore`)
  expect(planuri).toHaveTextContent('cu cel puțin 30 de zile înainte')

  expect(graceSql).toBe(PAST_DUE_GRACE_DAYS)
  const anulare = sectiuneAnulare()
  expect(anulare).toHaveTextContent(`reîncearcă plata timp de ${PAST_DUE_GRACE_DAYS} zile`)
  expect(anulare).toHaveTextContent(`cele ${PAST_DUE_GRACE_DAYS} zile de după o plată nereușită`)
  expect(anulare).toHaveTextContent('dreptul de retragere de 14 zile')
})

test('anularea, rambursarea, plata nereușită și expirarea sunt în ordinea lor', () => {
  randeaza()
  const anulare = sectiuneAnulare()
  const etichete = Array.from(anulare.querySelectorAll('li > strong')).map((e) => e.textContent)
  expect(etichete).toEqual([
    'Anulare:',
    'Rambursare:',
    'Plată nereușită:',
    'Expirare:',
    'Ce rămâne după expirare:',
  ])
  expect(anulare).toHaveTextContent('Anularea cu efect imediat nu există')
  expect(anulare).toHaveTextContent('păstrezi accesul complet și nu se mai face nicio plată')
  expect(anulare).toHaveTextContent('nu rambursăm lunile trecute')
  expect(anulare).toHaveTextContent(
    'o plată pentru o lună în care o eroare a platformei ți-a blocat accesul',
  )
  expect(anulare).toHaveTextContent(
    'ofertele și profilul tău dispar din căutare, din liste și de pe hartă',
  )
  expect(anulare).toHaveTextContent('părinții nu mai pot face înscrieri noi')
  expect(anulare).toHaveTextContent('nu ștergem nimic')
  expect(anulare).toHaveTextContent('Dacă plătești din nou, totul reapare imediat')
  expect(anulare).toHaveTextContent(
    'pagina de abonament a panoului tău, prin portalul de facturare Stripe',
  )
})

test('intrările din cuprins au înălțime de atingere, focus vizibil și duc la secțiune cu margine sub antet', () => {
  const { container } = randeaza()
  const cuprins = screen.getByRole('navigation', { name: 'Cuprins' })
  for (const sectiune of [SUBSCRIPTION_PLANS_SECTION, SUBSCRIPTION_CANCEL_SECTION]) {
    const link = within(cuprins).getByRole('link', { name: new RegExp(sectiune.title) })
    expect(link).toHaveAttribute('href', `#${sectiune.id}`)
    expect(link.className).toContain('min-h-touch-target')
    expect(link.className).toContain('focus-visible:outline-2')
    expect(container.querySelector(`section#${sectiune.id}`)?.className).toContain('scroll-mt-24')
  }
})
