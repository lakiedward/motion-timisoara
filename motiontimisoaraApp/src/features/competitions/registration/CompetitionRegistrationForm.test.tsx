import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { CompetitionRegistrationForm } from './CompetitionRegistrationForm'
import { getMyChildren } from '@/api/account'
import {
  createCompetitionRegistration,
  validateCompetitionRegistration,
} from '@/api/competition/competition-registration'
import type { PublicCompetition } from '@/api/competition/competitions'
import type { CompetitionCategory } from '@/api/competition/competition-offers'

vi.mock('@/api/account', () => ({ getMyChildren: vi.fn() }))
vi.mock('@/api/competition/competition-registration', () => ({
  validateCompetitionRegistration: vi.fn(),
  createCompetitionRegistration: vi.fn(),
}))
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'parent-1', name: 'Părinte Audit', email: 'parent@example.test', role: 'PARENT' },
  }),
}))
vi.mock('@/features/account/checkout/usePaymentAdapter', () => ({
  usePaymentAdapter: () => ({ adapter: { confirm: vi.fn() }, ready: false }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }))

const competition: PublicCompetition = {
  id: 'competition-1',
  slug: 'cupa',
  title: 'Cupa copiilor',
  description: 'Descriere',
  heroUrl: null,
  organizator: null,
  startAt: '2026-11-01T08:00:00Z',
  endAt: '2026-11-01T10:00:00Z',
  registrationDeadlineAt: '2099-10-31T20:00:00Z',
  locationText: 'Timișoara',
  allowCash: false,
}

const category: CompetitionCategory = {
  id: 'category-1',
  competition_id: competition.id,
  route_id: 'route-1',
  name: '8–10 ani',
  age_from: 8,
  age_to: 10,
  price_bani: 0,
  display_order: 0,
  created_at: '2026-09-22T00:00:00Z',
  updated_at: '2026-09-22T00:00:00Z',
}

function renderRegistration() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/account/competitions/cupa/register']}>
        <Routes>
          <Route
            path="/account/competitions/:slug/register"
            element={
              <CompetitionRegistrationForm competition={competition} categories={[category]} />
            }
          />
          <Route path="/account/enrollments" element={<p>Înscrieri salvate</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getMyChildren).mockReset()
  vi.mocked(validateCompetitionRegistration).mockReset()
  vi.mocked(createCompetitionRegistration).mockReset()
  vi.mocked(getMyChildren).mockResolvedValue([
    {
      id: 'child-1',
      name: 'Copil Audit',
      birth_date: '2017-10-01',
    },
  ] as never)
})

test('categoria eligibilă gratuită se înscrie fără card sau cash', async () => {
  const user = userEvent.setup()
  vi.mocked(validateCompetitionRegistration).mockResolvedValue({
    results: [
      {
        childId: 'child-1',
        categoryId: category.id,
        routeId: category.route_id,
        name: 'Copil Audit',
        eligible: true,
        amount: 0,
        currency: 'RON',
        priceVersion: 'a'.repeat(64),
      },
    ],
    allowCash: false,
  })
  vi.mocked(createCompetitionRegistration).mockResolvedValue({
    enrollmentId: 'enrollment-1',
    enrollmentIds: ['enrollment-1'],
    requiresPaymentIntent: false,
  })
  renderRegistration()
  await user.selectOptions(await screen.findByLabelText('Copil Audit'), category.id)
  expect(await screen.findByText('Preț verificat: Gratuit')).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: 'Confirmă înscrierea gratuită' }))
  await waitFor(() =>
    expect(createCompetitionRegistration).toHaveBeenCalledWith({
      competitionId: competition.id,
      selections: [{ childId: 'child-1', categoryId: category.id }],
      paymentMethod: 'CARD',
      priceVersions: { 'child-1': 'a'.repeat(64) },
      billingDetails: undefined,
    }),
  )
  expect(await screen.findByText('Înscrieri salvate')).toBeInTheDocument()
})

test('categoria respinsă nu permite înscrierea', async () => {
  const user = userEvent.setup()
  vi.mocked(validateCompetitionRegistration).mockResolvedValue({
    results: [
      {
        childId: 'child-1',
        categoryId: category.id,
        routeId: category.route_id,
        name: 'Copil Audit',
        eligible: false,
        reason: 'Vârsta la data înscrierii nu corespunde categoriei.',
      },
    ],
    allowCash: false,
  })
  renderRegistration()
  await user.selectOptions(await screen.findByLabelText('Copil Audit'), category.id)
  expect(await screen.findByRole('alert')).toHaveTextContent('Vârsta la data înscrierii')
  expect(screen.getByRole('button', { name: 'Finalizează înscrierea' })).toBeDisabled()
  expect(createCompetitionRegistration).not.toHaveBeenCalled()
})
