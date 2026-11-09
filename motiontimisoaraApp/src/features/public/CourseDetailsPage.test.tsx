import { vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CourseDetailsPage from './CourseDetailsPage'
import { getCourse } from '@/api/public'

vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useParams: () => ({ id: 'curs-1' }) }
})

vi.mock('@/api/public', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/public')>()),
  getCourse: vi.fn(),
  getCourseSpotsRemaining: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/api/ratings', () => ({
  getCourseRatingSummary: vi.fn().mockResolvedValue({ average: 0, count: 0 }),
  getMyCourseRating: vi.fn().mockResolvedValue(null),
  submitCourseRating: vi.fn(),
}))

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: null }) }))

const mocked = vi.mocked(getCourse)

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CourseDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

test('un curs inexistent arată „Cursul nu a fost găsit”', async () => {
  mocked.mockResolvedValue(null)
  renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Cursul nu a fost găsit.' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
})

test('o cădere de rețea arată eroare cu reîncercare, nu „negăsit”', async () => {
  mocked.mockRejectedValueOnce(new Error('offline'))
  mocked.mockResolvedValueOnce(null)
  renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Nu am putut încărca cursul.' })).toBeInTheDocument()
  expect(screen.queryByText('Cursul nu a fost găsit.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Cursul nu a fost găsit.')).toBeInTheDocument()
  expect(mocked).toHaveBeenCalledTimes(2)
})
