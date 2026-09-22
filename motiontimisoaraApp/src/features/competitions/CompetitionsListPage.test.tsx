import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CompetitionsListPage from './CompetitionsListPage'
import { getConcursurileMele } from '@/api/competitions'

vi.mock('@/api/competitions', async () => {
  const real = await vi.importActual<typeof import('@/api/competitions')>('@/api/competitions')
  return { ...real, getConcursurileMele: vi.fn(), urlHeroConcurs: () => null }
})

vi.mock('./useCompetitionOwner', () => ({
  useCompetitionOwner: () => ({
    owner: { role: 'CLUB', clubId: 'club-1', coachUserId: null },
    gata: true,
    eroare: false,
    reincearca: vi.fn(),
  }),
}))

const mocked = vi.mocked(getConcursurileMele)

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CompetitionsListPage baza="/club/competitions" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocked.mockReset()
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
})

test('cardul duce la editare', async () => {
  mocked.mockResolvedValue([
    {
      id: 'k1',
      slug: 'cupa',
      title: 'Cupa club',
      description: 'Descriere.',
      hero_photo_storage_path: null,
      club_id: 'club-1',
      coach_id: null,
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
    },
  ])
  deseneaza()
  await waitFor(() =>
    expect(screen.getByRole('link', { name: /Cupa club/ })).toHaveAttribute(
      'href',
      '/club/competitions/k1/edit',
    ),
  )
})

test('eroarea oferă reîncercare', async () => {
  const user = userEvent.setup()
  mocked.mockRejectedValueOnce(new Error('retea')).mockResolvedValueOnce([])
  deseneaza()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(screen.getByText('Niciun concurs încă.')).toBeInTheDocument())
})
