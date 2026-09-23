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

const authRole = vi.hoisted(() => ({ value: 'PARENT' }))

vi.mock('@/api/account', () => ({ getMyChildren: vi.fn() }))
vi.mock('@/api/competition/competition-registration', () => ({
  validateCompetitionRegistration: vi.fn(),
  createCompetitionRegistration: vi.fn(),
}))
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'parent-1',
      name: 'Părinte Audit',
      email: 'parent@example.test',
      role: authRole.value,
    },
  }),
}))
vi.mock('@/features/account/checkout/usePaymentAdapter', () => ({
  usePaymentAdapter: () => ({ adapter: { confirm: vi.fn() }, ready: false }),
}))
vi.mock('@stripe/react-stripe-js', () => ({ CardElement: () => <div /> }))
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

function renderRegistration(availableCategories = [category]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/account/competitions/cupa/register']}>
        <Routes>
          <Route
            path="/account/competitions/:slug/register"
            element={
              <CompetitionRegistrationForm
                competition={competition}
                categories={availableCategories}
              />
            }
          />
          <Route path="/account/enrollments" element={<p>Înscrieri salvate</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  authRole.value = 'PARENT'
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
        participantKey: 'child-1',
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
  await user.click(screen.getByRole('checkbox', { name: /Confirm categoriile/ }))
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
        participantKey: 'child-1',
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

test('adultul fără copii se înscrie gratuit cu data nașterii introdusă doar aici', async () => {
  const user = userEvent.setup()
  vi.mocked(getMyChildren).mockResolvedValue([])
  const adultCategory = {
    ...category,
    id: 'adult-category',
    name: 'Adulți',
    age_from: 18,
    age_to: 99,
  }
  vi.mocked(validateCompetitionRegistration).mockResolvedValue({
    results: [
      {
        participantKey: 'self',
        adultProfileId: 'parent-1',
        adultBirthDate: '1990-05-12',
        categoryId: adultCategory.id,
        routeId: category.route_id,
        name: 'Părinte Audit',
        eligible: true,
        amount: 0,
        currency: 'RON',
        priceVersion: 'b'.repeat(64),
      },
    ],
    allowCash: false,
  })
  vi.mocked(createCompetitionRegistration).mockResolvedValue({
    enrollmentId: 'enrollment-adult',
    enrollmentIds: ['enrollment-adult'],
    requiresPaymentIntent: false,
  })
  renderRegistration([adultCategory])
  expect(
    await screen.findByText('Nu ai copii adăugați. Te poți înscrie pe tine mai jos.'),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: 'Mă înscriu eu' }))
  await user.type(screen.getByLabelText('Data mea de naștere'), '1990-05-12')
  await user.selectOptions(screen.getByLabelText('Categoria mea'), adultCategory.id)
  await waitFor(() =>
    expect(validateCompetitionRegistration).toHaveBeenCalledWith(competition.id, [
      { selfBirthDate: '1990-05-12', categoryId: adultCategory.id },
    ]),
  )
  expect(await screen.findByText('Preț verificat: Gratuit')).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: /Confirm categoriile/ }))
  await user.click(screen.getByRole('button', { name: 'Confirmă înscrierea gratuită' }))
  await waitFor(() =>
    expect(createCompetitionRegistration).toHaveBeenCalledWith({
      competitionId: competition.id,
      selections: [{ selfBirthDate: '1990-05-12', categoryId: adultCategory.id }],
      paymentMethod: 'CARD',
      priceVersions: { self: 'b'.repeat(64) },
      billingDetails: undefined,
    }),
  )
})

