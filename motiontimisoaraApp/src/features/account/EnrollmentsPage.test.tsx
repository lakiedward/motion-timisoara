import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import { getMyEnrollments, type EnrollmentRow } from '@/api/account'
import EnrollmentsPage from './EnrollmentsPage'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'parent-520' } }),
}))

vi.mock('@/api/account', () => ({
  getMyEnrollments: vi.fn(),
}))

const load = vi.mocked(getMyEnrollments)

function row(partial: Partial<EnrollmentRow> & Pick<EnrollmentRow, 'id' | 'kind'>): EnrollmentRow {
  return {
    entity_id: 'entity',
    status: 'ACTIVE',
    child_id: null,
    adult_profile_id: null,
    created_at: '2026-09-22T00:00:00Z',
    first_session_date: null,
    purchased_sessions: 0,
    remaining_sessions: 0,
    sessions_used: 0,
    child: null,
    payments: [
      {
        amount: 0,
        currency: 'RON',
        pricing_snapshot: null,
        status: 'SUCCEEDED',
        method: 'CASH',
        paid_at: '2026-09-22T00:00:00Z',
      },
    ],
    offerTitle: null,
    offerPath: null,
    offer: null,
    ...partial,
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EnrollmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('the offer name leads the card and keeps the person and amount', async () => {
  load.mockResolvedValue([
    row({
      id: 'adult',
      kind: 'CAMP',
      adult_profile_id: 'parent',
      offerTitle: 'Tabără audit 152',
    }),
    row({
      id: 'child-camp',
      kind: 'CAMP',
      child: { id: 'c1', name: 'Copil Spec 520' },
      offerTitle: 'Tabără audit 152',
    }),
    row({
      id: 'course',
      kind: 'COURSE',
      child: { id: 'c1', name: 'Copil Spec 520' },
      offerTitle: 'Curs de înot',
      purchased_sessions: 8,
      remaining_sessions: 5,
      payments: [
        {
          amount: 31612,
          currency: 'RON',
          pricing_snapshot: {
            sourceUnitAmount: 1234,
            sourceCurrency: 'EUR',
            quantity: 5,
            eurRonRateMicros: 5123456,
          },
          status: 'SUCCEEDED',
          method: 'CASH',
          paid_at: null,
        },
      ],
    }),
    row({
      id: 'activity',
      kind: 'ACTIVITY',
      child: { id: 'c2', name: 'Copil Audit 152' },
      offerTitle: 'Activitate de ciclism',
    }),
  ])
  renderPage()

  const cards = await screen.findAllByRole('article', { name: 'Tabără audit 152' })
  expect(cards).toHaveLength(2)
  const adult = cards[0]!
  expect(within(adult).getByRole('heading', { name: 'Tabără audit 152' })).toBeInTheDocument()
  expect(within(adult).getByText('Tu')).toBeInTheDocument()
  expect(within(adult).getByText('0,00 lei')).toBeInTheDocument()
  expect(within(adult).getByText('Tabără')).toBeInTheDocument()
  expect(
    within(adult)
      .getByRole('heading', { name: 'Tabără audit 152' })
      .compareDocumentPosition(within(adult).getByText('Tu')) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()

  const child = cards[1]!
  expect(within(child).getByText('Copil Spec 520')).toBeInTheDocument()
  expect(within(child).queryByText('Tu')).not.toBeInTheDocument()

  const course = screen.getByRole('article', { name: 'Curs de înot' })
  expect(within(course).getByText('Copil Spec 520')).toBeInTheDocument()
  expect(within(course).getByText('316,12 lei')).toBeInTheDocument()
  expect(within(course).getByText(/1 EUR = 5,123456 lei/)).toBeInTheDocument()
  expect(within(course).getByText('Ședințe: 5 rămase din 8')).toBeInTheDocument()
  expect(
    within(course)
      .getByRole('heading', { name: 'Curs de înot' })
      .compareDocumentPosition(within(course).getByText(/1 EUR = 5,123456 lei/)) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()

  const activity = screen.getByRole('article', { name: 'Activitate de ciclism' })
  expect(within(activity).getByText('Copil Audit 152')).toBeInTheDocument()
  expect(within(activity).getByText('Activitate')).toBeInTheDocument()
})

test('the card links to its offer and shows when the enrollment was made', async () => {
  load.mockResolvedValue([
    row({
      id: 'camp',
      kind: 'CAMP',
      child: { id: 'c1', name: 'Ana' },
      offerTitle: 'Tabăra de vară',
      offerPath: '/tabere/tabara-de-vara',
      created_at: '2026-10-12T09:00:00Z',
    }),
  ])
  renderPage()

  const card = await screen.findByRole('article', { name: 'Tabăra de vară' })
  expect(within(card).getByRole('link', { name: 'Tabăra de vară' })).toHaveAttribute(
    'href',
    '/tabere/tabara-de-vara',
  )
  expect(within(card).getByText('Înscriere din 12 octombrie 2026')).toBeInTheDocument()
})

test('a pending card payment offers to finish the payment instead of an empty session count', async () => {
  load.mockResolvedValue([
    row({
      id: 'pending',
      kind: 'COURSE',
      status: 'PENDING',
      offerTitle: 'Înot',
      offerPath: '/cursuri/c-1',
      payments: [
        {
          amount: 48000,
          currency: 'RON',
          pricing_snapshot: null,
          status: 'PENDING',
          method: 'CARD',
          paid_at: null,
        },
      ],
    }),
  ])
  renderPage()

  const card = await screen.findByRole('article', { name: 'Înot' })
  expect(within(card).getByText('Începe după confirmarea plății')).toBeInTheDocument()
  expect(within(card).queryByText(/rămase din 0/)).not.toBeInTheDocument()
  expect(within(card).getByRole('button', { name: 'Finalizează plata' })).toBeInTheDocument()
})

test('an unknown payment status is not shown as a raw code', async () => {
  load.mockResolvedValue([
    row({
      id: 'odd',
      kind: 'ACTIVITY',
      offerTitle: 'Tură',
      payments: [
        {
          amount: 9000,
          currency: 'RON',
          pricing_snapshot: null,
          status: 'CHARGEBACK' as never,
          method: 'CARD',
          paid_at: null,
        },
      ],
    }),
  ])
  renderPage()

  const card = await screen.findByRole('article', { name: 'Tură' })
  expect(within(card).getByText('Stare plată necunoscută')).toBeInTheDocument()
  expect(within(card).queryByText('CHARGEBACK')).not.toBeInTheDocument()
})

test('a failed request shows an error with retry, not the empty state', async () => {
  load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
  renderPage()

  const alert = await screen.findByRole('alert')
  expect(within(alert).getByText('Nu am putut încărca înscrierile.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio înscriere încă.')).not.toBeInTheDocument()
  await userEvent.click(within(alert).getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Nicio înscriere încă.')).toBeInTheDocument()
})

test('the empty state leads to the course list with a primary button', async () => {
  load.mockResolvedValue([])
  renderPage()

  expect(await screen.findByText('Nicio înscriere încă.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Caută cursuri' })).toHaveAttribute('data-slot', 'button')
})

test('a card without a creation date still renders, without a date line', async () => {
  load.mockResolvedValue([
    row({ id: 'undated', kind: 'CAMP', offerTitle: 'Tabără', created_at: undefined as never }),
  ])
  renderPage()

  const card = await screen.findByRole('article', { name: 'Tabără' })
  expect(within(card).queryByText(/Înscriere din/)).not.toBeInTheDocument()
})

test('a payment to finish comes first and the card shows when the offer happens', async () => {
  load.mockResolvedValue([
    row({ id: 'paid', kind: 'CAMP', offerTitle: 'Tabăra plătită' }),
    row({
      id: 'due',
      kind: 'ACTIVITY',
      status: 'PENDING',
      offerTitle: 'Tura de duminică',
      offer: {
        title: 'Tura de duminică',
        path: '/activitati/a-1',
        imageUrl: null,
        sportCode: 'ciclism',
        sportName: 'Ciclism',
        schedule: { type: 'day', date: '2026-10-25', startTime: '10:00:00', endTime: '12:30:00' },
      },
      payments: [
        {
          amount: 9000,
          currency: 'RON',
          pricing_snapshot: null,
          status: 'FAILED',
          method: 'CARD',
          paid_at: null,
        },
      ],
    }),
  ])
  renderPage()

  await screen.findByRole('article', { name: 'Tura de duminică' })
  const cards = screen.getAllByRole('article')
  expect(within(cards[0]!).getByRole('heading').textContent).toBe('Tura de duminică')
  expect(within(cards[0]!).getByText('Duminică, 25 octombrie, 10:00–12:30')).toBeInTheDocument()
  expect(within(cards[0]!).getByRole('img', { name: /Ilustrație/ })).toBeInTheDocument()
  expect(within(cards[0]!).getByRole('button', { name: 'Finalizează plata' })).toBeInTheDocument()
})

test('a photo that fails to load falls back to the sport illustration', async () => {
  load.mockResolvedValue([
    row({
      id: 'broken',
      kind: 'COURSE',
      offerTitle: 'Curs cu poză lipsă',
      offer: {
        title: 'Curs cu poză lipsă',
        path: '/cursuri/c-9',
        imageUrl: 'https://example.invalid/lipsa.jpg',
        sportCode: 'inot',
        sportName: 'Înot',
        schedule: null,
      },
    }),
  ])
  renderPage()

  const card = await screen.findByRole('article', { name: 'Curs cu poză lipsă' })
  const photo = card.querySelector('img')!
  fireEvent.error(photo)
  expect(await within(card).findByRole('img', { name: /Ilustrație/ })).toBeInTheDocument()
  expect(card.querySelector('img')).toBeNull()
})
