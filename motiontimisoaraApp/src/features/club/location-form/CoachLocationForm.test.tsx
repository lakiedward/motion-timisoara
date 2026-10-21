import { vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import ClubLocationFormPage from '../ClubLocationFormPage'
import { getMyClub } from '@/api/club'
import { createLocation, getCurrentCoachId, getLocationById, updateLocation } from '@/api/coach'
import { geocoding } from '@/api/geocoding'
import { getLocations, type LocationRow } from '@/api/public'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubLocationById: vi.fn(),
  createClubLocation: vi.fn(),
  updateClubLocation: vi.fn(),
}))
vi.mock('@/api/coach', () => ({
  getCurrentCoachId: vi.fn(),
  getLocationById: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))
vi.mock('@/api/geocoding', () => ({ geocoding: { search: vi.fn(), reverse: vi.fn() } }))
vi.mock('@/api/public', () => ({ getLocations: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

let apasaPeHarta: ((e: { latlng: { lat: number; lng: number } }) => void) | null = null
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({ invalidateSize: vi.fn(), setView: vi.fn(), getZoom: () => 13 }),
  useMapEvents: (handlers: { click: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    apasaPeHarta = handlers.click
    return null
  },
}))

const COACH = 'b1e5f0a2-7d3c-4c1e-9a55-2f7d1c0e9b11'

function renderForm(ruta: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/coach/locations" element={<p>Lista antrenor</p>} />
          <Route path="/coach/locations/new" element={<ClubLocationFormPage portal="coach" />} />
          <Route
            path="/coach/locations/:id/edit"
            element={<ClubLocationFormPage portal="coach" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apasaPeHarta = null
  vi.mocked(getCurrentCoachId).mockResolvedValue(COACH)
  vi.mocked(createLocation).mockResolvedValue({} as never)
  vi.mocked(updateLocation).mockResolvedValue({} as never)
  vi.mocked(getLocations).mockResolvedValue([])
  vi.mocked(geocoding.search).mockResolvedValue([])
  vi.mocked(geocoding.reverse).mockResolvedValue(null)
})

test('antrenorul vede formularul comun, fără câmpuri de latitudine și longitudine', async () => {
  renderForm('/coach/locations/new')
  expect(await screen.findByText('Despre locație')).toBeInTheDocument()
  expect(screen.getByText('Unde se află')).toBeInTheDocument()
  expect(screen.queryByLabelText('Latitudine')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Longitudine')).not.toBeInTheDocument()
  expect(getMyClub).not.toHaveBeenCalled()
})

test('fără punct pe hartă locația antrenorului nu se creează', async () => {
  const user = userEvent.setup()
  renderForm('/coach/locations/new')
  await user.type(await screen.findByLabelText(/^Nume/), 'Sala Nouă')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Pune punctul pe hartă')).toBeInTheDocument()
  expect(createLocation).not.toHaveBeenCalled()
})

test('cu punct pe hartă locația se creează pe antrenor și revine la listă', async () => {
  const user = userEvent.setup()
  renderForm('/coach/locations/new')
  await user.type(await screen.findByLabelText(/^Nume/), 'Sala Nouă')
  await waitFor(() => expect(apasaPeHarta).not.toBeNull())
  act(() => apasaPeHarta?.({ latlng: { lat: 45.75, lng: 21.22 } }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(createLocation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sala Nouă', lat: 45.75, lng: 21.22 }),
    ),
  )
  expect(await screen.findByText('Lista antrenor')).toBeInTheDocument()
})

test('locația proprie din apropiere apare ca a antrenorului, cu link spre editarea ei', async () => {
  const proprie = {
    id: 'loc-proprie',
    name: 'Bazinul meu',
    type: 'POOL',
    address: 'Str. Audit 1',
    city: 'Timișoara',
    county: 'Timiș',
    lat: 45.75,
    lng: 21.22,
    club_id: null,
    created_by_user_id: COACH,
    is_active: true,
  } as LocationRow
  vi.mocked(getLocations).mockResolvedValue([proprie])
  renderForm('/coach/locations/new')
  await waitFor(() => expect(apasaPeHarta).not.toBeNull())
  act(() => apasaPeHarta?.({ latlng: { lat: 45.75, lng: 21.22 } }))
  expect(await screen.findByText('Deja în locațiile tale')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editează Bazinul meu' })).toHaveAttribute(
    'href',
    '/coach/locations/loc-proprie/edit',
  )
})

test('editarea unei locații care nu e a antrenorului arată „nu a fost găsită”', async () => {
  vi.mocked(getLocationById).mockResolvedValue(null)
  renderForm('/coach/locations/loc-altcuiva/edit')
  expect(await screen.findByText('Locația nu a fost găsită.')).toBeInTheDocument()
  expect(getLocationById).toHaveBeenCalledWith('loc-altcuiva')
})

test('editarea proprie se salvează cu actualizarea antrenorului', async () => {
  vi.mocked(getLocationById).mockResolvedValue({
    id: 'loc-1',
    name: 'Bazin Audit',
    type: 'POOL',
    address: 'Str. Audit 1',
    city: 'Timișoara',
    county: 'Timiș',
    lat: 45.75,
    lng: 21.22,
    description: null,
    club_id: null,
    created_by_user_id: COACH,
  } as never)
  const user = userEvent.setup()
  renderForm('/coach/locations/loc-1/edit')
  await screen.findByDisplayValue('Bazin Audit')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(updateLocation).toHaveBeenCalledWith('loc-1', expect.any(Object)))
  expect(await screen.findByText('Lista antrenor')).toBeInTheDocument()
})
