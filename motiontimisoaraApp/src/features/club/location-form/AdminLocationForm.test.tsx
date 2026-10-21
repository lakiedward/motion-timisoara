import { vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import ClubLocationFormPage from '../ClubLocationFormPage'
import { getMyClub, updateClubLocation } from '@/api/club'
import { getAllClubs, getCoachesForSelect } from '@/api/admin'
import { createAdminLocation, getLocationAdmin } from '@/api/locations/admin-locations'
import { geocoding } from '@/api/geocoding'
import { getLocations } from '@/api/public'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubLocationById: vi.fn(),
  createClubLocation: vi.fn(),
  updateClubLocation: vi.fn(),
}))
vi.mock('@/api/admin', () => ({ getAllClubs: vi.fn(), getCoachesForSelect: vi.fn() }))
vi.mock('@/api/locations/admin-locations', () => ({
  createAdminLocation: vi.fn(),
  getLocationAdmin: vi.fn(),
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

const CLUB = 'c0a80101-0000-4000-8000-000000000001'
const COACH = 'b1e5f0a2-7d3c-4c1e-9a55-2f7d1c0e9b11'

function renderForm(ruta: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin/locations" element={<p>Lista admin</p>} />
          <Route path="/admin/locations/new" element={<ClubLocationFormPage portal="admin" />} />
          <Route
            path="/admin/locations/:id/edit"
            element={<ClubLocationFormPage portal="admin" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apasaPeHarta = null
  vi.mocked(getAllClubs).mockResolvedValue([
    { id: CLUB, name: 'Club Audit Motion', city: 'Timișoara', email: null, approved_at: '2026-09-01T00:00:00Z' },
  ])
  vi.mocked(getCoachesForSelect).mockResolvedValue([{ user_id: COACH, name: 'Ana Rusu' }])
  vi.mocked(createAdminLocation).mockResolvedValue(undefined)
  vi.mocked(getLocations).mockResolvedValue([])
  vi.mocked(geocoding.search).mockResolvedValue([])
  vi.mocked(geocoding.reverse).mockResolvedValue(null)
})

async function completeaza(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Nume'), 'Sala Nouă')
  await waitFor(() => expect(apasaPeHarta).not.toBeNull())
  act(() => apasaPeHarta?.({ latlng: { lat: 45.75, lng: 21.22 } }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled())
}

test('adminul nu citește „clubul meu” și trebuie să aleagă organizatorul', async () => {
  const user = userEvent.setup()
  renderForm('/admin/locations/new')
  await completeaza(user)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Alege organizatorul')).toBeInTheDocument()
  expect(createAdminLocation).not.toHaveBeenCalled()
  expect(getMyClub).not.toHaveBeenCalled()
})

test('locația nouă se salvează pe clubul sau antrenorul ales și revine la lista admin', async () => {
  const user = userEvent.setup()
  renderForm('/admin/locations/new')
  await screen.findByRole('option', { name: 'Ana Rusu' })
  await user.selectOptions(screen.getByLabelText('Organizator'), `coach:${COACH}`)
  await completeaza(user)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(createAdminLocation).toHaveBeenCalledWith(
      { kind: 'coach', id: COACH },
      expect.objectContaining({ name: 'Sala Nouă', lat: 45.75, lng: 21.22 }),
    ),
  )
  expect(await screen.findByText('Lista admin')).toBeInTheDocument()
})

test('la editare organizatorul e blocat și se vede numele lui', async () => {
  vi.mocked(getLocationAdmin).mockResolvedValue({
    id: 'loc-1',
    name: 'Bazin Audit',
    type: 'POOL',
    address: 'Str. Audit 1',
    city: 'Timișoara',
    county: 'Timiș',
    lat: 45.75,
    lng: 21.22,
    club_id: CLUB,
    created_by_user_id: null,
    club: { id: CLUB, name: 'Club Audit Motion' },
    creator: null,
  } as never)
  vi.mocked(updateClubLocation).mockResolvedValue({} as never)
  const user = userEvent.setup()
  renderForm('/admin/locations/loc-1/edit')
  await screen.findByDisplayValue('Bazin Audit')
  const owner = screen.getByLabelText('Organizator')
  expect(owner).toBeDisabled()
  expect(owner).toHaveDisplayValue('Club Audit Motion')
  expect(screen.getByText('Organizatorul rămâne cel de la creare.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(updateClubLocation).toHaveBeenCalledWith('loc-1', expect.any(Object)))
  expect(await screen.findByText('Lista admin')).toBeInTheDocument()
})
