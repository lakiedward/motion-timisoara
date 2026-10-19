import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { getActiveLocationSessions } from '@/api/live-location/discovery'
import CoachLocationPage from './CoachLocationPage'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'parent-1', role: 'PARENT' } }),
}))
vi.mock('@/api/live-location/discovery', () => ({ getActiveLocationSessions: vi.fn() }))

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CoachLocationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('nobody sharing shows the empty state with the way back to attendance', async () => {
  vi.mocked(getActiveLocationSessions).mockResolvedValue([])
  mount()
  await screen.findByText('Niciun antrenor nu partajează locația acum.')
  expect(screen.getByRole('link', { name: 'Vezi prezența' })).toHaveAttribute(
    'href',
    '/account/attendance',
  )
  expect(screen.queryByLabelText('Harta locației antrenorului')).not.toBeInTheDocument()
})

test('a failed discovery is an error with retry, not an empty page', async () => {
  vi.mocked(getActiveLocationSessions)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue([])
  mount()
  await screen.findByText('Nu am putut verifica locațiile partajate.')
  expect(screen.queryByText('Niciun antrenor nu partajează locația acum.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await screen.findByText('Niciun antrenor nu partajează locația acum.')
})
