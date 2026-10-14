import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import HomePage from './HomePage'
import { getCoaches, getCourses, type CoachListItem, type CourseListItem } from '@/api/public'
import { getHomeStats, getHomeTestimonials } from '@/api/home'
import { useAuth } from '@/lib/auth-context'

vi.mock('@/api/public', async () => {
  const real = await vi.importActual<typeof import('@/api/public')>('@/api/public')
  return { ...real, getCourses: vi.fn(), getCoaches: vi.fn() }
})
vi.mock('@/api/home', async () => {
  const real = await vi.importActual<typeof import('@/api/home')>('@/api/home')
  return { ...real, getHomeStats: vi.fn(), getHomeTestimonials: vi.fn() }
})
vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))

const courses = vi.mocked(getCourses)
const coaches = vi.mocked(getCoaches)
const stats = vi.mocked(getHomeStats)
const testimonials = vi.mocked(getHomeTestimonials)
const auth = vi.mocked(useAuth)

function coach(id: string, name: string): CoachListItem {
  return {
    id,
    user_id: `u-${id}`,
    bio: null,
    avatar_url: null,
    photo_storage_path: null,
    profile: { id: `u-${id}`, name, avatar_url: null },
    coach_sports: [],
  } as unknown as CoachListItem
}

function course(id: string, name: string): CourseListItem {
  return {
    id,
    name,
    price: 20000,
    currency: 'RON',
    age_from: 6,
    age_to: 10,
    sport: null,
    coach: null,
    location: null,
    occurrences: [],
    course_photos: [],
  } as unknown as CourseListItem
}

function draw() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.mockReturnValue({ user: null, loading: false, profileError: null, refresh: vi.fn() } as never)
  stats.mockResolvedValue({ clubs: 15, coaches: 16, sports: 6, courses: 10 })
  coaches.mockResolvedValue([])
  courses.mockResolvedValue([])
  testimonials.mockResolvedValue([])
})

test('hero-ul vorbește despre cluburi și sporturi, iar „Înscrie-te” duce la cursuri', async () => {
  draw()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Găsește-i copilului sportul potrivit')
  expect(screen.queryByText(/Triatlon pentru copii/)).not.toBeInTheDocument()
  expect(screen.queryByText('Nu suntem doar un club de sport.')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Înscrie-te/ })).toHaveAttribute('href', '/cursuri')
})

test('cifrele din bandă vin din baza de date', async () => {
  draw()
  const list = await screen.findByText('Cluburi')
  const strip = list.closest('dl') as HTMLElement
  await waitFor(() => expect(within(strip).getByText('15')).toBeInTheDocument())
  expect(within(strip).getByText('16')).toBeInTheDocument()
  expect(within(strip).getByText('6')).toBeInTheDocument()
  expect(within(strip).getByText('10')).toBeInTheDocument()
  expect(screen.queryByText(/Copii antrenați/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/Ani experiență/i)).not.toBeInTheDocument()
})

test('banda de antrenori arată cel mult cinci și numărul total, cu link spre /antrenori', async () => {
  coaches.mockResolvedValue(Array.from({ length: 7 }, (_, i) => coach(String(i), `Antrenor ${i} Test`)))
  draw()
  const link = await screen.findByRole('link', { name: /7 antrenori/ })
  expect(link).toHaveAttribute('href', '/antrenori')
  expect(link).toHaveTextContent('7 antrenori te așteaptă')
  expect(link.querySelectorAll('span.rounded-full')).toHaveLength(5)
})

test('programele populare arată eroarea și se pot reîncărca', async () => {
  const user = userEvent.setup()
  courses.mockRejectedValueOnce(new Error('retea')).mockResolvedValueOnce([course('c1', 'Înot începători')])
  draw()
  expect(await screen.findByText('Nu am putut încărca programele.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Reîncearcă/ }))
  expect(await screen.findByText('Înot începători')).toBeInTheDocument()
})

test('fără cursuri active, secțiunea spune asta și trimite la /cursuri', async () => {
  draw()
  expect(await screen.findByText('Nu există programe active momentan.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Vezi toate cursurile' })).toHaveAttribute('href', '/cursuri')
})

test('în timpul încărcării, programele își păstrează locul cu schelete', () => {
  courses.mockReturnValue(new Promise(() => {}))
  draw()
  expect(screen.getByRole('status', { name: 'Se încarcă programele' })).toBeInTheDocument()
})

test('arată cel mult trei programe', async () => {
  courses.mockResolvedValue(['a', 'b', 'c', 'd'].map((id) => course(id, `Curs ${id}`)))
  draw()
  await screen.findByText('Curs a')
  expect(screen.queryByText('Curs d')).not.toBeInTheDocument()
})

test('testimonialele apar doar cu cel puțin două evaluări reale', async () => {
  testimonials.mockResolvedValue([
    { id: 't1', quote: 'Foarte bine', author: 'Ana P.', createdAt: '2026-10-01' },
  ])
  const { unmount } = draw()
  await waitFor(() => expect(testimonials).toHaveBeenCalled())
  expect(screen.queryByText('Din evaluările părinților')).not.toBeInTheDocument()
  unmount()
  testimonials.mockResolvedValue([
    { id: 't1', quote: 'Foarte bine', author: 'Ana P.', createdAt: '2026-10-01' },
    { id: 't2', quote: 'Antrenori atenți', author: 'Dan M.', createdAt: '2026-10-02' },
  ])
  draw()
  expect(await screen.findByText('Din evaluările părinților')).toBeInTheDocument()
  expect(screen.getByText('Dan M.')).toBeInTheDocument()
})

test('blocul final cere cont doar vizitatorului nelogat', async () => {
  const { unmount } = draw()
  expect(screen.getByRole('link', { name: /Creează cont/ })).toHaveAttribute('href', '/signup')
  unmount()
  auth.mockReturnValue({ user: { id: 'p1' }, loading: false, profileError: null, refresh: vi.fn() } as never)
  draw()
  expect(screen.queryByRole('link', { name: /Creează cont/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Vezi cursurile/ })).toHaveAttribute('href', '/cursuri')
})
