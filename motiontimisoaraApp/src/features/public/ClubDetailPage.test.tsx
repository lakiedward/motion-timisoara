import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import ClubDetailPage from './ClubDetailPage'

const mocks = vi.hoisted(() => ({
  getPublicClub: vi.fn(),
  getClubCourses: vi.fn(),
  getActivitatiPublice: vi.fn(),
  getTaberePublice: vi.fn(),
}))
vi.mock('@/api/public', async (original) => ({
  ...(await original<typeof import('@/api/public')>()),
  getPublicClub: mocks.getPublicClub,
  getClubCourses: mocks.getClubCourses,
  getActivitatiPublice: mocks.getActivitatiPublice,
}))
vi.mock('@/api/camps', async (original) => ({
  ...(await original<typeof import('@/api/camps')>()),
  getTaberePublice: mocks.getTaberePublice,
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
  public_email: null,
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

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getClubCourses.mockResolvedValue([])
  mocks.getActivitatiPublice.mockResolvedValue([])
  mocks.getTaberePublice.mockResolvedValue([])
})

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

test('the public email comes only from the consented public_email column', async () => {
  mocks.getPublicClub.mockResolvedValue({ ...club, public_email: 'contact@club.ro' })
  renderPage()
  expect(await screen.findByRole('link', { name: /contact@club\.ro/ })).toHaveAttribute(
    'href',
    'mailto:contact@club.ro',
  )
})

test('without public_email no email is shown', async () => {
  mocks.getPublicClub.mockResolvedValue(club)
  renderPage()
  await screen.findByText('Str. Exemplu 10, Timișoara')
  expect(screen.queryByRole('link', { name: /@/ })).toBeNull()
})

test('without a cover the hero has the back link, the initial and the name, with no photo band', async () => {
  mocks.getPublicClub.mockResolvedValue(club)
  const { container } = renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Clubul Exemplu' })).toBeVisible()
  expect(screen.getByRole('link', { name: /Înapoi la cluburi/ })).toHaveAttribute('href', '/cluburi')
  expect(screen.getByText('C')).toHaveAttribute('aria-hidden', 'true')
  expect(container.querySelector('img')).toBeNull()
})

test('with a cover the hero uses the shared photo band with the logo next to the name', async () => {
  mocks.getPublicClub.mockResolvedValue({
    ...club,
    logo_storage_path: '/ui/logo.webp',
    hero_photo_storage_path: '/ui/cover.webp',
  })
  const { container } = renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Clubul Exemplu' })).toBeVisible()
  expect(container.querySelector('img[src="/ui/cover.webp"]')).not.toBeNull()
  expect(screen.getByRole('img', { name: 'Logo Clubul Exemplu' })).toHaveAttribute('src', '/ui/logo.webp')
  expect(screen.getByRole('link', { name: /Înapoi la cluburi/ })).toHaveAttribute('href', '/cluburi')
})

test('a load error shows a retry, not "not found"', async () => {
  mocks.getPublicClub.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(club)
  renderPage()
  expect(await screen.findByText('Nu am putut încărca clubul.')).toBeVisible()
  expect(screen.queryByText('Clubul nu a fost găsit.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Clubul Exemplu' })).toBeVisible()
})

test('a missing club says it was not found and links back to the list', async () => {
  mocks.getPublicClub.mockResolvedValue(null)
  renderPage()
  expect(await screen.findByText('Clubul nu a fost găsit.')).toBeVisible()
  expect(screen.getByRole('link', { name: /Înapoi la cluburi/ })).toHaveAttribute('href', '/cluburi')
})
