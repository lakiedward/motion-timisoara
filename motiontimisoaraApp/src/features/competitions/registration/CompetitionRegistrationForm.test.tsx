import { vi } from 'vitest'
import { toast } from 'sonner'
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
import type { CompetitionCategory, CompetitionRoute } from '@/api/competition/competition-offers'

const authRole = vi.hoisted(() => ({ value: 'PARENT' }))

vi.mock('@/api/account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/account')>()),
  getMyChildren: vi.fn(),
}))
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

const route: CompetitionRoute = {
  id: 'route-1',
  competition_id: competition.id,
  name: 'Traseu scurt',
  description: 'Descriere',
  gpx_storage_path: null,
  display_order: 0,
  created_at: '2026-09-22T00:00:00Z',
  updated_at: '2026-09-22T00:00:00Z',
}

function renderRegistration(availableCategories = [category], query = '', routes = [route]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/account/competitions/cupa/register${query}`]}>
        <Routes>
          <Route
            path="/account/competitions/:slug/register"
            element={
              <CompetitionRegistrationForm
                competition={competition}
                categories={availableCategories}
                routes={routes}
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

async function pickCategory(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  category: CompetitionCategory,
) {
  await user.click(trigger)
  await user.click(
    await screen.findByRole('menuitemradio', { name: new RegExp(`^${category.name} ·`) }),
  )
}

async function goNext(user: ReturnType<typeof userEvent.setup>) {
  const button = screen.getByRole('button', { name: /Continuă/ })
  await waitFor(() => expect(button).toBeEnabled())
  await user.click(button)
}

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
  await pickCategory(user, await screen.findByLabelText('Copil Audit'), category)
  expect(await screen.findByText('Preț verificat: Gratuit')).toBeInTheDocument()
  await goNext(user)
  expect(screen.getByRole('heading', { name: 'Verifică suma' })).toBeInTheDocument()
  expect(screen.queryByText('Sumar comandă')).not.toBeInTheDocument()
  expect(screen.getAllByText('Total')).toHaveLength(1)
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

test('pașii sunt ca la curs, iar butonul dezactivat spune ce lipsește', async () => {
  renderRegistration()
  await screen.findByLabelText('Copil Audit')
  expect(screen.getByRole('list', { name: 'Pașii înscrierii' })).toHaveTextContent(
    /Participanți.*Detalii.*Facturare.*Plată/,
  )
  expect(screen.getByRole('heading', { name: 'Cine participă?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Continuă/ })).toBeDisabled()
  expect(screen.getByText('Alege cel puțin un participant ca să continui.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Înapoi' })).not.toBeInTheDocument()
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
  await pickCategory(user, await screen.findByLabelText('Copil Audit'), category)
  expect(await screen.findByRole('alert')).toHaveTextContent('Vârsta la data înscrierii')
  expect(screen.getByRole('button', { name: /Continuă/ })).toBeDisabled()
  expect(
    await screen.findByText(
      'Alege o categorie potrivită pentru fiecare participant ca să continui.',
    ),
  ).toBeInTheDocument()
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
  await pickCategory(user, screen.getByLabelText('Categoria mea'), adultCategory)
  await waitFor(() =>
    expect(validateCompetitionRegistration).toHaveBeenCalledWith(competition.id, [
      { selfBirthDate: '1990-05-12', categoryId: adultCategory.id },
    ]),
  )
  expect(await screen.findByText('Preț verificat: Gratuit')).toBeInTheDocument()
  await goNext(user)
  expect(screen.getByRole('heading', { name: 'Verifică suma' })).toBeInTheDocument()
  expect(screen.queryByText('Sumar comandă')).not.toBeInTheDocument()
  expect(screen.getAllByText('Total')).toHaveLength(1)
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
  await pickCategory(user, screen.getByLabelText('Categoria mea'), adultCategory)
  await screen.findByText('Preț verificat: Gratuit')
  await goNext(user)
  await user.click(screen.getByRole('checkbox', { name: /Confirm categoriile/ }))
  expect(screen.getByRole('button', { name: 'Confirmă înscrierea gratuită' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Înapoi' }))
  const changedBirthDate = screen.getByLabelText('Data mea de naștere')
  await user.clear(changedBirthDate)
  await user.type(changedBirthDate, '1991-05-12')
  await waitFor(() =>
    expect(validateCompetitionRegistration).toHaveBeenCalledWith(competition.id, [
      { selfBirthDate: '1991-05-12', categoryId: adultCategory.id },
    ]),
  )
  await goNext(user)
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
  await pickCategory(user, screen.getByLabelText('Categoria mea'), adultCategory)
  await screen.findByText('Preț verificat: 120,00 lei')
  await goNext(user)
  await user.click(screen.getByRole('checkbox', { name: /Confirm categoriile/ }))
  await goNext(user)
  expect(
    screen.getByText('Completează toate datele de facturare ca să continui.'),
  ).toBeInTheDocument()
  await user.type(screen.getByLabelText('Adresă'), 'Strada Test 1')
  await user.type(screen.getByLabelText('Oraș'), 'Timișoara')
  await user.type(screen.getByLabelText('Cod poștal'), '300001')
  await goNext(user)
  expect(screen.getByText('Sumar comandă')).toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: /Cash, la antrenor/ }))
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

test('?categorie= preselectează categoria pentru primul copil, fără să o forțeze', async () => {
  const user = userEvent.setup()
  const other = { ...category, id: 'category-2', name: '11–13 ani', age_from: 11, age_to: 13 }
  vi.mocked(validateCompetitionRegistration).mockResolvedValue({
    results: [
      {
        participantKey: 'child-1',
        childId: 'child-1',
        categoryId: other.id,
        routeId: other.route_id,
        name: 'Copil Audit',
        eligible: true,
        amount: 0,
        currency: 'RON',
        priceVersion: 'b'.repeat(64),
      },
    ],
    allowCash: false,
  })
  renderRegistration([category, other], '?categorie=category-2')
  const trigger = await screen.findByLabelText('Copil Audit')
  await waitFor(() => expect(trigger).toHaveTextContent('11–13 ani'))
  expect(validateCompetitionRegistration).toHaveBeenCalledWith('competition-1', [
    { childId: 'child-1', categoryId: 'category-2' },
  ])
  await pickCategory(user, trigger, category)
  await waitFor(() => expect(trigger).toHaveTextContent('8–10 ani'))
})

test('?categorie= necunoscută nu preselectează nimic', async () => {
  renderRegistration([category], '?categorie=nu-exista')
  const trigger = await screen.findByLabelText('Copil Audit')
  expect(trigger).toHaveTextContent('Nu înscrie acest copil')
  expect(validateCompetitionRegistration).not.toHaveBeenCalled()
})

test('termen depășit și lipsa categoriilor au stări proprii', async () => {
  const closed = { ...competition, registrationDeadlineAt: '2000-01-01T00:00:00Z' }
  const { unmount } = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CompetitionRegistrationForm
          competition={closed}
          categories={[category]}
          routes={[route]}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(await screen.findByText('Termenul înscrierilor a trecut.')).toBeInTheDocument()
  unmount()
  renderRegistration([])
  expect(
    await screen.findByText('Organizatorul nu a adăugat încă nicio categorie.'),
  ).toBeInTheDocument()
})

test('părintele fără copii vede „Adaugă copil”, iar eroarea listei are reîncercare', async () => {
  vi.mocked(getMyChildren).mockResolvedValueOnce([] as never)
  const { unmount } = renderRegistration()
  expect(
    await screen.findByText('Nu ai copii adăugați. Te poți înscrie pe tine mai jos.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Adaugă copil' })).toBeInTheDocument()
  unmount()
  vi.mocked(getMyChildren).mockRejectedValueOnce(new Error('x'))
  renderRegistration()
  expect(await screen.findByText('Nu am putut încărca lista de copii.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('prețul schimbat între confirmare și trimitere refuză înscrierea cu mesaj', async () => {
  const user = userEvent.setup()
  const result = {
    participantKey: 'child-1',
    childId: 'child-1',
    categoryId: category.id,
    routeId: category.route_id,
    name: 'Copil Audit',
    eligible: true,
    amount: 0,
    currency: 'RON' as const,
  }
  vi.mocked(validateCompetitionRegistration)
    .mockResolvedValueOnce({
      results: [{ ...result, priceVersion: 'a'.repeat(64) }],
      allowCash: false,
    })
    .mockResolvedValue({
      results: [{ ...result, priceVersion: 'b'.repeat(64) }],
      allowCash: false,
    })
  renderRegistration()
  await pickCategory(user, await screen.findByLabelText('Copil Audit'), category)
  expect(await screen.findByText('Preț verificat: Gratuit')).toBeInTheDocument()
  await goNext(user)
  expect(screen.getByRole('heading', { name: 'Verifică suma' })).toBeInTheDocument()
  expect(screen.queryByText('Sumar comandă')).not.toBeInTheDocument()
  expect(screen.getAllByText('Total')).toHaveLength(1)
  await user.click(screen.getByRole('checkbox', { name: /Confirm categoriile/ }))
  await user.click(screen.getByRole('button', { name: 'Confirmă înscrierea gratuită' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'Categoria sau prețul s-a schimbat. Confirmă noua ofertă.',
    ),
  )
  expect(createCompetitionRegistration).not.toHaveBeenCalled()
})

test('aceeași vârstă pe două trasee: meniul arată traseul și trimite categoria aleasă', async () => {
  const user = userEvent.setup()
  const longRoute = { ...route, id: 'route-2', name: 'Traseu lung', display_order: 1 }
  const longCategory = {
    ...category,
    id: 'category-long',
    route_id: longRoute.id,
    price_bani: 8000,
  }
  vi.mocked(validateCompetitionRegistration).mockResolvedValue({
    results: [
      {
        participantKey: 'child-1',
        childId: 'child-1',
        categoryId: longCategory.id,
        routeId: longRoute.id,
        name: 'Copil Audit',
        eligible: true,
        amount: 8000,
        currency: 'RON',
        priceVersion: 'd'.repeat(64),
      },
    ],
    allowCash: false,
  })
  renderRegistration([category, longCategory], '', [route, longRoute])
  const trigger = await screen.findByLabelText('Copil Audit')
  await user.click(trigger)
  expect(
    await screen.findByRole('menuitemradio', {
      name: /^Traseu scurt · 8–10 ani · 8–10 ani · Gratuit/,
    }),
  ).toBeInTheDocument()
  await user.click(
    await screen.findByRole('menuitemradio', {
      name: /^Traseu lung · 8–10 ani · 8–10 ani · 80,00 lei/,
    }),
  )
  await waitFor(() =>
    expect(validateCompetitionRegistration).toHaveBeenCalledWith('competition-1', [
      { childId: 'child-1', categoryId: 'category-long' },
    ]),
  )
})
