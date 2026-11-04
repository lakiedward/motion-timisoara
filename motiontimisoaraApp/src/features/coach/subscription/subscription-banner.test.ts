import { describe, expect, it } from 'vitest'

import type { SubscriptionView } from '@/features/subscriptions/subscription-state'
import { daysLeftLabel } from './subscription-banner'

const trial = (daysLeft: number, paid = false): SubscriptionView => ({
  kind: 'trialing',
  endsAt: '2026-12-01T00:00:00.000Z',
  daysLeft,
  paid,
})

describe('daysLeftLabel', () => {
  it('stays hidden while the free period has more than 14 days', () => {
    expect(daysLeftLabel(trial(15))).toBeNull()
  })

  it('shows the days left inside the last 14 days', () => {
    expect(daysLeftLabel(trial(14))).toMatchObject({
      title: 'Perioada gratuită se termină în 14 zile',
      urgent: false,
    })
  })

  it('turns urgent in the last 3 days and says tomorrow for one day', () => {
    expect(daysLeftLabel(trial(3))?.urgent).toBe(true)
    expect(daysLeftLabel(trial(1))?.title).toBe('Perioada gratuită se termină mâine')
  })

  it('stays hidden once the plan is chosen', () => {
    expect(daysLeftLabel(trial(5, true))).toBeNull()
  })

  it('warns when the payment failed or the subscription expired', () => {
    expect(daysLeftLabel({ kind: 'past_due', graceEndsAt: null })).toMatchObject({ urgent: true })
    expect(daysLeftLabel({ kind: 'expired' })?.title).toBe('Abonamentul a expirat')
  })

  it('stays hidden for the calm states', () => {
    expect(daysLeftLabel({ kind: 'active', nextChargeAt: null })).toBeNull()
    expect(daysLeftLabel({ kind: 'missing' })).toBeNull()
    expect(daysLeftLabel({ kind: 'launch_pending', launchTrialDays: 90 })).toBeNull()
  })
})
