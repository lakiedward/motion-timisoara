import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { getCoachCourses, type CourseCatalogItem } from '@/api/public'
import { CoachCourses } from './CoachCourses'

vi.mock('@/api/public', () => ({
  getCoachCourses: vi.fn(),
  courseHeroUrl: () => null,
}))

const coachCourses = vi.mocked(getCoachCourses)

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

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CoachCourses coachId="c1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  coachCourses.mockReset()
})

test('lists the coach courses with the catalog card', async () => {
  coachCourses.mockResolvedValue([course({}), course({ id: 'bike', name: 'Ciclism juniori', spotsRemaining: 0 })])
  renderSection()

  const swim = await screen.findByRole('link', { name: 'Înot începători' })
  expect(swim).toHaveAttribute('href', '/cursuri/swim')
  const swimCard = swim.closest('article') as HTMLElement
  expect(within(swimCard).getByText('Bazin Olimpic Timișoara')).toBeInTheDocument()
  expect(within(swimCard).getByText('11 locuri rămase')).toBeInTheDocument()
  const bikeCard = screen.getByRole('link', { name: 'Ciclism juniori' }).closest('article') as HTMLElement
  expect(within(bikeCard).getByText('Curs plin')).toBeInTheDocument()
  expect(coachCourses).toHaveBeenCalledWith('c1')
})

test('keeps the section with an empty state when the coach has no active courses', async () => {
  coachCourses.mockResolvedValue([])
  renderSection()

  expect(await screen.findByText('Momentan nu are cursuri active.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Cursuri predate' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Vezi toate cursurile' })).toHaveAttribute('href', '/cursuri')
})

test('shows skeletons while loading', () => {
  coachCourses.mockReturnValue(new Promise(() => {}))
  renderSection()

  expect(screen.getByRole('status', { name: 'Se încarcă cursurile' })).toBeInTheDocument()
})

test('shows an error with retry instead of hiding the section', async () => {
  coachCourses.mockRejectedValueOnce(new Error('down')).mockResolvedValue([course({})])
  renderSection()

  expect(await screen.findByText('Nu am putut încărca cursurile.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('link', { name: 'Înot începători' })).toBeInTheDocument()
})
