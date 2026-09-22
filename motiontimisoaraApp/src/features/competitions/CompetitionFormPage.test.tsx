import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import CompetitionFormPage from './CompetitionFormPage'
import { createConcurs } from '@/api/competitions'

const owner = { role: 'CLUB' as const, clubId: 'club-1', coachUserId: null }

vi.mock('@/api/competitions', () => ({
  createConcurs: vi.fn(),
  getConcurs: vi.fn(),
  updateConcurs: vi.fn(),
  stergeConcurs: vi.fn(),
  urlHeroConcurs: () => null,
}))

vi.mock('@/api/competition-hero', () => ({
  schimbaPozaConcurs: vi.fn(),
  scoatePozaConcurs: vi.fn(),
}))

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
  })
  deseneaza()
  await user.type(screen.getByLabelText('Titlu'), 'Cupa')
  await user.type(screen.getByLabelText('Descriere'), 'Descriere suficientă.')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(createConcurs).toHaveBeenCalledWith(
      { title: 'Cupa', description: 'Descriere suficientă.' },
      owner,
    ),
  )
  expect(await screen.findByText('lista concursuri')).toBeInTheDocument()
})
