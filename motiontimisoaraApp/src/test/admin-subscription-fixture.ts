import type { AdminSubscription } from '@/api/subscriptions/admin-subscriptions'

const DAY = 86_400_000

export function inDays(days: number, from = Date.now()): string {
  return new Date(from + days * DAY).toISOString()
}

export function adminSubscription(overrides: Partial<AdminSubscription> = {}): AdminSubscription {
  return {
    id: 's1',
    subscriber_type: 'COACH',
    subscriber_name: 'Andrei Marin',
    subscriber_email: 'andrei@test.ro',
    plan_code: 'COACH',
    plan_name: 'Antrenor',
    price_bani: 10000,
    scheduled_plan_name: null,
    status: 'active',
    trial_end: null,
    current_period_end: '2026-11-25T10:00:00Z',
    access_end: '2026-11-26T10:00:00Z',
    cancel_at_period_end: false,
    has_stripe_subscription: true,
    coach_count: null,
    created_at: '2026-10-01T09:00:00Z',
    adjustments: [],
    ...overrides,
  }
}
