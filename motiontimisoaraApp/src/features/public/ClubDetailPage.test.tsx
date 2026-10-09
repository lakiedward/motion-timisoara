import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import ClubDetailPage from './ClubDetailPage'

const mocks = vi.hoisted(() => ({ getPublicClub: vi.fn() }))
vi.mock('@/api/public', async (original) => ({
  ...(await original<typeof import('@/api/public')>()),
  getPublicClub: mocks.getPublicClub,
}))
vi.mock('./map/ClubLocationMap', () => ({
  default: ({ lat, lng, label }: { lat: number; lng: number; label: string }) => (
    <div
      role="img"
      aria-label={`Hartă cu sediul clubului: ${label}`}
      data-point={`${lat},${lng}`}
    />
  ),
}))

const club = {
  id: 'club-1',
  name: 'Clubul Exemplu',
  description: null,
  logo_storage_path: null,
  hero_photo_storage_path: null,
  website: null,
  phone: null,
  email: null,
  public_email_consent: false,
  address: 'Str. Exemplu 10',
  city: 'Timișoara',
  county: 'Timiș',
  lat: 45.75,
  lng: 21.22,
  club_sports: [],
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/cluburi/club-1']}>
        <Routes>
          <Route path="/cluburi/:id" element={<ClubDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

test('the public page shows the address and a map with a pin when the club has a point', async () => {
  mocks.getPublicClub.mockResolvedValue(club)
  renderPage()
  expect(await screen.findByText('Str. Exemplu 10, Timișoara')).toBeVisible()
  const map = screen.getByRole('img', {
    name: 'Hartă cu sediul clubului: Str. Exemplu 10, Timișoara',
  })
  expect(map).toHaveAttribute('data-point', '45.75,21.22')
})

test('without a point there is no map', async () => {
  mocks.getPublicClub.mockResolvedValue({ ...club, lat: null, lng: null })
  renderPage()
  await screen.findByText('Str. Exemplu 10, Timișoara')
  expect(screen.queryByRole('img', { name: /Hartă cu sediul/ })).toBeNull()
})
