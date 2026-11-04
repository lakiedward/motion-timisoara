import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SubscriptionView } from '@/features/subscriptions/subscription-state'
import CoachSubscriptionPage from './CoachSubscriptionPage'
import { useCoachSubscription } from './use-coach-subscription'

vi.mock('./use-coach-subscription', () => ({ useCoachSubscription: vi.fn() }))
vi.mock('@/features/payments/CardPaymentsMonthCard', () => ({
  CardPaymentsMonthCard: ({ enabled }: { enabled: boolean }) =>
    enabled ? <div data-testid="card-payments-month" /> : null,
}))

type HookState = ReturnType<typeof useCoachSubscription>

const checkout = vi.fn()
const portal = vi.fn()

function mockState(over: Record<string, unknown>) {
  vi.mocked(useCoachSubscription).mockReturnValue({
    isCoach: true,
    data: { isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
    view: null,
    plan: { code: 'COACH', name: 'Antrenor', priceBani: 10000, coachLimit: null },
    planLabel: { name: 'Antrenor', priceLei: '100' },
    coveringClubs: [],
    coverSettled: true,
    stripeComplete: false,
    billing: { busy: null, error: null, checkout, portal },
    checkoutAllowed: false,
    manageAllowed: false,
    ...over,
  } as unknown as HookState)
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CoachSubscriptionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const trial: SubscriptionView = {
  kind: 'trialing',
  endsAt: '2026-12-01T00:00:00.000Z',
  daysLeft: 27,
  paid: false,
}

beforeEach(() => {
  checkout.mockReset()
  portal.mockReset()
})

describe('CoachSubscriptionPage', () => {
  it('starts Checkout for the coach plan during the free period', async () => {
    mockState({ view: trial, checkoutAllowed: true })
    renderPage()
    expect(screen.getByText('Mai ai 27 zile gratuite')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Alege Antrenor' }))
    expect(checkout).toHaveBeenCalledWith('COACH')
    expect(screen.queryByRole('button', { name: 'Gestionează abonamentul' })).toBeNull()
  })

  it('opens the Customer Portal once the plan is paid', async () => {
    mockState({
      view: { kind: 'active', nextChargeAt: '2026-12-02T00:00:00.000Z' },
      manageAllowed: true,
    })
    renderPage()
    expect(screen.queryByRole('button', { name: 'Alege Antrenor' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Gestionează abonamentul' }))
    expect(portal).toHaveBeenCalledTimes(1)
  })

  it('offers no payment button before launch', () => {
    mockState({ view: { kind: 'launch_pending', launchTrialDays: 90 } })
    renderPage()
    expect(screen.getByText('Perioada gratuită de lansare')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says when a club covers the club offers', () => {
    mockState({ view: trial, checkoutAllowed: true, coveringClubs: [{ id: 'c1', name: 'Club A' }] })
    renderPage()
    expect(screen.getByTestId('club-cover-notice')).toHaveTextContent('Clubul Club A acoperă')
  })

  it('shows the monthly card payments card only when Stripe is configured', () => {
    mockState({ view: trial, stripeComplete: true })
    const { unmount } = renderPage()
    expect(screen.getByTestId('card-payments-month')).toBeInTheDocument()
    unmount()
    mockState({ view: trial, stripeComplete: false })
    renderPage()
    expect(screen.queryByTestId('card-payments-month')).toBeNull()
  })

  it('shows the billing error from Stripe', () => {
    mockState({
      view: trial,
      billing: { busy: null, error: new Error('Plata nu poate fi deschisă.'), checkout, portal },
    })
    renderPage()
    expect(screen.getByTestId('subscription-error')).toHaveTextContent(
      'Plata nu poate fi deschisă.',
    )
  })

  it('offers a retry when loading fails and a hint for non-coaches', async () => {
    const refetch = vi.fn()
    mockState({ data: { isLoading: false, isError: true, isFetching: false, refetch } })
    const { unmount } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: /reîncearcă/i }))
    expect(refetch).toHaveBeenCalled()
    unmount()
    mockState({ isCoach: false })
    renderPage()
    expect(
      screen.getByText('Abonamentul este doar pentru conturile de antrenor'),
    ).toBeInTheDocument()
  })
})
