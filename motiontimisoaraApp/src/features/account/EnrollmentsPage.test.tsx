import { render, screen, within } from '@testing-library/react'
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
          amount: 15000,
          currency: 'RON',
          pricing_snapshot: null,
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
  expect(within(course).getByText('150,00 lei')).toBeInTheDocument()
  expect(within(course).getByText('Ședințe: 5 rămase din 8')).toBeInTheDocument()

  const activity = screen.getByRole('article', { name: 'Activitate de ciclism' })
  expect(within(activity).getByText('Copil Audit 152')).toBeInTheDocument()
  expect(within(activity).getByText('Activitate')).toBeInTheDocument()
})
