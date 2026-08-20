import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachStripePage from './CoachStripePage'
import { getMyCoachStripeStatus } from '@/api/coach'
import {
  StripeUnavailableError,
  getStripeDashboardLink,
  refreshStripeStatus,
  startStripeOnboarding,
} from '@/api/stripe-connect'

vi.mock('@/api/coach', () => ({
  getMyCoachStripeStatus: vi.fn(),
}))

vi.mock('@/api/stripe-connect', async (importOriginal) => {
  // Keep the real error class and its type guard so the unavailable path is
  // exercised for real; only the network calls are stubbed.
  const actual = await importOriginal<typeof import('@/api/stripe-connect')>()
  return {
    StripeUnavailableError: actual.StripeUnavailableError,
    isStripeUnavailable: actual.isStripeUnavailable,
    getStripeDashboardLink: vi.fn(),
    refreshStripeStatus: vi.fn(),
    startStripeOnboarding: vi.fn(),
  }
})

const mockedStatus = vi.mocked(getMyCoachStripeStatus)
const mockedStart = vi.mocked(startStripeOnboarding)
const mockedDashboard = vi.mocked(getStripeDashboardLink)
const mockedRefresh = vi.mocked(refreshStripeStatus)

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPage(path = '/coach/stripe') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <CoachStripePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('setup page shows Neconfigurat and starts onboarding on click', async () => {
  mockedStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: false })
  mockedStart.mockResolvedValue('https://connect.stripe.com/setup/coach')
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign })

  renderPage()
  expect(await screen.findByRole('heading', { name: 'Configurare plăți' })).toBeInTheDocument()
  expect(screen.getByText('Neconfigurat')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /configurează stripe/i }))
  expect(mockedStart).toHaveBeenCalled()
  expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/coach')
  vi.unstubAllGlobals()
})

test('the Stripe return route refreshes status without starting onboarding again', async () => {
  mockedStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: false })
  mockedRefresh.mockResolvedValue({
    hasAccount: true,
    onboardingComplete: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    requiresAction: true,
  })

  renderPage('/stripe/onboarding/complete')
  expect(await screen.findByRole('heading', { name: 'Configurare plăți' })).toBeInTheDocument()
  await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())
  expect(mockedStart).not.toHaveBeenCalled()
})

test('the Stripe refresh route mints a new onboarding link, because the old one expired', async () => {
  mockedStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: false })
  mockedStart.mockResolvedValue('https://connect.stripe.com/setup/renewed')
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign })

  renderPage('/stripe/onboarding/refresh')
  await waitFor(() => expect(mockedStart).toHaveBeenCalled())
  expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/renewed')
  expect(mockedRefresh).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})

test('a configured coach gets the Stripe dashboard link', async () => {
  mockedStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: true })
  mockedDashboard.mockResolvedValue({ url: 'https://dashboard.stripe.com/coach' })
  const assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign })

  renderPage()
  expect(await screen.findByText('Configurat')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /deschide dashboard stripe/i }))
  expect(mockedDashboard).toHaveBeenCalled()
  expect(assign).toHaveBeenCalledWith('https://dashboard.stripe.com/coach')
  vi.unstubAllGlobals()
})

test('without Stripe keys the page explains the platform is not ready and hides the CTA', async () => {
  mockedStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: false })
  mockedStart.mockRejectedValue(
    new StripeUnavailableError(
      'not_configured',
      'Plățile cu cardul nu sunt încă activate pe platformă.',
    ),
  )

  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: /configurează stripe/i }))

  expect(await screen.findByTestId('stripe-unavailable')).toHaveTextContent(
    'Plățile cu cardul nu sunt încă activate pe platformă.',
  )
  expect(screen.queryByRole('button', { name: /configurează stripe/i })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /înapoi la panou/i })).toHaveAttribute('href', '/coach')
})

test('an unreachable Edge Function on the return route reads as pending, not as a crash', async () => {
  mockedStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: false })
  mockedRefresh.mockRejectedValue(
    new StripeUnavailableError('unreachable', 'Serviciul de plăți nu răspunde deocamdată.'),
  )

  renderPage('/stripe/onboarding/complete')
  expect(await screen.findByTestId('stripe-unavailable')).toHaveTextContent(
    'Serviciul de plăți nu răspunde deocamdată.',
  )
})

test('a coach without a coach profile is told so instead of seeing a setup CTA', async () => {
  mockedStatus.mockResolvedValue({ hasProfile: false, onboardingComplete: false })

  renderPage()
  expect(await screen.findByText('Niciun profil de antrenor asociat contului.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /configurează stripe/i })).not.toBeInTheDocument()
})
