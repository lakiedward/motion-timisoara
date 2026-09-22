import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import CompetitionPodiumPage from './CompetitionPodiumPage'
import { getConcurs } from '@/api/competition/competitions'
import { getCompetitionCategories } from '@/api/competition/competition-offers'
import {
  getCompetitionPodiumCandidates,
  getCompetitionPodiumManagement,
  saveCompetitionPodiumPlace,
} from '@/api/competition/competition-podium'

vi.mock('@/api/competition/competitions', () => ({ getConcurs: vi.fn() }))
vi.mock('@/api/competition/competition-offers', () => ({ getCompetitionCategories: vi.fn() }))
vi.mock('@/api/competition/competition-podium', () => ({
  getCompetitionPodiumCandidates: vi.fn(),
  getCompetitionPodiumManagement: vi.fn(),
  saveCompetitionPodiumPlace: vi.fn(),
  publishCompetitionPodiumCategory: vi.fn(),
}))
vi.mock('../useCompetitionOwner', () => ({
  useCompetitionOwner: () => ({
    owner: { role: 'COACH', clubId: null, coachUserId: 'other-coach' },
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

test('antrenorul asociat corectează podiumul după publicare', async () => {
  const user = userEvent.setup()
  vi.mocked(getConcurs).mockResolvedValue({
    id: 'competition-1',
    title: 'Cupa',
    end_at: '2026-09-20T10:00:00Z',
    coach_id: 'owner-coach',
    club_id: null,
  } as never)
  vi.mocked(getCompetitionCategories).mockResolvedValue([
    {
      id: 'category-1',
      competition_id: 'competition-1',
      route_id: 'route-1',
      name: '8–10 ani',
      age_from: 8,
      age_to: 10,
      price_bani: 0,
      display_order: 0,
      created_at: '',
      updated_at: '',
    },
  ])
  vi.mocked(getCompetitionPodiumManagement).mockResolvedValue({
    results: [
      {
        id: 'result-1',
        competition_id: 'competition-1',
        category_id: 'category-1',
        registration_id: 'registration-1',
        place: 1,
        updated_at: '',
        updated_by: null,
        created_at: '',
      },
    ],
    publications: [
      {
        id: 'publication-1',
        competition_id: 'competition-1',
        category_id: 'category-1',
        published_at: '',
        published_by: null,
      },
    ],
  })
  vi.mocked(getCompetitionPodiumCandidates).mockResolvedValue([
    { registration_id: 'registration-1', child_name: 'Ana', age_at_registration: 9 },
    { registration_id: 'registration-2', child_name: 'Maria', age_at_registration: 10 },
  ])
  vi.mocked(saveCompetitionPodiumPlace).mockResolvedValue()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/coach/competitions/competition-1/results']}>
        <Routes>
          <Route
            path="/coach/competitions/:id/results"
            element={<CompetitionPodiumPage baza="/coach/competitions" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(await screen.findByText(/Publicat. Corecțiile/)).toBeInTheDocument()
  await user.selectOptions(await screen.findByLabelText('Locul 1'), 'registration-2')
  await waitFor(() =>
    expect(vi.mocked(saveCompetitionPodiumPlace).mock.calls[0]?.[0]).toEqual({
      competitionId: 'competition-1',
      categoryId: 'category-1',
      place: 1,
      registrationId: 'registration-2',
      currentId: 'result-1',
    }),
  )
  expect(
    screen.queryByRole('button', { name: 'Publică podiumul categoriei' }),
  ).not.toBeInTheDocument()
})
