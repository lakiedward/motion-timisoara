import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ClubActivitiesPage from './ClubActivitiesPage'
import { getClubActivities, getClubActivityById, getMyClub } from '@/api/club'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubActivities: vi.fn(),
  getClubActivityById: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedClub = vi.mocked(getMyClub)
const mockedActivities = vi.mocked(getClubActivities)
const mockedActivity = vi.mocked(getClubActivityById)

function renderPage(ruta = '/club/activities') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/club/activities" element={<ClubActivitiesPage />} />
          <Route path="/club/activities/:id" element={<ClubActivitiesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedClub.mockResolvedValue({ id: 'club-1', name: 'Club Audit' } as never)
})

test('lista goală spune că nu există activități', async () => {
  mockedActivities.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText('Nicio activitate a clubului.')).toBeInTheDocument()
})

test('activitatea clubului duce la fișierul regulamentului', async () => {
  mockedActivities.mockResolvedValue([
    {
      id: 'act-1',
      name: 'Atelier de înot',
      activity_date: '2026-10-03',
      sport: { id: 's1', name: 'Înot' },
    },
  ] as never)
  mockedActivity.mockResolvedValue({
    id: 'act-1',
    club_id: 'club-1',
    name: 'Atelier de înot',
    activity_date: '2026-10-03',
    rules_file_storage_path: null,
    rules_file_name: null,
    rules_file_content_type: null,
    rules_file_size_bytes: null,
  } as never)
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Atelier de înot')).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Fișierul regulamentului' }))
  expect(await screen.findByRole('button', { name: 'Alege fișierul' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Vezi pagina publică' })).toHaveAttribute(
    'href',
    '/activitati/act-1',
  )
})

test('eroarea de listă oferă reîncercarea', async () => {
  mockedActivities.mockRejectedValue(new Error('retea'))
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca activitățile.')
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})
