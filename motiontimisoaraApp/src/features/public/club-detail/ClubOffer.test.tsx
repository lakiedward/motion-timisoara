import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import { ClubOffer } from './ClubOffer'

const mocks = vi.hoisted(() => ({
  getClubCourses: vi.fn(),
  getActivitatiPublice: vi.fn(),
  getTaberePublice: vi.fn(),
}))
vi.mock('@/api/public', async (original) => ({
  ...(await original<typeof import('@/api/public')>()),
  getClubCourses: mocks.getClubCourses,
  getActivitatiPublice: mocks.getActivitatiPublice,
}))
vi.mock('@/api/camps', async (original) => ({
  ...(await original<typeof import('@/api/camps')>()),
  getTaberePublice: mocks.getTaberePublice,
}))

function course(id: string, name: string) {
  return {
    id,
    name,
    price: 50000,
    currency: 'RON',
    age_from: 6,
    age_to: 10,
    capacity: null,
    spotsRemaining: null,
    sport: { id: 's', code: 'inot', name: 'Înot', default_photo_storage_path: null },
    coach: null,
    club: { id: 'club-1', name: 'Clubul Exemplu' },
    location: { name: 'Bazin', city: 'Timișoara' },
    occurrences: [],
    course_photos: [],
    hero_photo_storage_path: null,
  }
}

const camp = {
  id: 'camp-1',
  slug: 'tabara-munte',
  title: 'Tabăra de la munte',
  period_start: '2026-12-01',
  period_end: '2026-12-05',
  location_text: null,
  location_id: null,
  location: null,
  price: 100000,
  currency: 'RON',
  pricingMode: 'fixed',
  allow_cash: false,
  heroUrl: null,
  organizator: { fel: 'club', nume: 'Clubul Exemplu', link: '/cluburi/club-1' },
  locuriRamase: null,
}

const activity = {
  id: 'act-1',
  name: 'Ziua porților deschise',
  activityDate: '2026-12-10',
  startTime: '10:00:00',
  endTime: '12:00:00',
  price: 0,
  currency: 'RON',
  locationName: null,
  sportName: 'Înot',
  sportCode: 'inot',
  heroUrl: null,
  organizator: 'Clubul Exemplu',
  locuriRamase: null,
}

function renderOffer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClubOffer clubId="club-1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getClubCourses.mockResolvedValue([course('c1', 'Înot începători')])
  mocks.getTaberePublice.mockResolvedValue([camp])
  mocks.getActivitatiPublice.mockResolvedValue([activity])
})

test('the offer is grouped into courses, camps and activities, each linking to its page', async () => {
  renderOffer()
  const courses = await screen.findByRole('region', { name: /Cursuri/ })
  expect(within(courses).getByRole('link', { name: 'Înot începători' })).toHaveAttribute(
    'href',
    '/cursuri/c1',
  )
  const camps = screen.getByRole('region', { name: /Tabere/ })
  expect(within(camps).getByRole('link', { name: 'Tabăra de la munte' })).toHaveAttribute(
    'href',
    '/tabere/tabara-munte',
  )
  const activities = screen.getByRole('region', { name: /Activități/ })
  expect(within(activities).getByRole('link', { name: /Ziua porților deschise/ })).toHaveAttribute(
    'href',
    '/activitati/act-1',
  )
  expect(mocks.getClubCourses).toHaveBeenCalledWith('club-1')
  expect(mocks.getTaberePublice).toHaveBeenCalledWith(expect.any(Date), 'club-1')
  expect(mocks.getActivitatiPublice).toHaveBeenCalledWith(expect.any(Date), 'club-1')
  expect(screen.queryByLabelText('Caută în oferta clubului')).toBeNull()
})

test('an empty group is hidden', async () => {
  mocks.getTaberePublice.mockResolvedValue([])
  renderOffer()
  await screen.findByRole('region', { name: /Cursuri/ })
  expect(screen.queryByRole('region', { name: /Tabere/ })).toBeNull()
})

test('a long offer gets a search that filters across groups', async () => {
  mocks.getClubCourses.mockResolvedValue(
    ['Înot', 'Atletism', 'Ciclism', 'Tenis', 'Baschet', 'Fotbal'].map((n, i) =>
      course(`c${i}`, `Curs ${n}`),
    ),
  )
  renderOffer()
  const search = await screen.findByLabelText('Caută în oferta clubului')
  fireEvent.change(search, { target: { value: 'munte' } })
  expect(screen.queryByRole('region', { name: /Cursuri/ })).toBeNull()
  expect(screen.getByRole('link', { name: 'Tabăra de la munte' })).toBeVisible()
  fireEvent.change(search, { target: { value: 'xyz' } })
  expect(screen.getByText('Nimic nu se potrivește căutării.')).toBeVisible()
})

test('a club with nothing published says so and points to all courses', async () => {
  mocks.getClubCourses.mockResolvedValue([])
  mocks.getTaberePublice.mockResolvedValue([])
  mocks.getActivitatiPublice.mockResolvedValue([])
  renderOffer()
  expect(
    await screen.findByText('Clubul nu are momentan cursuri, tabere sau activități publicate.'),
  ).toBeVisible()
  expect(screen.getByRole('link', { name: 'Vezi toate cursurile' })).toHaveAttribute(
    'href',
    '/cursuri',
  )
})

test('a load error offers a retry that reloads only the failed list', async () => {
  mocks.getClubCourses.mockRejectedValueOnce(new Error('network'))
  renderOffer()
  expect(await screen.findByText('Nu am putut încărca oferta clubului.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Reîncearcă/ }))
  expect(await screen.findByRole('region', { name: /Cursuri/ })).toBeVisible()
  expect(mocks.getTaberePublice).toHaveBeenCalledTimes(1)
})
