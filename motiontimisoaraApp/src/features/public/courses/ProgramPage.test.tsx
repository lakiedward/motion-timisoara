import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { vi } from 'vitest'

import { getCourseCatalog, type CourseCatalogItem } from '@/api/public'
import ProgramPage from '../ProgramPage'

vi.mock('@/api/public', () => ({
  getCourseCatalog: vi.fn(),
  courseHeroUrl: (course: { id: string }) => (course.id === 'swim' ? '/swim.webp' : null),
}))

const catalogRequest = vi.mocked(getCourseCatalog)

function course(overrides: Partial<CourseCatalogItem>): CourseCatalogItem {
  return {
    id: 'swim',
    name: 'Înot începători',
    price: 48_000,
    currency: 'RON',
    eur_ron_rate_micros: null,
    age_from: 6,
    age_to: 10,
    capacity: 12,
    recurrence_rule: JSON.stringify({ daySchedules: { '1': { start: '17:00', end: '18:00' } } }),
    occurrences: [],
    course_photos: [],
    sport: { id: 's1', code: 'inot', name: 'Înot', default_photo_storage_path: null },
    location: { name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
    coach: { id: 'c1', name: 'Coach Test', avatar_url: null },
    club: null,
    spotsRemaining: 11,
    ...overrides,
  } as CourseCatalogItem
}

function CurrentSearch() {
  return <output data-testid="search">{useLocation().search}</output>
}

function renderPage(url = '/cursuri') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <ProgramPage />
        <CurrentSearch />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  catalogRequest.mockReset()
})

test('each card links as a whole and shows schedule, spots, organizer and price', async () => {
  catalogRequest.mockResolvedValue([
    course({}),
    course({
      id: 'bike',
      name: 'Ciclism juniori',
      sport: { id: 's2', code: 'ciclism', name: 'Ciclism', default_photo_storage_path: null },
      club: { id: 'k1', name: 'Club Velo' },
      spotsRemaining: 0,
      recurrence_rule: null,
    }),
  ])
  renderPage()

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cursuri')
  const swimLink = await screen.findByRole('link', { name: 'Înot începători' })
  expect(swimLink).toHaveAttribute('href', '/cursuri/swim')
  const swimCard = swimLink.closest('article')!
  expect(within(swimCard).getByText('Lu · 17:00')).toBeInTheDocument()
  expect(within(swimCard).getByText('11 locuri rămase')).toBeInTheDocument()
  expect(within(swimCard).getByText('Coach Test')).toBeInTheDocument()
  expect(within(swimCard).getByText('Timișoara · 6–10 ani')).toBeInTheDocument()

  const bikeCard = screen.getByRole('link', { name: 'Ciclism juniori' }).closest('article')!
  expect(within(bikeCard).getByText('Curs plin')).toBeInTheDocument()
  expect(within(bikeCard).getByText('Club Velo')).toBeInTheDocument()
  expect(within(bikeCard).getByText('Programul se anunță în curând')).toBeInTheDocument()
})

test('a photo that fails to load falls back to the sport illustration', async () => {
  catalogRequest.mockResolvedValue([course({})])
  renderPage()
  const card = (await screen.findByRole('link', { name: 'Înot începători' })).closest('article')!
  fireEvent.error(card.querySelector('img')!)
  expect(card.querySelector('img')).toBeNull()
  expect(card.querySelector('[data-sport-illustration="inot"]')).not.toBeNull()
})

