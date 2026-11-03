import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ClubDashboard from './ClubDashboard'
import { getTaberelemele } from '@/api/camps-admin'
import { getCompetitionList } from '@/api/competition/competition-list'
import {
  getClubActivities,
  getClubCoaches,
  getClubCourses,
  getClubLocations,
  getMyClub,
  type Club,
  type ClubCoach,
  type ClubCourse,
} from '@/api/club'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'club-1',
      email: 'uiaudit.club@motiontimisoara.test',
      name: 'Audit Club',
      role: 'CLUB',
      phone: null,
      avatarUrl: null,
      needsProfileCompletion: false,
    },
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  }),
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

vi.mock('@/api/club', () => ({
  getClubActivities: vi.fn(),
  getMyClub: vi.fn(),
  getClubCoaches: vi.fn(),
  getClubCourses: vi.fn(),
  getClubLocations: vi.fn(),
}))

const mockedGetMyClub = vi.mocked(getMyClub)
const mockedGetClubCoaches = vi.mocked(getClubCoaches)
const mockedGetClubCourses = vi.mocked(getClubCourses)
const mockedGetClubLocations = vi.mocked(getClubLocations)

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ClubDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function club(overrides: Partial<Club> = {}): Club {
  return {
    id: '078f8e37-ff13-45ce-a16d-486fa86de466',
    name: 'Club Audit Motion',
    owner_user_id: 'club-owner',
    approved_at: '2026-09-01T00:00:00Z',
    approved_by: null,
    city: 'Timișoara',
    address: null,
    bank_account: null,
    bank_name: null,
    company_address: null,
    company_cui: null,
    company_name: null,
    company_reg_number: null,
    county: null,
    lat: null,
    lng: null,
    created_at: '2026-01-01T00:00:00Z',
    description: null,
    email: null,
    hero_photo_storage_path: null,
    hidden_from_public: false,
    logo_storage_path: null,
    phone: null,
    public_email: null,
    public_email_consent: false,
    stripe_account_id: null,
    stripe_charges_enabled: false,
    stripe_onboarding_complete: false,
    stripe_payouts_enabled: false,
    website: null,
    ...overrides,
  }
}

function mockClubStats({
  coaches = 0,
  courses = 0,
  locations = 0,
  activities = 0,
  camps = 0,
  competitions = 0,
  row = club(),
}: {
  coaches?: number
  courses?: number
  locations?: number
  activities?: number
  camps?: number
  competitions?: number
  row?: Club | null
} = {}) {
  mockedGetMyClub.mockResolvedValue(row)
  mockedGetClubCoaches.mockResolvedValue(
    Array.from({ length: coaches }, (_, i) => ({
      coach_profile_id: `cp-${i}`,
      name: `Antrenor ${i}`,
      email: `c${i}@test.local`,
      photo_storage_path: null,
    })) as ClubCoach[],
  )
  mockedGetClubCourses.mockResolvedValue(
    Array.from({ length: courses }, (_, i) => ({ id: `course-${i}` })) as ClubCourse[],
  )
  mockedGetClubLocations.mockResolvedValue(
    Array.from({ length: locations }, (_, i) => ({ id: `loc-${i}` })) as Awaited<
      ReturnType<typeof getClubLocations>
    >,
  )
  vi.mocked(getClubActivities).mockResolvedValue(
    Array.from({ length: activities }, (_, i) => ({ id: `a-${i}` })) as never,
  )
  vi.mocked(getTaberelemele).mockResolvedValue(
    Array.from({ length: camps }, (_, i) => ({ id: `t-${i}` })) as never,
  )
  vi.mocked(getCompetitionList).mockResolvedValue(
    Array.from({ length: competitions }, (_, i) => ({ id: `k-${i}` })) as never,
  )
}

test('greeting uses the first name and keeps club identity as subtitle', async () => {
  mockClubStats()
  renderDashboard()
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Salut, Audit!' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Club Audit Motion · Timișoara')).toBeInTheDocument()
})

