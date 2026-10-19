import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { getCurrentLocationOccurrences } from '@/api/live-location'
import { CurrentLocationSessions } from './CurrentLocationSessions'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'club-1', role: 'CLUB' } }),
}))
vi.mock('@/api/live-location', () => ({ getCurrentLocationOccurrences: vi.fn() }))
vi.mock('./LocationViewer', () => ({
  LocationViewer: ({ occurrenceId }: { occurrenceId: string }) => <p>Vizualizare {occurrenceId}</p>,
}))

const ready = { isLoading: false, isError: false, retry: vi.fn() }

function mount(courseIds = ['course-1'], courseSource = ready) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = (ids: string[]) => (
    <QueryClientProvider client={client}>
      <CurrentLocationSessions
        courseIds={ids}
        courseNames={{ 'course-1': 'Înot începători' }}
        courseSource={courseSource}
      />
    </QueryClientProvider>
  )
  const result = render(view(courseIds))
  return { rerender: (ids: string[]) => result.rerender(view(ids)) }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentLocationOccurrences).mockResolvedValue([
    {
      id: 'occurrence-1',
      course_id: 'course-1',
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 60_000).toISOString(),
    },
  ])
})

test('selection survives disappearance from occurrence candidates so revocation stays reachable', async () => {
  const { rerender } = mount()
  await userEvent.click(await screen.findByRole('button', { name: /Înot începători/ }))
  await screen.findByText('Vizualizare occurrence-1')
  rerender([])
  await screen.findByText('Nicio ședință în desfășurare.')
  expect(screen.getByText('Vizualizare occurrence-1')).toBeInTheDocument()
})

test('discovery asks once per distinct club course', async () => {
  mount(['course-2', 'course-1', 'course-1'])
  await screen.findByRole('button', { name: /Ședință|Înot/ })
  expect(getCurrentLocationOccurrences).toHaveBeenCalledWith(['course-1', 'course-2'])
})

test('a club without courses does not issue a discovery request', async () => {
  mount([])
  await screen.findByText('Nicio ședință în desfășurare.')
  expect(getCurrentLocationOccurrences).not.toHaveBeenCalled()
})

test('failure is distinct from a genuinely empty current schedule', async () => {
  vi.mocked(getCurrentLocationOccurrences).mockRejectedValue(new Error('offline'))
  mount()
  await screen.findByText('Nu am putut încărca ședințele pentru locație.')
  expect(screen.queryByText('Nicio ședință în desfășurare.')).not.toBeInTheDocument()
})

test('a course list failure retries the course source', async () => {
  const retry = vi.fn()
  mount(['course-1'], { isLoading: false, isError: true, retry })
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă ședințele' }))
  expect(retry).toHaveBeenCalled()
  expect(getCurrentLocationOccurrences).not.toHaveBeenCalled()
})

test('sessions show the course title and expand the viewer in place', async () => {
  mount()
  const row = await screen.findByRole('button', { name: /Înot începători/ })
  expect(row).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(row)
  expect(row).toHaveAttribute('aria-expanded', 'true')
  await screen.findByText('Vizualizare occurrence-1')
})

test('no live session shows the empty explanation without the choose prompt', async () => {
  vi.mocked(getCurrentLocationOccurrences).mockResolvedValue([])
  mount()
  await screen.findByText('Nicio ședință în desfășurare.')
  expect(screen.queryByText(/Alege ședința/)).not.toBeInTheDocument()
})
