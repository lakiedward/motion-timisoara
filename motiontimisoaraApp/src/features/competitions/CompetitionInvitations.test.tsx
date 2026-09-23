import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { CompetitionInvitation } from '@/api/competition/competition-coaches'
import { CompetitionInvitations } from './CompetitionInvitations'

const api = vi.hoisted(() => ({ get: vi.fn(), respond: vi.fn() }))

vi.mock('@/api/competition/competition-coaches', () => ({
  getMyCompetitionInvitations: api.get,
  respondToCompetitionInvitation: api.respond,
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

let invitations: CompetitionInvitation[]
const invitation: CompetitionInvitation = {
  competitionId: 'competition-1',
  title: 'Cupa Motion',
  slug: 'cupa-motion',
  startAt: '2026-10-01T07:00:00Z',
  endAt: '2026-10-01T12:00:00Z',
  locationText: 'Timișoara',
  status: 'invited',
}

function renderInvitations() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CompetitionInvitations />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  invitations = []
  api.get.mockImplementation(async () => invitations)
  api.respond.mockImplementation(async () => {
    invitations = [{ ...invitation, status: 'accepted' }]
  })
})

test('shows a clear empty state when the coach has no invitations', async () => {
  renderInvitations()
  expect(await screen.findByText('Nu ai invitații la concursuri.')).toBeVisible()
})

test('coach accepts through the consent RPC and then sees accepted status', async () => {
  invitations = [invitation]
  const user = userEvent.setup()
  renderInvitations()
  expect(await screen.findByRole('link', { name: 'Cupa Motion' })).toHaveAttribute(
    'href',
    '/concursuri/cupa-motion',
  )
  await user.click(screen.getByRole('button', { name: 'Accept' }))
  await waitFor(() => expect(api.respond).toHaveBeenCalledWith('competition-1', true))
  expect(await screen.findByText('Ai acceptat')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
})

test('load errors have a retry action', async () => {
  api.get.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
  const user = userEvent.setup()
  renderInvitations()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca invitațiile')
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Nu ai invitații la concursuri.')).toBeVisible()
})
