import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { getActiveLocationSessions } from '@/api/live-location/discovery'
import { LiveLocationBanner } from './LiveLocationBanner'

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

function mount(always = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LiveLocationBanner always={always} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('Panou banner stays hidden while no coach is sharing', async () => {
  vi.mocked(getActiveLocationSessions).mockResolvedValue([])
  const { container } = mount()
  await waitFor(() => expect(getActiveLocationSessions).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})

test('Panou banner names the live coach and links to the location page', async () => {
  vi.mocked(getActiveLocationSessions).mockResolvedValue([live])
  mount()
  const link = await screen.findByRole('link', { name: /Andrei Popescu partajează acum/ })
  expect(link).toHaveAttribute('href', '/account/locatie')
})

test('expired sessions do not count as live', async () => {
  vi.mocked(getActiveLocationSessions).mockResolvedValue([
    { ...live, expiresAt: new Date(Date.now() - 1_000).toISOString() },
  ])
  mount(true)
  const link = await screen.findByRole('link', { name: 'Unde e antrenorul' })
  expect(link).toHaveAttribute('href', '/account/locatie')
})
