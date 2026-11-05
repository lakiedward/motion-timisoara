import { vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'

import ClubLocationFormPage from '@/features/club/ClubLocationFormPage'
import { createClubLocation, getClubLocationById, getMyClub, updateClubLocation } from '@/api/club'
import { geocoding } from '@/api/geocoding'
import { getLocations, type LocationRow } from '@/api/public'

type MapClick = (e: { latlng: { lat: number; lng: number } }) => void

export const mapClicks: { handler: MapClick | null } = { handler: null }

export const mockedClub = vi.mocked(getMyClub)
export const mockedLocatie = vi.mocked(getClubLocationById)
export const mockedActualizare = vi.mocked(updateClubLocation)
export const mockedCreare = vi.mocked(createClubLocation)
export const mockedCautare = vi.mocked(geocoding.search)
export const mockedNearbyLocations = vi.mocked(getLocations)

export const locatie = {
  id: 'loc-1',
  name: 'Bazin Audit',
  type: 'POOL',
  address: 'Str. Audit 1',
  city: 'Timișoara',
  county: 'Timiș',
  lat: 45.75,
  lng: 21.22,
  description: null,
}

export function renderForm(
  ruta = '/club/locations/loc-1/edit',
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route
            path="/club/locations"
            element={
              <div>
                <p>Lista de locații</p>
                <Link to="/club/locations/new">Adaugă locație</Link>
              </div>
            }
          />
          <Route path="/club/locations/new" element={<ClubLocationFormPage />} />
          <Route path="/club/locations/:id/edit" element={<ClubLocationFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export function resetClubLocationMocks() {
  vi.clearAllMocks()
  mapClicks.handler = null
  mockedClub.mockResolvedValue({ id: 'club-1' } as never)
  mockedLocatie.mockResolvedValue(locatie as never)
  mockedActualizare.mockResolvedValue(locatie as never)
  mockedCreare.mockResolvedValue(undefined as never)
  mockedCautare.mockResolvedValue([])
  mockedNearbyLocations.mockReset().mockResolvedValue([])
  vi.mocked(geocoding.reverse).mockReset().mockResolvedValue(null)
}

export async function clickSave() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
}

export async function pickPoint(lat = 45.75, lng = 21.22) {
  await act(async () => {
    mapClicks.handler?.({ latlng: { lat, lng } })
  })
}

export const nearbySource = {
  ...locatie,
  id: 'source-location',
  name: 'Sala existentă',
  type: 'GYM',
  address: 'Strada sursei 2',
  lat: 45.7502,
  lng: 21.220012345,
  description: 'Detalii ale locului',
  capacity: null,
  is_active: true,
  club_id: 'other-club',
  created_by_user_id: 'other-owner',
  fts: null,
} satisfies LocationRow
