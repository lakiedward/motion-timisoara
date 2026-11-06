import { vi } from 'vitest'
import { toast } from 'sonner'
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
  publishCompetitionPodiumCategory,
  saveCompetitionPodiumPlace,
} from '@/api/competition/competition-podium'
import { pickSelectMenuValue } from '@/test/select-menu'

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
    owner: { role: 'COACH', clubId: null, coachUserId: 'owner-coach' },
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const category = {
  id: 'category-1',
  competition_id: 'competition-1',
  route_id: 'route-1',
  name: 'Adulți',
  age_from: 18,
  age_to: 99,
  price_bani: 0,
  display_order: 0,
  created_at: '',
  updated_at: '',
}

function setup(options: {
  endAt: string
  categories?: (typeof category)[]
  candidates?: unknown[]
  candidatesError?: boolean
}) {
  vi.clearAllMocks()
  vi.mocked(getConcurs).mockResolvedValue({
    id: 'competition-1',
    title: 'Cupa',
    end_at: options.endAt,
    coach_id: 'owner-coach',
    club_id: null,
  } as never)
  vi.mocked(getCompetitionCategories).mockResolvedValue(options.categories ?? [category])
  let saved = false
  vi.mocked(getCompetitionPodiumManagement).mockImplementation(async () => ({
    results: saved
      ? [
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
        ]
      : [],
    publications: [],
  }))
  if (options.candidatesError) {
    vi.mocked(getCompetitionPodiumCandidates).mockRejectedValue(new Error('x'))
  } else {
    vi.mocked(getCompetitionPodiumCandidates).mockResolvedValue((options.candidates ?? []) as never)
  }
  vi.mocked(saveCompetitionPodiumPlace).mockImplementation(async () => {
    saved = true
  })
  vi.mocked(publishCompetitionPodiumCategory).mockResolvedValue()
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
}

const past = '2026-01-01T10:00:00Z'

test('înainte de finalul concursului podiumul nu se poate completa', async () => {
  setup({ endAt: '2999-01-01T10:00:00Z' })
  expect(
    await screen.findByText('Podiumul poate fi completat după finalul concursului.'),
  ).toBeVisible()
})

test('fără categorii, fără participanți și cu eroare, stările sunt distincte', async () => {
  setup({ endAt: past, categories: [] })
  expect(await screen.findByText('Concursul nu are categorii.')).toBeVisible()
})

test('categoria fără participanți confirmați spune asta', async () => {
  setup({ endAt: past })
  expect(
    await screen.findByText('Niciun participant înscris și confirmat în această categorie.'),
  ).toBeVisible()
})

test('eroarea la participanți are reîncercare', async () => {
  setup({ endAt: past, candidatesError: true })
  expect(await screen.findByText('Nu am putut încărca participanții eligibili.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeVisible()
})

test('locurile sunt necompletate, se salvează și categoria se publică', async () => {
  setup({
    endAt: past,
    candidates: [
      { registration_id: 'registration-1', participant_name: 'Ana', age_at_registration: 35 },
    ],
  })
  expect(await screen.findByLabelText('Locul 1')).toHaveTextContent('Loc necompletat')
  await pickSelectMenuValue(await screen.findByLabelText('Locul 1'), 'registration-1')
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Podiumul a fost salvat.'))
  await userEvent
    .setup()
    .click(await screen.findByRole('button', { name: 'Publică podiumul categoriei' }))
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Podiumul categoriei este public.'),
  )
})
