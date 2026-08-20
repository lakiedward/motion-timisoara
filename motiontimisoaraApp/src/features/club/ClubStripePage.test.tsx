import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ClubStripePage from './ClubStripePage'
import { getMyClub, type Club } from '@/api/club'
import {
  getStripeDashboardLink,
  refreshStripeStatus,
  startStripeOnboarding,
} from '@/api/stripe-connect'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
}))

vi.mock('@/api/stripe-connect', async (importOriginal) => {
  // isStripeUnavailable decides whether a failure renders as a pending platform
  // or as an error toast, so the real guard has to survive the mock.
  const actual = await importOriginal<typeof import('@/api/stripe-connect')>()
  return {
    isStripeUnavailable: actual.isStripeUnavailable,
    getStripeDashboardLink: vi.fn(),
    refreshStripeStatus: vi.fn(),
    startStripeOnboarding: vi.fn(),
  }
})

const mockedGetMyClub = vi.mocked(getMyClub)
const mockedStart = vi.mocked(startStripeOnboarding)
const mockedDashboard = vi.mocked(getStripeDashboardLink)
const mockedRefresh = vi.mocked(refreshStripeStatus)

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPage(path = '/club/stripe') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <ClubStripePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function club(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-1',
    name: 'Club Audit Motion',
    owner_user_id: 'owner',
    city: 'Timișoara',
    address: null,
    bank_account: null,
    bank_name: null,
    company_address: null,
    company_cui: null,
    company_name: null,
    company_reg_number: null,
    created_at: '2026-01-01T00:00:00Z',
    description: null,
    email: null,
    hero_photo_storage_path: null,
    logo_storage_path: null,
    phone: null,
    public_email_consent: false,
    stripe_account_id: null,
    stripe_charges_enabled: false,
    stripe_onboarding_complete: false,
    stripe_payouts_enabled: false,
    website: null,
    ...overrides,
  }
}

test('setup page shows Neconfigurat and starts onboarding on click', async () => {
  mockedGetMyClub.mockResolvedValue(club())
  mockedStart.mockResolvedValue('https://connect.stripe.com/setup/test')
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign })

  renderPage()
  expect(await screen.findByRole('heading', { name: 'Configurare plăți' })).toBeInTheDocument()
  expect(screen.getByText('Neconfigurat')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /configurează stripe/i }))
  expect(mockedStart).toHaveBeenCalled()
  expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/test')
  vi.unstubAllGlobals()
})

test('refresh route starts a new onboarding link instead of only refreshing status', async () => {
  mockedGetMyClub.mockResolvedValue(club())
  mockedStart.mockResolvedValue('https://connect.stripe.com/setup/refresh')
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign })

  renderPage('/club/stripe/onboarding/refresh')
  await waitFor(() => expect(mockedStart).toHaveBeenCalled())
  expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/refresh')
  expect(mockedRefresh).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})

test('return route refreshes Connect status and does not start onboarding', async () => {
  mockedGetMyClub.mockResolvedValue(club())
  mockedRefresh.mockResolvedValue({
    hasAccount: true,
    onboardingComplete: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    requiresAction: true,
  })

  renderPage('/club/stripe/onboarding/complete')
  expect(await screen.findByRole('heading', { name: 'Configurare plăți' })).toBeInTheDocument()
  await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())
  expect(mockedStart).not.toHaveBeenCalled()
})

test('configured club offers the Stripe dashboard link', async () => {
  mockedGetMyClub.mockResolvedValue(club({ stripe_onboarding_complete: true }))
  mockedDashboard.mockResolvedValue({ url: 'https://dashboard.stripe.com/test' })
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign })

  renderPage()
  expect(await screen.findByText('Configurat')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /deschide dashboard stripe/i }))
  expect(mockedDashboard).toHaveBeenCalled()
  expect(assign).toHaveBeenCalledWith('https://dashboard.stripe.com/test')
  vi.unstubAllGlobals()
})
