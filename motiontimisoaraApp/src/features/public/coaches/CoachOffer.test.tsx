import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import type { CourseCatalogItem } from '@/api/public'
import { CoachOffer } from './CoachOffer'

const mocks = vi.hoisted(() => ({
  getCoachCourses: vi.fn(),
  getActivitatiPublice: vi.fn(),
  getTaberePublice: vi.fn(),
}))
vi.mock('@/api/public', async (original) => ({
  ...(await original<typeof import('@/api/public')>()),
  getCoachCourses: mocks.getCoachCourses,
  getActivitatiPublice: mocks.getActivitatiPublice,
}))
vi.mock('@/api/camps', async (original) => ({
  ...(await original<typeof import('@/api/camps')>()),
  getTaberePublice: mocks.getTaberePublice,
}))

function course(id: string, name: string, overrides: Partial<CourseCatalogItem> = {}) {
  return {
    id,
    name,
    price: 48_000,
    currency: 'RON',
    eur_ron_rate_micros: null,
    age_from: 6,
    age_to: 10,
    capacity: 12,
    recurrence_rule: null,
    occurrences: [],
    course_photos: [],
    hero_photo_storage_path: null,
    sport: { id: 's1', code: 'inot', name: 'Înot', default_photo_storage_path: null },
    location: { name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
    coach: { id: 'c1', name: 'Coach Test', avatar_url: null },
    club: null,
    spotsRemaining: 11,
    ...overrides,
  } as CourseCatalogItem
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
  organizator: 'Coach Test',
  locuriRamase: null,
}

function renderOffer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CoachOffer coachId="c1" coachProfileId="p1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getCoachCourses.mockResolvedValue([course('swim', 'Înot începători')])
  mocks.getTaberePublice.mockResolvedValue([camp])
  mocks.getActivitatiPublice.mockResolvedValue([activity])
})

test('courses, camps and activities are grouped, each with the shared card and its link', async () => {
  renderOffer()
  const courses = await screen.findByRole('region', { name: /^Cursuri\s*\d+$/ })
  const swim = within(courses).getByRole('link', { name: 'Înot începători' })
  expect(swim).toHaveAttribute('href', '/cursuri/swim')
  expect(within(swim.closest('article') as HTMLElement).getByText('11 locuri rămase')).toBeVisible()
  const camps = screen.getByRole('region', { name: /^Tabere\s*\d+$/ })
  expect(within(camps).getByRole('link', { name: 'Tabăra de la munte' })).toHaveAttribute(
    'href',
    '/tabere/tabara-munte',
  )
  const activities = screen.getByRole('region', { name: /^Activități\s*\d+$/ })
  expect(within(activities).getByRole('link', { name: /Ziua porților deschise/ })).toHaveAttribute(
    'href',
    '/activitati/act-1',
  )
  expect(mocks.getCoachCourses).toHaveBeenCalledWith('c1')
  expect(mocks.getTaberePublice).toHaveBeenCalledWith(expect.any(Date), undefined, {
    userId: 'c1',
    profileId: 'p1',
  })
  expect(mocks.getActivitatiPublice).toHaveBeenCalledWith(expect.any(Date), undefined, 'c1')
  expect(screen.queryByLabelText('Caută la acest antrenor')).toBeNull()
})

test('an empty group is hidden', async () => {
  mocks.getActivitatiPublice.mockResolvedValue([])
  renderOffer()
  await screen.findByRole('region', { name: /^Tabere\s*\d+$/ })
  expect(screen.queryByRole('region', { name: /^Activități\s*\d+$/ })).toBeNull()
})

test('a long offer gets a search that filters across groups', async () => {
  mocks.getCoachCourses.mockResolvedValue(
    ['Înot', 'Atletism', 'Ciclism', 'Tenis', 'Baschet', 'Fotbal'].map((n, i) =>
      course(`c${i}`, `Curs ${n}`),
    ),
  )
  renderOffer()
  const search = await screen.findByLabelText('Caută la acest antrenor')
  fireEvent.change(search, { target: { value: 'munte' } })
  expect(screen.queryByRole('region', { name: /^Cursuri\s*\d+$/ })).toBeNull()
  expect(screen.getByRole('link', { name: 'Tabăra de la munte' })).toBeVisible()
  fireEvent.change(search, { target: { value: 'xyz' } })
  expect(screen.getByText('Nimic nu se potrivește căutării.')).toBeVisible()
})

test('a coach with nothing published keeps the section with an empty state', async () => {
  mocks.getCoachCourses.mockResolvedValue([])
  mocks.getTaberePublice.mockResolvedValue([])
  mocks.getActivitatiPublice.mockResolvedValue([])
  renderOffer()
  expect(
    await screen.findByText('Momentan nu are cursuri, tabere sau activități publicate.'),
  ).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Cursuri, tabere și activități' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Vezi toate cursurile' })).toHaveAttribute(
    'href',
    '/cursuri',
  )
})

test('shows skeletons while loading', () => {
  mocks.getCoachCourses.mockReturnValue(new Promise(() => {}))
  renderOffer()
  expect(screen.getByRole('status', { name: 'Se încarcă oferta antrenorului' })).toBeVisible()
})

test('a failed request shows an error with retry instead of hiding the section', async () => {
  mocks.getTaberePublice.mockRejectedValueOnce(new Error('down')).mockResolvedValue([camp])
  renderOffer()
  expect(await screen.findByText('Nu am putut încărca oferta antrenorului.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('link', { name: 'Tabăra de la munte' })).toBeVisible()
})
