import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import type { CompetitionCoach } from '@/api/competition/competition-coaches'
import { CompetitionCoachesSection } from './CompetitionCoachesSection'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  search: vi.fn(),
  invite: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/api/competition/competition-coaches', () => ({
  getCompetitionCoaches: api.get,
  searchCompetitionCoaches: api.search,
  inviteCompetitionCoach: api.invite,
  removeCompetitionCoach: api.remove,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const coach: CompetitionCoach = {
  coachProfileId: 'coach-1',
  name: 'Ana Popescu',
  photoUrl: null,
  status: 'invited',
  respondedAt: null,
}

let coaches: CompetitionCoach[]

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CompetitionCoachesSection competitionId="competition-1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  coaches = []
  api.get.mockImplementation(async () => coaches)
  api.search.mockResolvedValue([
    { coachProfileId: coach.coachProfileId, name: coach.name, photoUrl: null },
  ])
  api.invite.mockImplementation(async () => {
    coaches = [coach]
  })
  api.remove.mockImplementation(async () => {
    coaches = []
  })
})

test('organizer sees an empty state, searches a coach, and sends an invitation', async () => {
  const user = userEvent.setup()
  renderSection()
  expect(await screen.findByText('Niciun antrenor invitat încă.')).toBeVisible()
  await user.type(screen.getByLabelText('Caută un antrenor'), 'Ana')
  await user.click(await screen.findByRole('button', { name: 'Invită' }))
  await waitFor(() => expect(api.invite).toHaveBeenCalledWith('competition-1', 'coach-1'))
  expect(await screen.findByText('Așteaptă răspuns')).toBeVisible()
})

test('removing a coach requires a second click', async () => {
  coaches = [coach]
  const user = userEvent.setup()
  renderSection()
  await user.click(
    await screen.findByRole('button', { name: 'Scoate-l pe Ana Popescu din concurs' }),
  )
  expect(api.remove).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Confirmă scoaterea lui Ana Popescu' }))
  await waitFor(() => expect(api.remove).toHaveBeenCalledWith('competition-1', 'coach-1'))
})

test('load errors offer retry rather than an empty coach list', async () => {
  api.get.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([])
  const user = userEvent.setup()
  renderSection()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca antrenorii')
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Niciun antrenor invitat încă.')).toBeVisible()
})
