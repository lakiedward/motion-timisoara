import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import CompetitionFormPage from './CompetitionFormPage'
import { createConcurs } from '@/api/competition/competitions'

const owner = { role: 'CLUB' as const, clubId: 'club-1', coachUserId: null }

vi.mock('@/api/competition/competitions', () => ({
  createConcurs: vi.fn(),
  getConcurs: vi.fn(),
  updateConcurs: vi.fn(),
  stergeConcurs: vi.fn(),
  urlHeroConcurs: () => null,
}))

vi.mock('@/api/competition/competition-hero', () => ({
  schimbaPozaConcurs: vi.fn(),
  scoatePozaConcurs: vi.fn(),
}))

vi.mock('@/api/club', () => ({ getClubSelectableLocations: vi.fn().mockResolvedValue([]) }))
vi.mock('@/api/coach', () => ({ getSelectableLocations: vi.fn().mockResolvedValue([]) }))

vi.mock('./useCompetitionOwner', () => ({
  useCompetitionOwner: () => ({
    owner,
    gata: true,
    eroare: false,
    reincearca: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/galerie', () => ({
  galeriaSeDeschideNativ: () => false,
  alegeDinGalerie: vi.fn(),
}))

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/club/competitions/new']}>
        <Routes>
          <Route
            path="/club/competitions/new"
            element={<CompetitionFormPage baza="/club/competitions" />}
          />
          <Route path="/club/competitions" element={<div>lista concursuri</div>} />
          <Route path="/club/competitions/:id/edit" element={<div>editor concurs</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(createConcurs).mockReset()
})

test('titlul și descrierea goale nu pleacă spre server', async () => {
  const user = userEvent.setup()
  deseneaza()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Titlul este obligatoriu.')).toBeInTheDocument()
  expect(screen.getByText('Descrierea este obligatorie.')).toBeInTheDocument()
  expect(createConcurs).not.toHaveBeenCalled()
})

test('un concurs nou se salvează cu proprietarul clubului', async () => {
  const user = userEvent.setup()
  vi.mocked(createConcurs).mockResolvedValue({
    id: 'k1',
    slug: 'cupa',
    title: 'Cupa',
    description: 'Descriere suficientă.',
    hero_photo_storage_path: null,
    club_id: 'club-1',
    coach_id: null,
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
    start_at: '2026-10-01T07:00:00Z',
    end_at: '2026-10-01T09:00:00Z',
    registration_deadline_at: '2026-09-30T21:00:00Z',
    location_id: null,
    location_text: 'Timișoara',
    allow_cash: false,
  })
  deseneaza()
  await user.type(screen.getByLabelText('Titlu'), 'Cupa')
  await user.type(screen.getByLabelText('Descriere'), 'Descriere suficientă.')
  fireEvent.change(screen.getByLabelText('Data de început'), { target: { value: '2026-10-01' } })
  fireEvent.change(screen.getByLabelText('Ora de început'), { target: { value: '10:00' } })
  fireEvent.change(screen.getByLabelText('Data de final'), { target: { value: '2026-10-01' } })
  fireEvent.change(screen.getByLabelText('Ora de final'), { target: { value: '12:00' } })
  fireEvent.change(screen.getByLabelText('Ultima zi de înscriere'), {
    target: { value: '2026-09-30' },
  })
  fireEvent.change(screen.getByLabelText('Ora închiderii înscrierilor'), {
    target: { value: '23:59' },
  })
  await user.type(screen.getByLabelText('Locația concursului'), 'Timișoara')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(createConcurs).toHaveBeenCalledWith(
      {
        title: 'Cupa',
        description: 'Descriere suficientă.',
        start_at: '2026-10-01T07:00:00.000Z',
        end_at: '2026-10-01T09:00:00.000Z',
        registration_deadline_at: '2026-09-30T20:59:00.000Z',
        location_id: null,
        location_text: 'Timișoara',
        allow_cash: false,
      },
      owner,
    ),
  )
  expect(await screen.findByText('editor concurs')).toBeInTheDocument()
})
