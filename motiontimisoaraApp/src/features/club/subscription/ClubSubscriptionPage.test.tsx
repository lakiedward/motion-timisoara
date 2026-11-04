import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { Subscription } from '@/api/subscriptions/subscriptions'
import ClubSubscriptionPage from './ClubSubscriptionPage'

const api = vi.hoisted(() => ({
  subscription: null as Subscription | null,
  coaches: 3,
  failPlans: false,
  change: vi.fn(),
}))

vi.mock('@/api/club', () => ({
  getMyClub: async () => ({ id: 'club-1', name: 'Club Test', stripe_onboarding_complete: false }),
  getClubCoaches: async () =>
    Array.from({ length: api.coaches }, (_, index) => ({ coach_profile_id: `c${index}` })),
}))

vi.mock('@/api/subscriptions/subscriptions', async (original) => ({
  ...(await original<typeof import('@/api/subscriptions/subscriptions')>()),
  getMySubscription: async (type: string, id: string) => {
    expect([type, id]).toEqual(['CLUB', 'club-1'])
    return api.subscription
  },
  getSubscriptionSettings: async () => ({
    launchAt: null,
    launchTrialDays: 90,
    signupTrialDays: 30,
  }),
  getSubscriptionPlans: async () => {
    if (api.failPlans) throw new Error('down')
    return [
      {
        code: 'CLUB_START',
        subscriberType: 'CLUB',
        name: 'Club Start',
        priceBani: 19900,
        coachLimit: 3,
      },
      { code: 'CLUB', subscriberType: 'CLUB', name: 'Club', priceBani: 34900, coachLimit: 10 },
      {
        code: 'CLUB_PRO',
        subscriberType: 'CLUB',
        name: 'Club Pro',
        priceBani: 59900,
        coachLimit: null,
      },
    ]
  },
}))

vi.mock('@/api/subscriptions/billing', async (original) => ({
  ...(await original<typeof import('@/api/subscriptions/billing')>()),
  changeSubscriptionPlan: api.change,
}))

function activeOn(planCode: string): Subscription {
  return {
    id: 'row',
    subscriberType: 'CLUB',
    planCode,
    scheduledPlanCode: null,
    status: 'active',
    trialEnd: null,
    currentPeriodEnd: '2099-12-02T10:00:00Z',
    pastDueSince: null,
    cancelAtPeriodEnd: false,
    hasStripeCustomer: true,
    hasStripeSubscription: true,
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/club/abonament']}>
        <ClubSubscriptionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.subscription = null
  api.coaches = 3
  api.failPlans = false
  api.change.mockReset()
})

test('a club without a subscription row sees the missing state and no payment button', async () => {
  renderPage()
  const status = await screen.findByTestId('subscription-status')
  expect(status.getAttribute('data-state')).toBe('missing')
  expect(screen.queryByRole('button', { name: /Alege|Treci/ })).toBeNull()
})

test('an active club at its limit sees the warning, upgrades and a blocked smaller plan', async () => {
  api.subscription = activeOn('CLUB')
  api.coaches = 4
  renderPage()
  await screen.findByTestId('subscription-status')
  expect(screen.getByTestId('plan-blocked-CLUB_START').textContent).toContain(
    'un antrenor peste limită',
  )
  expect(screen.getByTestId('plan-action-CLUB_PRO').textContent).toBe('Treci la Club Pro')
  expect(screen.getByTestId('billing-portal')).toBeTruthy()
  expect(screen.queryByTestId('coach-limit-warning')).toBeNull()
})

test('the limit warning names the next plan', async () => {
  api.subscription = activeOn('CLUB_START')
  renderPage()
  const warning = await screen.findByTestId('coach-limit-warning')
  expect(warning.textContent).toBe('Ai ajuns la limita pachetului Club Start: 3 din 3 antrenori.')
})

test('an upgrade asks first and then calls the plan change function', async () => {
  api.subscription = activeOn('CLUB')
  api.change.mockResolvedValue({ result: 'upgraded', planCode: 'CLUB_PRO', effectiveAt: null })
  renderPage()
  await userEvent.click(await screen.findByTestId('plan-action-CLUB_PRO'))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Treci la Club Pro acum?')).toBeTruthy()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Treci acum' }))
  await waitFor(() => expect(api.change).toHaveBeenCalledWith('CLUB_PRO'))
})

test('a load failure shows a retry, not an empty page', async () => {
  api.failPlans = true
  renderPage()
  expect(await screen.findByRole('button', { name: 'Reîncearcă' })).toBeTruthy()
})

test('a downgrade scheduled during the trial names the trial end date', async () => {
  api.subscription = {
    ...activeOn('CLUB'),
    status: 'trialing',
    trialEnd: '2099-11-24T10:00:00Z',
    currentPeriodEnd: '2099-11-24T10:00:00Z',
    scheduledPlanCode: 'CLUB_START',
  }
  renderPage()
  const note = await screen.findByTestId('scheduled-plan-note')
  expect(note.textContent).toBe('De la 24.11.2099 treci la Club Start (199 lei / lună).')
})
