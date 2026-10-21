import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import { ClubApprovalGate } from './ClubApproval'
import { getMyClub, type Club } from '@/api/club'

vi.mock('@/api/club', () => ({ getMyClub: vi.fn() }))

const mockedClub = vi.mocked(getMyClub)

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/club/courses']}>
        <Routes>
          <Route element={<ClubApprovalGate />}>
            <Route path="/club/courses" element={<div>pagina cursuri</div>} />
          </Route>
          <Route path="/club/profile" element={<div>pagina profil</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const club = (approved_at: string | null) =>
  ({ id: 'c1', name: 'Club Nou', approved_at }) as Club

beforeEach(() => vi.clearAllMocks())

test('un club în așteptare vede ecranul de aprobare în locul paginii', async () => {
  mockedClub.mockResolvedValue(club(null))
  renderGate()
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Clubul tău așteaptă aprobarea' }),
  ).toBeInTheDocument()
  expect(screen.getByText(/datele clubului Club Nou/)).toBeInTheDocument()
  expect(screen.queryByText('pagina cursuri')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Completează profilul clubului' })).toHaveAttribute(
    'href',
    '/club/profile',
  )
})

test('un club aprobat vede pagina cerută', async () => {
  mockedClub.mockResolvedValue(club('2026-10-21T10:00:00Z'))
  renderGate()
  expect(await screen.findByText('pagina cursuri')).toBeInTheDocument()
  expect(screen.queryByText('Clubul tău așteaptă aprobarea')).not.toBeInTheDocument()
})

test('o eroare la încărcarea clubului lasă pagina să-și arate propria stare', async () => {
  mockedClub.mockRejectedValue(new Error('offline'))
  renderGate()
  expect(await screen.findByText('pagina cursuri')).toBeInTheDocument()
})
