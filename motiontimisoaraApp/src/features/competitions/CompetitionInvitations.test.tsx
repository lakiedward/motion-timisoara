import { render, screen, waitFor, within } from '@testing-library/react'
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
  await user.click(screen.getByRole('button', { name: 'Acceptă invitația la Cupa Motion' }))
  await waitFor(() => expect(api.respond).toHaveBeenCalledWith('competition-1', true))
  expect(await screen.findByText('Ai acceptat')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Acceptă invitația la Cupa Motion' }),
  ).not.toBeInTheDocument()
})

test('load errors have a retry action', async () => {
  api.get.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
  const user = userEvent.setup()
  renderInvitations()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Nu am putut încărca invitațiile la concursuri.',
  )
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Nu ai invitații la concursuri.')).toBeVisible()
})

test('pending invitation shows badge, list-style date and the consent text', async () => {
  invitations = [invitation]
  renderInvitations()
  expect(await screen.findByText('Așteaptă răspunsul tău')).toBeVisible()
  expect(screen.getByText('01.10.2026 · 10:00–15:00 · Timișoara')).toBeVisible()
  expect(
    screen.getByText('Numele și poza ta apar pe pagina publică a concursului doar dacă accepți.'),
  ).toBeVisible()
})

test('declining asks for confirmation first and Anulează sends nothing', async () => {
  invitations = [invitation]
  api.respond.mockImplementation(async () => {
    invitations = [{ ...invitation, status: 'declined' }]
  })
  const user = userEvent.setup()
  renderInvitations()
  await user.click(await screen.findByRole('button', { name: 'Refuză invitația la Cupa Motion' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('Răspunsul nu se mai poate schimba')
  await user.click(within(dialog).getByRole('button', { name: 'Anulează' }))
  expect(api.respond).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Refuză invitația la Cupa Motion' }))
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Refuz invitația' }),
  )
  await waitFor(() => expect(api.respond).toHaveBeenCalledWith('competition-1', false))
  expect(await screen.findByText('Ai refuzat')).toBeVisible()
  expect(screen.queryByRole('button', { name: /Refuză invitația/ })).not.toBeInTheDocument()
})

test('a failed answer keeps the buttons active', async () => {
  invitations = [invitation]
  api.respond.mockRejectedValue(new Error('network'))
  const user = userEvent.setup()
  renderInvitations()
  const accept = await screen.findByRole('button', { name: 'Acceptă invitația la Cupa Motion' })
  await user.click(accept)
  await waitFor(() => expect(api.respond).toHaveBeenCalled())
  await waitFor(() => expect(accept).toBeEnabled())
})
