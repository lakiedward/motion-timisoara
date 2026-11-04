import type { AdminPayment } from '@/api/payments/admin-payments'

export function adminPayment(overrides: Partial<AdminPayment> = {}): AdminPayment {
  return {
    source: 'PAYMENT',
    id: 'p1',
    kind: 'COURSE',
    offer_title: 'Înot copii',
    participant_name: 'Matei',
    is_adult: false,
    payer_name: 'Andreea Popescu',
    payer_email: 'andreea@example.test',
    receiver_name: 'Club Delfinii',
    method: 'CARD',
    card_brand: 'visa',
    card_last4: '4242',
    amount: 48000,
    amount_refunded: 0,
    stripe_fee_amount: 820,
    currency: 'RON',
    status: 'SUCCEEDED',
    gateway_ref: 'cs_test_1',
    created_at: '2026-11-04T08:40:00Z',
    paid_at: '2026-11-04T08:42:00Z',
    enrollment_status: 'ACTIVE',
    refunds: [],
    transferred: true,
    ...overrides,
  }
}
