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
  expect(screen.getByRole('link', { name: /Club Audit/ })).toHaveAttribute('href', '/cluburi/c1')
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

test('antrenorii confirmați sunt carduri cu link spre profil', async () => {
  mocked.mockResolvedValue(CONCURS)
  galleryApi.coaches.mockResolvedValue([
    {
      coachProfileId: 'cp1',
      userId: 'u1',
      name: 'Ana Pop',
      photoUrl: null,
      status: 'accepted',
      respondedAt: null,
    },
    {
      coachProfileId: 'cp2',
      userId: null,
      name: 'Dan Ionescu',
      photoUrl: null,
      status: 'accepted',
      respondedAt: null,
    },
  ])
  deseneaza()
  const profil = await screen.findByRole('link', { name: /Ana Pop/ })
  expect(profil).toHaveAttribute('href', '/antrenori/u1')
  expect(screen.getByText('Dan Ionescu')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Dan Ionescu/ })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Antrenorii concursului' })).toBeVisible()
})

test('antrenorii: stare goală și eroare cu reîncercare', async () => {
  const user = userEvent.setup()
  mocked.mockResolvedValue(CONCURS)
  galleryApi.coaches.mockRejectedValueOnce(new Error('retea')).mockResolvedValueOnce([])
  deseneaza()
  expect(await screen.findByText('Nu am putut încărca antrenorii.')).toBeInTheDocument()
  await user.click(screen.getAllByRole('button', { name: 'Reîncearcă' })[0]!)
  expect(
    await screen.findByText('Nu există încă antrenori confirmați pentru acest concurs.'),
  ).toBeInTheDocument()
})

test('categoriile gratuite arată „Gratuit”, cele cu preț arată lei', async () => {
  mocked.mockResolvedValue(CONCURS)
  galleryApi.offers.mockResolvedValue({
    routes: [
      {
        id: 'r1',
        competition_id: CONCURS.id,
        name: 'Via Maior',
        description: 'D',
        gpx_storage_path: 'v.gpx',
        display_order: 0,
      },
    ],
    categories: [
      { id: 'c1', route_id: 'r1', name: 'Copii', age_from: 6, age_to: 10, price_bani: 12000 },
      { id: 'c2', route_id: 'r1', name: 'Mici', age_from: 3, age_to: 5, price_bani: 0 },
    ],
  })
  deseneaza()
  expect(await screen.findByText(/120,00/)).toBeInTheDocument()
  expect(screen.getByText('Mici').closest('li')).toHaveTextContent('Gratuit')
})

const OFERTE = {
  routes: [
    {
      id: 'r1',
      competition_id: 'k1',
      name: 'Via Maior',
      description: 'D',
      gpx_storage_path: 'v.gpx',
      display_order: 0,
    },
  ],
  categories: [
    { id: 'c1', route_id: 'r1', name: 'Copii', age_from: 6, age_to: 10, price_bani: 12000 },
    { id: 'c2', route_id: 'r1', name: 'Juniori', age_from: 11, age_to: 15, price_bani: 15000 },
  ],
}

test('fiecare categorie are buton de înscriere spre formular, cât timp înscrierile sunt deschise', async () => {
  mocked.mockResolvedValue({ ...CONCURS, registrationDeadlineAt: '2999-01-01T00:00:00Z' })
  galleryApi.offers.mockResolvedValue(OFERTE)
  deseneaza()
  const copii = await screen.findByRole('link', { name: 'Înscrie-te la categoria Copii' })
  expect(copii).toHaveAttribute('href', '/account/competitions/cupa/register?categorie=c1')
  expect(screen.getByRole('link', { name: 'Înscrie-te la categoria Juniori' })).toHaveAttribute(
    'href',
    '/account/competitions/cupa/register?categorie=c2',
  )
})

test('după termenul limită categoriile nu mai au buton de înscriere', async () => {
  mocked.mockResolvedValue(CONCURS)
  galleryApi.offers.mockResolvedValue(OFERTE)
  deseneaza()
  await screen.findByText('Copii')
  expect(screen.queryByRole('link', { name: /Înscrie-te la categoria/ })).not.toBeInTheDocument()
})