test('schimbarea datei nașterii cere un preț nou și reconfirmare', async () => {
  const user = userEvent.setup()
  vi.mocked(getMyChildren).mockResolvedValue([])
  const adultCategory = {
    ...category,
    id: 'adult-category',
    name: 'Adulți',
    age_from: 18,
    age_to: 99,
  }
  vi.mocked(validateCompetitionRegistration).mockImplementation(async (_, selections) => {
    const self = selections.find((selection) => 'selfBirthDate' in selection)
    const adultBirthDate = self && 'selfBirthDate' in self ? self.selfBirthDate : ''
    return {
      results: [
        {
          participantKey: 'self',
          adultProfileId: 'parent-1',
          adultBirthDate,
          categoryId: adultCategory.id,
          routeId: category.route_id,
          name: 'Părinte Audit',
          eligible: true,
          amount: 0,
          currency: 'RON',
          priceVersion: adultBirthDate === '1990-05-12' ? 'a'.repeat(64) : 'b'.repeat(64),
        },
      ],
      allowCash: false,
    }
  })
  renderRegistration([adultCategory])
  await user.click(screen.getByRole('checkbox', { name: 'Mă înscriu eu' }))
  const birthDate = screen.getByLabelText('Data mea de naștere')
  await user.type(birthDate, '1990-05-12')
  await user.selectOptions(screen.getByLabelText('Categoria mea'), adultCategory.id)
  await screen.findByText('Preț verificat: Gratuit')
  await user.click(screen.getByRole('checkbox', { name: /Confirm categoriile/ }))
  expect(screen.getByRole('button', { name: 'Confirmă înscrierea gratuită' })).toBeEnabled()
  await user.clear(birthDate)
  await user.type(birthDate, '1991-05-12')
  await waitFor(() =>
    expect(validateCompetitionRegistration).toHaveBeenCalledWith(competition.id, [
      { selfBirthDate: '1991-05-12', categoryId: adultCategory.id },
    ]),
  )
  expect(screen.getByRole('checkbox', { name: /Confirm categoriile/ })).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Confirmă înscrierea gratuită' })).toBeDisabled()
})

test('antrenorul poate selecta propria înscriere fără încărcarea copiilor', async () => {
  authRole.value = 'COACH'
  vi.mocked(validateCompetitionRegistration).mockResolvedValue({
    results: [],
    allowCash: false,
  })
  renderRegistration()
  expect(await screen.findByRole('checkbox', { name: 'Mă înscriu eu' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Copil Audit')).not.toBeInTheDocument()
  expect(getMyChildren).not.toHaveBeenCalled()
})

test('adultul poate alege plata cash pentru propria înscriere cu preț pozitiv', async () => {
  const user = userEvent.setup()
  vi.mocked(getMyChildren).mockResolvedValue([])
  const adultCategory = {
    ...category,
    id: 'adult-category',
    name: 'Adulți',
    age_from: 18,
    age_to: 99,
    price_bani: 12000,
  }
  vi.mocked(validateCompetitionRegistration).mockResolvedValue({
    results: [
      {
        participantKey: 'self',
        adultProfileId: 'parent-1',
        adultBirthDate: '1990-05-12',
        categoryId: adultCategory.id,
        routeId: category.route_id,
        name: 'Părinte Audit',
        eligible: true,
        amount: 12000,
        currency: 'RON',
        priceVersion: 'c'.repeat(64),
      },
    ],
    allowCash: true,
  })
  vi.mocked(createCompetitionRegistration).mockResolvedValue({
    enrollmentId: 'enrollment-adult',
    enrollmentIds: ['enrollment-adult'],
    requiresPaymentIntent: false,
  })
  renderRegistration([adultCategory])
  await user.click(screen.getByRole('checkbox', { name: 'Mă înscriu eu' }))
  await user.type(screen.getByLabelText('Data mea de naștere'), '1990-05-12')
  await user.selectOptions(screen.getByLabelText('Categoria mea'), adultCategory.id)
  await screen.findByText('Preț verificat: 120,00 lei')
  await user.click(screen.getByRole('radio', { name: /Cash, la antrenor/ }))
  await user.click(screen.getByRole('checkbox', { name: /Confirm categoriile/ }))
  await user.click(screen.getByRole('button', { name: 'Finalizează înscrierea' }))
  await waitFor(() =>
    expect(createCompetitionRegistration).toHaveBeenCalledWith({
      competitionId: competition.id,
      selections: [{ selfBirthDate: '1990-05-12', categoryId: adultCategory.id }],
      paymentMethod: 'CASH',
      priceVersions: { self: 'c'.repeat(64) },
      billingDetails: undefined,
    }),
  )
})
