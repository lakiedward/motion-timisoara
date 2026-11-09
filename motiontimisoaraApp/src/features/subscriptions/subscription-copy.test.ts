import { expect, test } from 'vitest'

import { subscriptionCopy } from './subscription-copy'

const plan = { name: 'Club', priceLei: '349' }

test('every state has a badge, a title and a detail line', () => {
  expect(subscriptionCopy({ kind: 'missing' }, null).title).toBe(
    'Abonamentul nu este încă pregătit',
  )
  expect(subscriptionCopy({ kind: 'launch_pending', launchTrialDays: 90 }, null).detail).toContain(
    '3 luni gratuite',
  )
  expect(
    subscriptionCopy(
      { kind: 'trialing', endsAt: '2026-11-20T10:00:00Z', daysLeft: 16, paid: false },
      null,
    ),
  ).toMatchObject({ title: 'Mai ai 16 zile gratuite', tone: 'success' })
  expect(
    subscriptionCopy(
      { kind: 'trialing', endsAt: '2026-11-20T10:00:00Z', daysLeft: 1, paid: false },
      null,
    ).title,
  ).toBe('Mai ai o zi gratuită')
  expect(
    subscriptionCopy(
      { kind: 'trialing', endsAt: '2026-11-20T10:00:00Z', daysLeft: 16, paid: true },
      plan,
    ).detail,
  ).toContain('Prima plată este pe 20.11.2026')
  expect(
    subscriptionCopy({ kind: 'active', nextChargeAt: '2026-12-02T10:00:00Z' }, plan),
  ).toMatchObject({
    badge: 'Activ',
    title: 'Club · 349 lei / lună',
    detail: 'Următoarea plată: 02.12.2026.',
  })
  expect(
    subscriptionCopy({ kind: 'past_due', graceEndsAt: '2026-11-08T12:00:00Z' }, plan),
  ).toMatchObject({ tone: 'destructive', title: 'Plata lunară nu a trecut' })
  expect(
    subscriptionCopy({ kind: 'canceled', endsAt: '2026-11-20T00:00:00Z' }, plan).detail,
  ).toContain('20.11.2026')
  expect(subscriptionCopy({ kind: 'expired' }, plan).badge).toBe('Expirat')
})

test('trial payment line matches when Checkout charges', () => {
  const now = Date.parse('2026-11-18T10:00:00Z')
  const view = { kind: 'trialing', daysLeft: 2, paid: false } as const
  expect(
    subscriptionCopy({ ...view, endsAt: '2026-11-20T09:00:00Z' }, null, now).detail,
  ).toContain('Plata se face acum, la alegerea pachetului.')
  expect(
    subscriptionCopy({ ...view, endsAt: '2026-11-20T11:00:00Z' }, null, now).detail,
  ).toContain('Plătești abia la finalul perioadei gratuite.')
})
