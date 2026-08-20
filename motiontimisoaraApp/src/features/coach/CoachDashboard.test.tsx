import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachDashboard from './CoachDashboard'
import { getMyCoachStripeStatus, getMyCourses, type CoachCourse } from '@/api/coach'

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
  getMyCoachStripeStatus: vi.fn(),
}))

const mockedGetMyCourses = vi.mocked(getMyCourses)
const mockedStripeStatus = vi.mocked(getMyCoachStripeStatus)

beforeEach(() => {
  // The dashboard's Stripe card queries this on every render; default it to the
  // common case so each test only sets up what it actually asserts on.
  mockedStripeStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: false })
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
  mockedGetMyCourses.mockResolvedValue([])
  renderDashboard()
  expect(await screen.findByRole('heading', { name: 'Salut, Audit!' })).toBeInTheDocument()
  expect(screen.getByText('Panoul tău de antrenor.')).toBeInTheDocument()
})

test('empty collection keeps zeros and shows the empty message', async () => {
  mockedGetMyCourses.mockResolvedValue([])
  renderDashboard()
  expect(await screen.findByText('Nu ai încă niciun curs.')).toBeInTheDocument()
  expect(screen.getByText('Cursuri')).toBeInTheDocument()
  expect(screen.getByText('Cursuri active')).toBeInTheDocument()
  expect(screen.getAllByText('0')).toHaveLength(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('failed courses request shows an in-page error, not zeros', async () => {
  mockedGetMyCourses.mockRejectedValue(new Error('500'))
  renderDashboard()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca cursurile.')
  expect(screen.queryByText('Cursuri')).not.toBeInTheDocument()
  expect(screen.queryByText('Cursuri active')).not.toBeInTheDocument()
  expect(screen.queryByText('Nu ai încă niciun curs.')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /gestionează cursuri/i })).toBeInTheDocument()
})

test('filled stats count all courses and only active ones, without a course list', async () => {
  mockedGetMyCourses.mockResolvedValue([
    course({ id: '1', name: 'Înot — audit UI', active: true }),
    course({ id: '2', name: 'Alergare — audit UI', active: false }),
  ])
  renderDashboard()
  expect(await screen.findByText('2')).toBeInTheDocument()
  expect(screen.getByText('1')).toBeInTheDocument()
  expect(screen.getByText('Cursuri')).toBeInTheDocument()
  expect(screen.queryByText('Înot — audit UI')).not.toBeInTheDocument()
  expect(screen.queryByText('Nu ai încă niciun curs.')).not.toBeInTheDocument()
})

test('Curs nou and Gestionează cursuri point at the coach course routes', async () => {
  mockedGetMyCourses.mockResolvedValue([])
  renderDashboard()
  expect(await screen.findByRole('link', { name: /curs nou/i })).toHaveAttribute(
    'href',
    '/coach/courses/new',
  )
  expect(screen.getByRole('link', { name: /gestionează cursuri/i })).toHaveAttribute(
    'href',
    '/coach/courses',
  )
})

test('new-course control is a 44px-tall target and stacks under the greeting on small screens', async () => {
  mockedGetMyCourses.mockResolvedValue([])
  renderDashboard()
  const link = await screen.findByRole('link', { name: /curs nou/i })
  expect(link.className).toMatch(/h-11/)
  expect(link.className).toMatch(/min-h-11/)
  expect(link.className).toMatch(/w-full/)
  expect(link.className).toMatch(/md:w-auto/)
  const header = link.parentElement
  expect(header?.className).toMatch(/flex-col/)
  expect(header?.className).toMatch(/md:flex-row/)
})

test('the dashboard offers a way into Stripe setup and shows its state', async () => {
  mockedGetMyCourses.mockResolvedValue([])
  mockedStripeStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: false })

  renderDashboard()
  const card = await screen.findByLabelText('Stripe, Neconfigurat')
  expect(card).toHaveAttribute('href', '/coach/stripe')
  expect(card).toHaveAttribute('data-testid', 'coach-stat-stripe')
})

test('a coach who finished onboarding sees the configured state', async () => {
  mockedGetMyCourses.mockResolvedValue([])
  mockedStripeStatus.mockResolvedValue({ hasProfile: true, onboardingComplete: true })

  renderDashboard()
  expect(await screen.findByLabelText('Stripe, Configurat')).toHaveAttribute(
    'href',
    '/coach/stripe',
  )
})
