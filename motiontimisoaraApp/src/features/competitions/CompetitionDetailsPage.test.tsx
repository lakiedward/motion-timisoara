import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CompetitionDetailsPage from './CompetitionDetailsPage'
import { getConcursPublic, type PublicCompetition } from '@/api/competition/competitions'

const galleryApi = vi.hoisted(() => ({ offers: vi.fn(), photos: vi.fn(), coaches: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useParams: () => ({ slug: 'cupa' }) }
})

vi.mock('@/api/competition/competitions', async () => {
  const real = await vi.importActual<typeof import('@/api/competition/competitions')>(
    '@/api/competition/competitions',
  )
  return { ...real, getConcursPublic: vi.fn() }
})

vi.mock('@/api/competition/competition-offers', async () => {
  const real = await vi.importActual<typeof import('@/api/competition/competition-offers')>(
    '@/api/competition/competition-offers',
  )
  return { ...real, listCompetitionOffers: galleryApi.offers }
})

vi.mock('@/api/competition/competition-route-photos', () => ({
  listCompetitionRoutePhotos: galleryApi.photos,
}))

vi.mock('@/api/competition/competition-coaches', () => ({
  getPublicCompetitionCoaches: galleryApi.coaches,
}))

vi.mock('./CompetitionRouteMap', () => ({ CompetitionRouteMap: () => <div>Hartă GPX</div> }))

const mocked = vi.mocked(getConcursPublic)

const CONCURS: PublicCompetition = {
  id: 'k1',
  slug: 'cupa',
  title: 'Cupa Timișoara',
  description: 'Linie unu.\nLinie doi.',
  heroUrl: 'https://public/hero.jpg',
  organizator: { fel: 'club', nume: 'Club Audit', link: '/cluburi/c1' },
  startAt: '2026-10-01T07:00:00Z',
  endAt: '2026-10-01T09:00:00Z',
  registrationDeadlineAt: '2026-09-30T21:00:00Z',
  locationText: 'Timișoara',
  allowCash: false,
}

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CompetitionDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocked.mockReset()
  galleryApi.offers.mockReset().mockResolvedValue({ routes: [], categories: [] })
  galleryApi.photos.mockReset().mockResolvedValue([])
  galleryApi.coaches.mockReset().mockResolvedValue([])
})

test('pagina arată titlul, descrierea, organizatorul și poza', async () => {
  mocked.mockResolvedValue(CONCURS)
  deseneaza()
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Cupa Timișoara' })).toBeInTheDocument(),
  )
  expect(screen.getByText(/Linie unu/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Club Audit' })).toHaveAttribute('href', '/cluburi/c1')
  expect(document.querySelector('img[src="https://public/hero.jpg"]')).toBeInTheDocument()
})

test('un slug necunoscut nu arată o eroare de rețea', async () => {
  mocked.mockResolvedValue(null)
  deseneaza()
  await waitFor(() => expect(screen.getByText('Concursul nu a fost găsit.')).toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('eroarea de încărcare se poate reîncerca', async () => {
  const user = userEvent.setup()
  mocked.mockRejectedValueOnce(new Error('retea')).mockResolvedValueOnce(CONCURS)
  deseneaza()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Cupa Timișoara' })).toBeInTheDocument(),
  )
})

test('fiecare traseu își păstrează descrierea și propriile poze', async () => {
  mocked.mockResolvedValue(CONCURS)
  galleryApi.offers.mockResolvedValue({
    routes: [
      {
        id: 'r1',
        competition_id: CONCURS.id,
        name: 'Via Maior',
        description: 'Descriere Via Maior',
        gpx_storage_path: 'via-maior.gpx',
        display_order: 0,
      },
      {
        id: 'r2',
        competition_id: CONCURS.id,
        name: 'Dognecea – Ghiroda Nouă',
        description: 'Descriere Dognecea',
        gpx_storage_path: 'dognecea.gpx',
        display_order: 1,
      },
    ],
    categories: [],
  })
  galleryApi.photos.mockResolvedValue([
    { id: 'p1', route_id: 'r1', url: 'https://example.test/via-maior.jpg' },
    { id: 'p2', route_id: 'r2', url: 'https://example.test/dognecea.jpg' },
  ])

  deseneaza()

  const viaMaior = await screen.findByRole('heading', { name: 'Via Maior' })
  const dognecea = await screen.findByRole('heading', { name: 'Dognecea – Ghiroda Nouă' })
  const viaMaiorCard = viaMaior.closest('article')
  const dogneceaCard = dognecea.closest('article')
  expect(viaMaiorCard).toHaveTextContent('Descriere Via Maior')
  expect(dogneceaCard).toHaveTextContent('Descriere Dognecea')
  await waitFor(() => {
    expect(viaMaiorCard?.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.test/via-maior.jpg',
    )
    expect(dogneceaCard?.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.test/dognecea.jpg',
    )
  })
})