test('groups match the coach and admin panels: offer, organisation and quick add', async () => {
  mockClubStats({ coaches: 2, courses: 3, locations: 1, activities: 4, camps: 1, competitions: 2 })
  renderDashboard()
  for (const name of ['Oferta clubului', 'Organizare', 'Adaugă']) {
    expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument()
  }
  const expected: [string, string, string][] = [
    ['club-stat-cursuri', '/club/courses', '3'],
    ['club-stat-activitati', '/club/activities', '4'],
    ['club-stat-tabere', '/club/camps', '1'],
    ['club-stat-concursuri', '/club/competitions', '2'],
    ['club-stat-antrenori', '/club/coaches', '2'],
    ['club-stat-locatii', '/club/locations', '1'],
  ]
  for (const [id, href, value] of expected) {
    const row = screen.getByTestId(id)
    expect(row).toHaveAttribute('href', href)
    await waitFor(() => expect(row).toHaveTextContent(value))
  }
  expect(screen.queryByText('Anunțuri')).not.toBeInTheDocument()
})

test('quick add links open the new forms of every offer type', async () => {
  mockClubStats()
  renderDashboard()
  expect(await screen.findByRole('link', { name: 'Curs nou' })).toHaveAttribute(
    'href',
    '/club/courses/new',
  )
  expect(screen.getByRole('link', { name: 'Activitate nouă' })).toHaveAttribute(
    'href',
    '/club/activities/new',
  )
  expect(screen.getByRole('link', { name: 'Tabără nouă' })).toHaveAttribute(
    'href',
    '/club/camps/new',
  )
  expect(screen.getByRole('link', { name: 'Concurs nou' })).toHaveAttribute(
    'href',
    '/club/competitions/new',
  )
})

test('zero counts stay visible as 0 and carry a next-step hint', async () => {
  mockClubStats()
  renderDashboard()
  const cursuri = await screen.findByTestId('club-stat-cursuri')
  await waitFor(() => expect(cursuri).toHaveTextContent('0'))
  expect(cursuri).toHaveTextContent('Adaugă primul curs')
  expect(screen.getByTestId('club-stat-antrenori')).toHaveTextContent('Invită primul antrenor')
})

test('empty club shows the dashed message without stats', async () => {
  mockClubStats({ row: null })
  renderDashboard()
  expect(await screen.findByText('Niciun club asociat contului.')).toBeInTheDocument()
  expect(screen.queryByTestId('club-stat-antrenori')).not.toBeInTheDocument()
})

test('failed club request shows an in-page error, not the empty message', async () => {
  mockedGetMyClub.mockRejectedValue(new Error('network'))
  renderDashboard()
  expect(await screen.findByText('Nu am putut încărca clubul.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun club asociat contului.')).not.toBeInTheDocument()
  expect(screen.queryByTestId('club-stat-stripe')).not.toBeInTheDocument()
})

test('card payments row links to setup and shows its state', async () => {
  mockClubStats({ row: club({ stripe_onboarding_complete: true }) })
  renderDashboard()
  const stripe = await screen.findByTestId('club-stat-stripe')
  expect(stripe).toHaveAttribute('href', '/club/stripe')
  expect(stripe).toHaveAccessibleName('Plăți cu cardul, Configurat')
})

test('a club with Stripe sees its online payments and the club as recipient', async () => {
  mockClubStats({ row: club({ stripe_onboarding_complete: true }) })
  renderDashboard()
  const card = await screen.findByTestId('card-payments-month')
  expect(await screen.findByText('50 de plăți cu cardul la ofertele clubului, până azi')).toBeInTheDocument()
  expect(card).toHaveTextContent('Primește clubul')
})

test('a club without Stripe does not see the online payments card', async () => {
  mockClubStats()
  renderDashboard()
  await screen.findByTestId('club-stat-stripe')
  expect(screen.queryByTestId('card-payments-month')).not.toBeInTheDocument()
})

test('counts show a skeleton while loading instead of a false 0', async () => {
  mockClubStats()
  mockedGetClubCourses.mockReturnValue(new Promise(() => {}))
  renderDashboard()
  expect(await screen.findByRole('status', { name: 'Se încarcă: Cursuri' })).toBeInTheDocument()
})

test('a failed count shows a dash and a hint, not 0', async () => {
  mockClubStats()
  mockedGetClubLocations.mockRejectedValue(new Error('network'))
  renderDashboard()
  const locatii = await screen.findByTestId('club-stat-locatii')
  await waitFor(() => expect(locatii).toHaveTextContent('—'))
  expect(locatii).toHaveTextContent('Nu am putut număra')
})

test('failed club request offers Reîncearcă and recovers', async () => {
  mockedGetMyClub.mockRejectedValueOnce(new Error('network'))
  renderDashboard()
  mockClubStats()
  ;(await screen.findByRole('button', { name: /Reîncearcă/ })).click()
  expect(await screen.findByTestId('club-stat-cursuri')).toBeInTheDocument()
})
