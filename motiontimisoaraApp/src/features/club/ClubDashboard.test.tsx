import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ClubDashboard from './ClubDashboard'
import {
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

vi.mock('@/api/club', () => ({
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

function mockClubStats({
  coaches = 0,
  courses = 0,
  locations = 0,
  row = club(),
}: {
  coaches?: number
  courses?: number
  locations?: number
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
}

test('greeting uses the first name and keeps club identity as subtitle', async () => {
  mockClubStats()
  renderDashboard()
  expect(await screen.findByRole('heading', { name: 'Salut, Audit!' })).toBeInTheDocument()
  expect(screen.getByText('Club Audit Motion · Timișoara')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Club Audit Motion' })).not.toBeInTheDocument()
})

test('stats mix is Antrenori, Cursuri, Locații, Stripe — not Anunțuri', async () => {
  mockClubStats({ coaches: 1 })
  renderDashboard()
  const antrenori = await screen.findByRole('link', { name: /antrenori/i })
  expect(antrenori).toHaveAttribute('href', '/club/coaches')
  await waitFor(() => expect(antrenori).toHaveTextContent('1'))
  expect(screen.getByRole('link', { name: /cursuri/i })).toHaveAttribute('href', '/club/courses')
  expect(screen.getByRole('link', { name: /locații/i })).toHaveAttribute('href', '/club/locations')
  expect(screen.getByRole('link', { name: /stripe, neconfigurat/i })).toHaveAttribute(
    'href',
    '/club/stripe',
  )
  expect(screen.getByText('Neconfigurat')).toBeInTheDocument()
  expect(screen.queryByText('Anunțuri')).not.toBeInTheDocument()
})

test('zero courses and locations stay visible as 0', async () => {
  mockClubStats()
  renderDashboard()
  expect(await screen.findByTestId('club-stat-cursuri')).toHaveTextContent('0')
  expect(screen.getByTestId('club-stat-locatii')).toHaveTextContent('0')
  expect(screen.getByTestId('club-stat-antrenori')).toHaveTextContent('0')
  expect(screen.queryByText('Niciun club asociat contului.')).not.toBeInTheDocument()
})

test('empty club shows the dashed message without stats', async () => {
  mockClubStats({ row: null })
  renderDashboard()
  expect(await screen.findByText('Niciun club asociat contului.')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Salut, Audit!' })).not.toBeInTheDocument()
  expect(screen.queryByTestId('club-stat-antrenori')).not.toBeInTheDocument()
})

test('failed club request shows an in-page error, not the empty message', async () => {
  mockedGetMyClub.mockRejectedValue(new Error('500'))
  renderDashboard()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca clubul.')
  expect(screen.queryByText('Niciun club asociat contului.')).not.toBeInTheDocument()
  expect(screen.queryByTestId('club-stat-stripe')).not.toBeInTheDocument()
})

test('configured Stripe still links to setup and shows Configurat', async () => {
  mockClubStats({ row: club({ stripe_onboarding_complete: true }) })
  renderDashboard()
  const stripe = await screen.findByRole('link', { name: /stripe, configurat/i })
  expect(stripe).toHaveAttribute('href', '/club/stripe')
  expect(screen.getByText('Configurat')).toBeInTheDocument()
  expect(screen.queryByText('Neconfigurat')).not.toBeInTheDocument()
})

test('stat cards share a fixed min-height so stacked phone tiles match', async () => {
  mockClubStats()
  renderDashboard()
  const stripe = await screen.findByTestId('club-stat-stripe')
  for (const id of ['club-stat-antrenori', 'club-stat-cursuri', 'club-stat-locatii', 'club-stat-stripe']) {
    expect(screen.getByTestId(id).className).toMatch(/min-h-\[11\.5rem\]/)
    expect(screen.getByTestId(id).className).toMatch(/h-full/)
  }
  expect(stripe.className).toMatch(/cursor-pointer/)
})
