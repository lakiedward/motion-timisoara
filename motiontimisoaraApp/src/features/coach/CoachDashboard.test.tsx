import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachDashboard from './CoachDashboard'
import {
  getMyActivities,
  getMyCoachStripeStatus,
  getMyCourses,
  getMyLocations,
  type CoachCourse,
} from '@/api/coach'
import { getTaberelemele } from '@/api/camps-admin'
import { getCompetitionList } from '@/api/competition/competition-list'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'coach-1',
      email: 'uiaudit.coach@motiontimisoara.test',
      name: 'Audit Antrenor',
      role: 'COACH',
      phone: null,
      avatarUrl: null,
      needsProfileCompletion: false,
    },
    loading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/api/coach', () => ({
  getMyCourses: vi.fn(),
  getMyActivities: vi.fn(),
  getMyLocations: vi.fn(),
  getMyCoachStripeStatus: vi.fn(),
}))
vi.mock('@/api/camps-admin', () => ({ getTaberelemele: vi.fn() }))
vi.mock('@/api/competition/competition-list', () => ({ getCompetitionList: vi.fn() }))
vi.mock('@/api/payments/card-payments-month', () => ({
  CARD_PAYMENTS_MONTH_QUERY_KEY: ['card-payments-month'],
  getCardPaymentsMonth: vi.fn().mockResolvedValue({
    monthStart: '2026-11-01',
    collected: 1600000,
    stripeFee: 29000,
    net: 1571000,
    paymentCount: 50,
    unsettledCount: 0,
  }),
}))
vi.mock('@/api/payments/cash-payments', () => ({
  CASH_PAYMENTS_QUERY_KEY: ['cash-payments'],
  getCashPayments: vi.fn().mockResolvedValue([]),
}))

const mockedGetMyCourses = vi.mocked(getMyCourses)
const mockedStripeStatus = vi.mocked(getMyCoachStripeStatus)

beforeEach(() => {
  mockedStripeStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: false })
  mockedGetMyCourses.mockResolvedValue([])
  vi.mocked(getMyActivities).mockResolvedValue([])
  vi.mocked(getMyLocations).mockResolvedValue([])
  vi.mocked(getTaberelemele).mockResolvedValue([])
  vi.mocked(getCompetitionList).mockResolvedValue([])
})

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoachDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function course(overrides: Partial<CoachCourse>): CoachCourse {
  return {
    id: 'c1',
    name: 'Înot',
    active: true,
    sport_id: 's1',
    location_id: 'l1',
    coach_id: 'coach-1',
    club_id: null,
    level: null,
    age_from: null,
    age_to: null,
    capacity: null,
    price: 0,
    currency: 'RON',
    price_per_session: 0,
    package_options: null,
    recurrence_rule: null,
    description: null,
    hero_photo_storage_path: null,
    payment_recipient: 'COACH',
    sport: null,
    location: null,
    ...overrides,
  } as CoachCourse
}

test('greeting uses the first name and coach subtitle', async () => {
  renderDashboard()
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Salut, Audit!' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Panoul tău de antrenor.')).toBeInTheDocument()
})

test('the start panel covers every offer type, not only courses', async () => {
  mockedGetMyCourses.mockResolvedValue([course({ id: 'a' }), course({ id: 'b', active: false })])
  vi.mocked(getMyActivities).mockResolvedValue([
    { id: 'x' },
    { id: 'y' },
    { id: 'z' },
    { id: 'w' },
  ] as never)
  vi.mocked(getTaberelemele).mockResolvedValue([{ id: 't' }] as never)
  vi.mocked(getCompetitionList).mockResolvedValue([{ id: 'k' }, { id: 'l' }] as never)
  vi.mocked(getMyLocations).mockResolvedValue([{ id: 'loc' }] as never)
  renderDashboard()
  for (const name of ['Oferta ta', 'Organizare', 'Adaugă']) {
    expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument()
  }
  const expected: [string, string, string][] = [
    ['coach-stat-cursuri', '/coach/courses', '2'],
    ['coach-stat-activitati', '/coach/activities', '4'],
    ['coach-stat-tabere', '/coach/camps', '1'],
    ['coach-stat-concursuri', '/coach/competitions', '2'],
    ['coach-stat-locatii', '/coach/locations', '1'],
  ]
  for (const [id, href, value] of expected) {
    const row = screen.getByTestId(id)
    expect(row).toHaveAttribute('href', href)
    await waitFor(() => expect(row).toHaveTextContent(value))
  }
  expect(screen.getByTestId('coach-stat-cursuri')).toHaveTextContent('1 activ')
  expect(screen.queryByRole('listitem', { name: /Înot/ })).not.toBeInTheDocument()
})

