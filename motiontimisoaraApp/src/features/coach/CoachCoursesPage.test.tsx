import { render, screen, within } from '@testing-library/react'
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

test('header keeps Cursurile mele and a compact Curs nou next to it, like the other panel lists', async () => {
  mockedGetMyCourses.mockResolvedValue([])
  renderPage()
  expect(await screen.findByRole('heading', { name: /^Cursurile mele/ })).toBeInTheDocument()
  const link = screen.getByRole('link', { name: /curs nou/i })
  expect(link).toHaveAttribute('href', '/coach/courses/new')
  expect(link.className).toMatch(/min-h-touch-target/)
  expect(link.className).not.toMatch(/w-full/)
  expect(link.parentElement?.className).toMatch(/flex-wrap/)
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
  expect(screen.getByRole('link', { name: /creează primul curs/i }).className).toMatch(/min-h-11/)
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

test('loading keeps the header and three row skeletons', () => {
  mockedGetMyCourses.mockImplementation(() => new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('heading', { name: 'Cursurile mele' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /curs nou/i })).toBeInTheDocument()
  const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
  expect(skeletons).toHaveLength(3)
  skeletons.forEach((el) => {
    expect(el.className).toMatch(/h-20/)
    expect(el.className).toMatch(/rounded-xl/)
    expect(el.className).toMatch(/animate-pulse/)
  })
})

test('filled rows show title, sport and status badges, location, age, price and the shared actions', async () => {
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
  const rows = screen.getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('8–14 ani')
  expect(rows[1]).toHaveTextContent('6–10 ani')
  expect(rows[2]).toHaveTextContent('7–12 ani')
  expect(screen.getByText('Alergare').getAttribute('data-slot')).toBe('badge')
  const edit = screen.getAllByRole('link', { name: /editează/i })
  expect(edit[0]).toHaveAttribute('href', '/coach/courses/1/edit')
  expect(edit[0].className).toMatch(/min-h-touch-target/)
  const deactivate = screen.getAllByRole('button', { name: /^Dezactivează/ })[0]
  expect(deactivate.className).toMatch(/min-h-touch-target/)
  expect(screen.getByRole('button', { name: /^Activează/ })).toBeInTheDocument()
  const list = rows[0].closest('ul')
  expect(list?.className).toMatch(/border/)
  expect(list?.className).not.toMatch(/shadow/)
})

test('rows say de la, până la, a full interval, or no age', async () => {
  mockedGetMyCourses.mockResolvedValue([
    course({
      id: 'both',
      name: 'Ambele',
      age_from: 8,
      age_to: 14,
      location: { id: 'lb', name: 'Stadion Ambele', city: 'Timișoara' },
    }),
    course({
      id: 'min',
      name: 'Doar minim',
      age_from: 7,
      age_to: null,
      location: { id: 'ln', name: 'Stadion Minim', city: 'Timișoara' },
    }),
    course({
      id: 'max',
      name: 'Doar maxim',
      age_from: null,
      age_to: 14,
      location: { id: 'lx', name: 'Stadion Maxim', city: 'Timișoara' },
    }),
    course({
      id: 'none',
      name: 'Fără limite',
      age_from: null,
      age_to: null,
      location: { id: 'l0', name: 'Stadion Nicio', city: 'Timișoara' },
    }),
    course({
      id: 'zero',
      name: 'De la zero',
      age_from: 0,
      age_to: 5,
      location: { id: 'lz', name: 'Stadion Zero', city: 'Timișoara' },
    }),
  ])
  renderPage()
  const row = async (name: string) => (await screen.findByText(name)).closest('li')!
  expect(await row('Ambele')).toHaveTextContent('8–14 ani')
  expect(await row('Doar minim')).toHaveTextContent('de la 7 ani')
  expect(await row('Doar maxim')).toHaveTextContent('până la 14 ani')
  expect(await row('De la zero')).toHaveTextContent('0–5 ani')
  expect(await row('Fără limite')).not.toHaveTextContent(/ani/)
  expect(screen.queryByText(/null/)).not.toBeInTheDocument()
})

test('courses render as rows of one bordered list, like the admin and club lists', async () => {
  mockedGetMyCourses.mockResolvedValue([course({ id: '1' }), course({ id: '2' })])
  renderPage()
  await screen.findAllByRole('heading', { name: 'Înot' })
  const list = screen.getAllByRole('heading', { name: 'Înot' })[0].closest('ul')
  expect(list?.className).toMatch(/divide-y/)
  expect(within(list as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
})

test('search, status pills and sport pills narrow the list and can be cleared', async () => {
  const user = userEvent.setup()
  mockedGetMyCourses.mockResolvedValue([
    course({ id: '1', name: 'Înot începători' }),
    course({
      id: '2',
      name: 'Alergare juniori',
      active: false,
      sport_id: 's2',
      sport: { id: 's2', code: 'run', name: 'Alergare' },
      location: { id: 'l2', name: 'Stadion Atletism', city: 'Timișoara' },
    }),
  ])
  renderPage()
  await screen.findByRole('heading', { name: 'Înot începători' })
  expect(screen.getByRole('button', { name: /^Active\s*1$/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Inactive\s*1$/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Toate\s*2$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await user.type(screen.getByRole('searchbox', { name: /caută cursuri/i }), 'stadion')
  expect(screen.queryByRole('heading', { name: 'Înot începători' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Alergare juniori' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^Active\s*1$/ }))
  expect(screen.getByText('Niciun curs pentru filtrele alese.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Șterge filtrele' }))
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)

  await user.click(screen.getByRole('button', { name: /^Alergare\s*1$/ }))
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
  expect(screen.getByLabelText('Sport', { selector: 'button' })).toHaveTextContent(/^Alergare/)
})
