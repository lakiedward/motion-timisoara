import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachCoursesPage from './CoachCoursesPage'
import { getMyCourses, type CoachCourse } from '@/api/coach'

vi.mock('@/api/coach', () => ({
  getMyCourses: vi.fn(),
  setCourseActive: vi.fn(),
}))

const mockedGetMyCourses = vi.mocked(getMyCourses)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoachCoursesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

function course(overrides: Partial<CoachCourse>): CoachCourse {
  return {
    id: 'c1',
    name: 'Înot',
    active: true,
    sport_id: 's1',
    location_id: 'l1',
    coach_id: 'coach-1',
    club_id: null,
    level: null,
    age_from: 6,
    age_to: 10,
    capacity: null,
    price: 60000,
    currency: 'RON',
    price_per_session: 0,
    package_options: null,
    recurrence_rule: null,
    description: null,
    hero_photo_storage_path: null,
    payment_recipient: 'COACH',
    sport: { id: 's1', code: 'swim', name: 'Înot' },
    location: { id: 'l1', name: 'Bazin Olimpic', city: 'Timișoara' },
    ...overrides,
  } as CoachCourse
}

test('header keeps Cursurile mele and Curs nou; stacks under the title on small screens', async () => {
  mockedGetMyCourses.mockResolvedValue([])
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Cursurile mele' })).toBeInTheDocument()
  const link = screen.getByRole('link', { name: /curs nou/i })
  expect(link).toHaveAttribute('href', '/coach/courses/new')
  expect(link.className).toMatch(/h-11/)
  expect(link.className).toMatch(/w-full/)
  expect(link.className).toMatch(/md:w-auto/)
  const header = link.parentElement
  expect(header?.className).toMatch(/flex-col/)
  expect(header?.className).toMatch(/md:flex-row/)
})

test('empty list shows dashed copy and keeps Curs nou in the header', async () => {
  mockedGetMyCourses.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText(/niciun curs încă/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /creează primul curs/i })).toHaveAttribute(
    'href',
    '/coach/courses/new',
  )
  expect(screen.getByRole('link', { name: /curs nou/i })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('failed load shows error and retry, not the empty list', async () => {
  mockedGetMyCourses.mockRejectedValue(new Error('500'))
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca cursurile.')
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  expect(screen.queryByText(/niciun curs încă/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /creează primul curs/i })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Cursurile mele' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /curs nou/i })).toBeInTheDocument()
})

test('refetch error keeps cached cards instead of the error screen', async () => {
  mockedGetMyCourses.mockResolvedValueOnce([course({ id: '1', name: 'Înot — audit UI' })])
  const { queryClient } = renderPage()
  expect(await screen.findByRole('heading', { name: 'Înot — audit UI' })).toBeInTheDocument()
  mockedGetMyCourses.mockRejectedValueOnce(new Error('500'))
  await queryClient.invalidateQueries({ queryKey: ['my-courses'] })
  expect(await screen.findByRole('heading', { name: 'Înot — audit UI' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('retry refetches courses', async () => {
  const user = userEvent.setup()
  mockedGetMyCourses.mockRejectedValueOnce(new Error('500'))
  renderPage()
  await screen.findByRole('button', { name: 'Reîncearcă' })
  mockedGetMyCourses.mockResolvedValueOnce([])
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText(/niciun curs încă/i)).toBeInTheDocument()
})

test('loading keeps the header and two rounded skeletons', () => {
  mockedGetMyCourses.mockImplementation(() => new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('heading', { name: 'Cursurile mele' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /curs nou/i })).toBeInTheDocument()
  const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
  expect(skeletons).toHaveLength(2)
  skeletons.forEach((el) => {
    expect(el.className).toMatch(/h-32/)
    expect(el.className).toMatch(/rounded-3xl/)
    expect(el.className).toMatch(/animate-pulse/)
  })
})

test('filled cards show location under the title, badges, price, gray line and outline actions', async () => {
  mockedGetMyCourses.mockResolvedValue([
    course({
      id: '1',
      name: 'Înot — audit UI',
      active: false,
      price: 48000,
      age_from: 8,
      age_to: 14,
      sport: { id: 's2', code: 'run', name: 'Alergare' },
      location: { id: 'l2', name: 'Stadion Atletism', city: 'Timișoara' },
    }),
    course({
      id: '2',
      name: 'Înot — audit UI',
      active: true,
      price: 60000,
      age_from: 6,
      age_to: 10,
      sport: { id: 's1', code: 'swim', name: 'Înot' },
      location: { id: 'l1', name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
    }),
    course({
      id: '3',
      name: 'Înot — audit UI',
      active: true,
      price: 40000,
      age_from: 7,
      age_to: 12,
      sport: { id: 's1', code: 'swim', name: 'Înot' },
      location: { id: 'l3', name: 'Bazin Audit Motion', city: 'Timișoara' },
    }),
  ])
  renderPage()
  expect(await screen.findAllByRole('heading', { name: 'Înot — audit UI' })).toHaveLength(3)
  expect(screen.getByText('Stadion Atletism')).toBeInTheDocument()
  expect(screen.getByText('Bazin Olimpic Timișoara')).toBeInTheDocument()
  expect(screen.getByText('Bazin Audit Motion')).toBeInTheDocument()
  expect(screen.getByText('Alergare')).toBeInTheDocument()
  expect(screen.getByText('Inactiv')).toBeInTheDocument()
  expect(screen.getAllByText('Activ')).toHaveLength(2)
  expect(screen.getByText('480,00 lei')).toBeInTheDocument()
  expect(screen.getByText('600,00 lei')).toBeInTheDocument()
  expect(screen.getByText('400,00 lei')).toBeInTheDocument()
  expect(screen.getByText('Stadion Atletism · 8–14 ani')).toBeInTheDocument()
  expect(screen.getByText('Bazin Olimpic Timișoara · 6–10 ani')).toBeInTheDocument()
  expect(screen.getByText('Bazin Audit Motion · 7–12 ani')).toBeInTheDocument()
  const edit = screen.getAllByRole('link', { name: /editează/i })
  expect(edit[0]).toHaveAttribute('href', '/coach/courses/1/edit')
  const deactivate = screen.getAllByRole('button', { name: 'Dezactivează' })[0]
  expect(deactivate.className).toMatch(/border/)
  expect(deactivate.className).not.toMatch(/ghost/)
  expect(screen.getByRole('button', { name: 'Activează' }).className).toMatch(/border/)
})

test('grid uses one column on phone and two from sm up', async () => {
  mockedGetMyCourses.mockResolvedValue([course({ id: '1' }), course({ id: '2' })])
  renderPage()
  await screen.findAllByRole('heading', { name: 'Înot' })
  const grid = screen.getAllByRole('heading', { name: 'Înot' })[0].closest('.grid')
  expect(grid?.className).toMatch(/sm:grid-cols-2/)
})