test('quick add links open the new forms of every offer type', async () => {
  renderDashboard()
  expect(await screen.findByRole('link', { name: 'Curs nou' })).toHaveAttribute(
    'href',
    '/coach/courses/new',
  )
  expect(screen.getByRole('link', { name: 'Activitate nouă' })).toHaveAttribute(
    'href',
    '/coach/activities/new',
  )
  expect(screen.getByRole('link', { name: 'Tabără nouă' })).toHaveAttribute(
    'href',
    '/coach/camps/new',
  )
  expect(screen.getByRole('link', { name: 'Concurs nou' })).toHaveAttribute(
    'href',
    '/coach/competitions/new',
  )
})

test('empty collections keep zeros and a next-step hint', async () => {
  renderDashboard()
  const cursuri = await screen.findByTestId('coach-stat-cursuri')
  await waitFor(() => expect(cursuri).toHaveTextContent('0'))
  expect(cursuri).toHaveTextContent('Adaugă primul curs')
  expect(screen.getByTestId('coach-stat-activitati')).toHaveTextContent('Adaugă prima activitate')
})

test('a failed courses request shows a dash, not zeros', async () => {
  mockedGetMyCourses.mockRejectedValue(new Error('network'))
  renderDashboard()
  const cursuri = await screen.findByTestId('coach-stat-cursuri')
  await waitFor(() => expect(cursuri).toHaveTextContent('—'))
  expect(cursuri).toHaveTextContent('Nu am putut număra')
  expect(cursuri).not.toHaveTextContent('0')
})

test('the dashboard offers a way into Stripe setup and shows its state', async () => {
  renderDashboard()
  const stripe = await screen.findByTestId('coach-stat-stripe')
  expect(stripe).toHaveAttribute('href', '/coach/stripe')
  await waitFor(() => expect(stripe).toHaveAccessibleName('Plăți cu cardul, Neconfigurat'))
})

test('a coach who finished onboarding sees the configured state', async () => {
  mockedStripeStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: true })
  renderDashboard()
  const stripe = await screen.findByTestId('coach-stat-stripe')
  await waitFor(() => expect(stripe).toHaveAccessibleName('Plăți cu cardul, Configurat'))
})

test('a coach with Stripe sees this month\'s online payments in three figures', async () => {
  mockedStripeStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: true })
  renderDashboard()
  const card = await screen.findByTestId('card-payments-month')
  expect(card).toHaveTextContent('Plăți online în noiembrie')
  expect(await screen.findByText('50 de plăți cu cardul la ofertele tale, până azi')).toBeInTheDocument()
  expect(card).toHaveTextContent('Primești tu')
})

test('a coach without Stripe does not see the online payments card', async () => {
  renderDashboard()
  await screen.findByTestId('coach-stat-stripe')
  expect(screen.queryByTestId('card-payments-month')).not.toBeInTheDocument()
})

test('a failed Stripe status request does not claim the account is not configured', async () => {
  mockedStripeStatus.mockRejectedValue(new Error('network'))
  renderDashboard()
  const stripe = await screen.findByTestId('coach-stat-stripe')
  await waitFor(() =>
    expect(stripe).toHaveAccessibleName('Plăți cu cardul, Nu am putut verifica statusul'),
  )
  expect(stripe).not.toHaveTextContent('Neconfigurat')
})

test('while data loads, the rows show skeletons instead of zeros', async () => {
  mockedGetMyCourses.mockReturnValue(new Promise(() => {}))
  mockedStripeStatus.mockReturnValue(new Promise(() => {}))
  renderDashboard()
  expect(await screen.findByRole('status', { name: 'Se încarcă: Cursuri' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Se încarcă: Plăți cu cardul' })).toBeInTheDocument()
})