test('filters narrow the list and the empty result offers a reset', async () => {
  catalogRequest.mockResolvedValue([
    course({}),
    course({
      id: 'run',
      name: 'Alergare',
      price: 16_000,
      sport: { id: 's3', code: 'alergare', name: 'Alergare', default_photo_storage_path: null },
      location: { name: 'Parc', city: 'Timișoara' } as CourseCatalogItem['location'],
      recurrence_rule: null,
    }),
  ])
  renderPage()
  await screen.findByRole('link', { name: 'Înot începători' })

  fireEvent.change(screen.getByLabelText('Buget pe lună'), { target: { value: '20000' } })
  expect(screen.queryByRole('link', { name: 'Înot începători' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Alergare' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Luni' }))
  expect(screen.getByRole('button', { name: 'Luni' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Niciun curs nu corespunde filtrelor.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Resetează filtrele' }))
  expect(screen.getAllByRole('article')).toHaveLength(2)

  fireEvent.change(screen.getByLabelText('Unde?'), { target: { value: 'Parc' } })
  expect(screen.getAllByRole('article')).toHaveLength(1)
})

test('sport chips toggle and each active filter can be removed on its own', async () => {
  catalogRequest.mockResolvedValue([
    course({}),
    course({
      id: 'run',
      name: 'Alergare',
      sport: { id: 's3', code: 'alergare', name: 'Alergare', default_photo_storage_path: null },
    }),
  ])
  renderPage()
  await screen.findByRole('link', { name: 'Înot începători' })

  const swim = screen.getByRole('button', { name: 'Înot' })
  fireEvent.click(swim)
  expect(swim).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getAllByRole('article')).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('Buget pe lună'), { target: { value: '60000' } })

  fireEvent.click(screen.getByRole('button', { name: 'Scoate filtrul Înot' }))
  expect(screen.getAllByRole('article')).toHaveLength(2)
  expect(screen.getByRole('button', { name: /Scoate filtrul Până la 600 lei/ })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Șterge tot' }))
  expect(screen.queryByText('Filtre active:')).toBeNull()
  expect(screen.getByRole('button', { name: 'Toate' })).toHaveAttribute('aria-pressed', 'true')
})

test('a failed request shows an error with retry, not the empty state', async () => {
  catalogRequest.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([course({})])
  renderPage()
  expect(await screen.findByText('Nu am putut încărca cursurile.')).toBeInTheDocument()
  expect(screen.queryByText(/Niciun curs/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('link', { name: 'Înot începători' })).toBeInTheDocument()
})

test('long lists show twelve courses and load more on request', async () => {
  catalogRequest.mockResolvedValue(
    Array.from({ length: 30 }, (_, index) => course({ id: `c${index}`, name: `Curs ${index}` })),
  )
  renderPage()
  await screen.findByRole('link', { name: 'Curs 0' })
  expect(screen.getAllByRole('article')).toHaveLength(12)
  fireEvent.click(screen.getByRole('button', { name: 'Încarcă mai multe' }))
  expect(screen.getAllByRole('article')).toHaveLength(24)
})

test('the chosen sport is kept in the address and restored from it', async () => {
  catalogRequest.mockResolvedValue([
    course({}),
    course({
      id: 'run',
      name: 'Alergare',
      sport: { id: 's3', code: 'alergare', name: 'Alergare', default_photo_storage_path: null },
    }),
  ])
  renderPage()
  await screen.findByRole('link', { name: 'Înot începători' })

  fireEvent.click(screen.getByRole('button', { name: 'Alergare' }))
  expect(screen.getByTestId('search')).toHaveTextContent('?sport=alergare')
  fireEvent.change(screen.getByLabelText('Buget pe lună'), { target: { value: '60000' } })
  expect(screen.getByTestId('search')).toHaveTextContent('?sport=alergare')
  fireEvent.click(screen.getByRole('button', { name: 'Toate' }))
  expect(screen.getByTestId('search')).toBeEmptyDOMElement()
})

test('opening a link with a sport selects that sport', async () => {
  catalogRequest.mockResolvedValue([
    course({}),
    course({
      id: 'run',
      name: 'Alergare',
      sport: { id: 's3', code: 'alergare', name: 'Alergare', default_photo_storage_path: null },
    }),
  ])
  renderPage('/cursuri?sport=inot')
  await screen.findByRole('link', { name: 'Înot începători' })
  expect(screen.getByRole('button', { name: 'Înot' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Toate' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getAllByRole('article')).toHaveLength(1)
})

test('while loading, the list shows card-shaped placeholders in the same grid as the cards', () => {
  catalogRequest.mockReturnValue(new Promise(() => {}))
  renderPage()

  const loading = screen.getByRole('status', { name: 'Se încarcă cursurile' })
  expect(within(loading).getByRole('list').className).toContain('lg:grid-cols-3')
  const placeholders = within(loading).getAllByRole('listitem')
  expect(placeholders).toHaveLength(3)
  for (const placeholder of placeholders) {
    expect(placeholder.querySelector('.aspect-video')).not.toBeNull()
    expect(placeholder.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(5)
  }
})
