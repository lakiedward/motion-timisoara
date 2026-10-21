import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import ClubLocationFormPage from '../ClubLocationFormPage'
import { getClubLocationById, getMyClub } from '@/api/club'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubLocationById: vi.fn(),
  createClubLocation: vi.fn(),
  updateClubLocation: vi.fn(),
}))
vi.mock('@/api/geocoding', () => ({ geocoding: { search: vi.fn(), reverse: vi.fn() } }))
vi.mock('@/api/public', () => ({ getLocations: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('react-leaflet', () => ({
  MapContainer: () => <div data-testid="harta" />,
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({ invalidateSize: vi.fn(), setView: vi.fn(), getZoom: () => 13 }),
  useMapEvents: () => null,
}))

function renderEdit() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/club/locations/loc-1/edit']}>
        <Routes>
          <Route path="/club/locations/:id/edit" element={<ClubLocationFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('while the club is still loading the edit page shows a skeleton, not an empty form', async () => {
  vi.mocked(getMyClub).mockReturnValue(new Promise(() => {}))
  renderEdit()
  expect(await screen.findByRole('status', { name: 'Se încarcă locația' })).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Nume/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Salvează' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Înapoi/ })).toHaveAttribute('href', '/club/locations')
})

test('while the location is loading the edit page shows a skeleton, not an empty form', async () => {
  vi.mocked(getMyClub).mockResolvedValue({ id: 'club-1' } as never)
  vi.mocked(getClubLocationById).mockReturnValue(new Promise(() => {}))
  renderEdit()
  expect(await screen.findByRole('status', { name: 'Se încarcă locația' })).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Nume/)).not.toBeInTheDocument()
})

test('a missing location explains why and keeps the way back to the list', async () => {
  vi.mocked(getMyClub).mockResolvedValue({ id: 'club-1' } as never)
  vi.mocked(getClubLocationById).mockResolvedValue(null)
  renderEdit()
  expect(await screen.findByText('Locația nu a fost găsită.')).toBeInTheDocument()
  expect(
    screen.getByText('Poate a fost ștearsă sau linkul nu mai este valabil.'),
  ).toBeInTheDocument()
  expect(screen.queryByTestId('harta')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Înapoi/ })).toHaveAttribute('href', '/club/locations')
})
