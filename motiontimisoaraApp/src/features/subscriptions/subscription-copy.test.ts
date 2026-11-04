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
