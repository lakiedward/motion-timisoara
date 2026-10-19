import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { getActiveLocationSessions } from '@/api/live-location/discovery'
import { LiveLocationAnnouncements } from './LiveLocationAnnouncements'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'parent-1', role: 'PARENT' } }),
}))
vi.mock('@/api/live-location/discovery', () => ({ getActiveLocationSessions: vi.fn() }))

const live = {
  sessionId: '55555555-5555-4555-8555-555555555555',
  campId: null,
  occurrenceId: '11111111-1111-4111-8111-111111111111',
  coachId: '44444444-4444-4444-8444-444444444444',
  coachName: 'Andrei Popescu',
  title: 'Înot începători',
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LiveLocationAnnouncements />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('a live coach location shows as an announcement linking to the map', async () => {
  vi.mocked(getActiveLocationSessions).mockResolvedValue([live])
  mount()
  expect(await screen.findByText('Antrenorul Andrei Popescu a pornit locația')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Înot începători' })).toBeInTheDocument()
  expect(screen.getByText('1 locație live')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Vezi pe hartă' })).toHaveAttribute(
    'href',
    '/account/locatie',
  )
})

test('a camp session is labelled as a camp', async () => {
  vi.mocked(getActiveLocationSessions).mockResolvedValue([
    {
      ...live,
      campId: '66666666-6666-4666-8666-666666666666',
      occurrenceId: null,
      title: 'Tabăra de vară',
    },
  ])
  mount()
  expect(await screen.findByText('Tabără')).toBeInTheDocument()
})

test('nothing shows once the coach stops or the session expires', async () => {
  vi.mocked(getActiveLocationSessions).mockResolvedValue([
    { ...live, expiresAt: new Date(Date.now() - 1_000).toISOString() },
  ])
  const { container } = mount()
  await waitFor(() => expect(getActiveLocationSessions).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})
