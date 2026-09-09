import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { getMyEnrollments } from '@/api/account'
import { getCurrentLocationOccurrences } from '@/api/live-location'
import { CurrentLocationSessions } from './CurrentLocationSessions'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'parent-1', role: 'PARENT' } }),
}))
vi.mock('@/api/account', () => ({ getMyEnrollments: vi.fn() }))
vi.mock('@/api/live-location', () => ({ getCurrentLocationOccurrences: vi.fn() }))
vi.mock('./LocationViewer', () => ({
  LocationViewer: ({ occurrenceId }: { occurrenceId: string }) => <p>Vizualizare {occurrenceId}</p>,
}))

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CurrentLocationSessions />
    </QueryClientProvider>,
  )
  return client
}
beforeEach(() => {
  vi.mocked(getMyEnrollments).mockResolvedValue([
    { kind: 'COURSE', entity_id: 'course-1', status: 'ACTIVE' },
  ] as Awaited<ReturnType<typeof getMyEnrollments>>)
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
  const client = mount()
  await userEvent.click(await screen.findByRole('button', { name: /Ședință ·/ }))
  await screen.findByText('Vizualizare occurrence-1')
  act(() => client.setQueryData(['live-location-occurrences', 'parent-1', ['course-1']], []))
  await screen.findByText('Nicio ședință în desfășurare.')
  expect(screen.getByText('Vizualizare occurrence-1')).toBeInTheDocument()
})

test('failure is distinct from a genuinely empty current schedule', async () => {
  vi.mocked(getCurrentLocationOccurrences).mockRejectedValue(new Error('offline'))
  mount()
  await screen.findByText('Nu am putut încărca ședințele pentru locație.')
  expect(screen.queryByText('Nicio ședință în desfășurare.')).not.toBeInTheDocument()
})
