import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CompetitionsListPage from './CompetitionsListPage'
import { getCompetitionList, type CompetitionListItem } from '@/api/competition/competition-list'

vi.mock('@/api/competition/competition-list', () => ({ getCompetitionList: vi.fn() }))

const owner = vi.hoisted(() => ({
  value: { role: 'CLUB', clubId: 'club-1', coachUserId: null } as {
    role: 'CLUB' | 'ADMIN'
    clubId: string | null
    coachUserId: null
  },
}))

vi.mock('./useCompetitionOwner', () => ({
  useCompetitionOwner: () => ({
    owner: owner.value,
    gata: true,
    eroare: false,
    reincearca: vi.fn(),
  }),
}))

const mocked = vi.mocked(getCompetitionList)

function item(over: Partial<CompetitionListItem>): CompetitionListItem {
  return {
    id: 'k1',
    slug: 'cupa',
    title: 'Cupa club',
    description: 'Descriere.',
    hero_photo_storage_path: null,
    club_id: 'club-1',
    coach_id: null,
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
    start_at: '2099-10-01T07:00:00Z',
    end_at: '2099-10-01T09:00:00Z',
    registration_deadline_at: '2099-09-30T21:00:00Z',
    location_id: null,
    location_text: 'Timișoara',
    allow_cash: false,
    organizer: { key: 'club:club-1', kind: 'club', name: 'Club Delfin' },
    prices: [5000],
    routesCount: 1,
    registeredCount: 3,
    ...over,
  }
}

function deseneaza(baza: '/club/competitions' | '/admin/competitions' = '/club/competitions') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CompetitionsListPage baza={baza} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocked.mockReset()
  owner.value = { role: 'CLUB', clubId: 'club-1', coachUserId: null }
})

test('lista goală nu seamănă cu eroarea', async () => {
  mocked.mockResolvedValue([])
  deseneaza()
  await waitFor(() => expect(screen.getByText('Niciun concurs încă.')).toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Concurs nou' })).toHaveAttribute(
    'href',
    '/club/competitions/new',
  )
  expect(screen.getByRole('link', { name: 'Creează primul concurs' })).toHaveAttribute(
    'href',
    '/club/competitions/new',
  )
})

test('rândul arată detaliile și duce la editare', async () => {
  mocked.mockResolvedValue([item({})])
  deseneaza()
  expect(await screen.findByRole('link', { name: 'Editează Cupa club' })).toHaveAttribute(
    'href',
    '/club/competitions/k1/edit',
  )
  expect(screen.getByRole('heading', { name: /Concursuri/ })).toHaveTextContent('(1)')
  expect(screen.getByText('3 înscriși')).toBeInTheDocument()
  expect(screen.getByText('50,00 lei')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Pagina concursului Cupa club' })).toHaveAttribute(
    'href',
    '/concursuri/cupa',
  )
})

test('căutarea și filtrele restrâng lista', async () => {
  const user = userEvent.setup()
  mocked.mockResolvedValue([
    item({}),
    item({
      id: 'k2',
      slug: 'cros',
      title: 'Crosul toamnei',
      start_at: '2020-01-01T08:00:00Z',
      end_at: '2020-01-01T10:00:00Z',
    }),
  ])
  deseneaza()
  await screen.findByText('Cupa club')
  await user.type(screen.getByRole('searchbox', { name: /Caută concursuri/ }), 'cros')
  expect(screen.queryByText('Cupa club')).not.toBeInTheDocument()
  expect(screen.getByText('Crosul toamnei')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Viitoare/ }))
  expect(screen.getByText('Niciun concurs pentru filtrele alese.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Șterge filtrele' }))
  expect(screen.getByText('Cupa club')).toBeInTheDocument()
})

test('adminul vede concursurile grupate pe organizator', async () => {
  owner.value = { role: 'ADMIN', clubId: null, coachUserId: null }
  mocked.mockResolvedValue([
    item({}),
    item({
      id: 'k3',
      title: 'Cupa Anei',
      club_id: null,
      coach_id: 'u1',
      organizer: { key: 'coach:u1', kind: 'coach', name: 'Ana Pop' },
    }),
  ])
  deseneaza('/admin/competitions')
  expect(await screen.findByRole('region', { name: 'Club Delfin' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Ana Pop' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editează Cupa Anei' })).toHaveAttribute(
    'href',
    '/admin/competitions/k3/edit',
  )
})

test('eroarea oferă reîncercare', async () => {
  const user = userEvent.setup()
  mocked.mockRejectedValueOnce(new Error('retea')).mockResolvedValueOnce([])
  deseneaza()
  await user.click(await screen.findByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(screen.getByText('Niciun concurs încă.')).toBeInTheDocument())
})

test('adminul: ierarhie H2 → H3 organizator → H4 concurs și aria-controls spre un panou existent', async () => {
  const user = userEvent.setup()
  owner.value = { role: 'ADMIN', clubId: null, coachUserId: null }
  mocked.mockResolvedValue([
    item({}),
    item({
      id: 'k3',
      title: 'Cupa Anei',
      club_id: null,
      coach_id: 'u1',
      organizer: { key: 'coach:u1', kind: 'coach', name: 'Ana Pop' },
    }),
  ])
  deseneaza('/admin/competitions')
  await screen.findByRole('region', { name: 'Club Delfin' })
  expect(screen.getByRole('heading', { level: 2, name: /Cluburi · 1/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 3, name: /Club Delfin/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 4, name: 'Cupa club' })).toBeInTheDocument()
  const closed = screen.getByRole('button', { name: /Ana Pop/ })
  expect(closed).toHaveAttribute('aria-expanded', 'true')
  await user.click(closed)
  expect(closed).toHaveAttribute('aria-expanded', 'false')
  const panel = document.getElementById(closed.getAttribute('aria-controls') ?? '')
  expect(panel).not.toBeNull()
  expect(panel).not.toBeVisible()
  expect(screen.queryByText('Cupa Anei')).not.toBeInTheDocument()
})

test('contorul „N din M” e o regiune role=status prezentă și înainte de căutare', async () => {
  const user = userEvent.setup()
  owner.value = { role: 'ADMIN', clubId: null, coachUserId: null }
  mocked.mockResolvedValue([
    item({}),
    item({ id: 'k2', title: 'Crosul toamnei', location_text: 'Arad' }),
  ])
  deseneaza('/admin/competitions')
  await screen.findByRole('region', { name: 'Club Delfin' })
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  await user.type(screen.getByRole('searchbox'), 'cros')
  expect(screen.getByRole('status')).toHaveTextContent('1 din 2 concursuri')
})

test('„Fără trasee” și „Fără categorii” sunt evidențiate', async () => {
  mocked.mockResolvedValue([item({ routesCount: 0, prices: [] })])
  deseneaza()
  const routes = (await screen.findByText('Fără trasee')).closest('li')
  const categories = screen.getByText('Fără categorii').closest('li')
  expect(routes).toHaveClass('text-highlight-ink')
  expect(categories).toHaveClass('text-highlight-ink')
})
