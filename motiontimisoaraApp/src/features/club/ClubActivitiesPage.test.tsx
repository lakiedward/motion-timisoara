import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ClubActivitiesPage from './ClubActivitiesPage'
import {
  createClubActivity,
  getClubActivities,
  getClubActivityById,
  getClubRosterForSelect,
  getClubSelectableLocations,
  getMyClub,
} from '@/api/club'
import { fetchSports } from '@/api/sports'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubActivities: vi.fn(),
  getClubActivityById: vi.fn(),
  getClubRosterForSelect: vi.fn(),
  getClubSelectableLocations: vi.fn(),
  createClubActivity: vi.fn(),
  updateClubActivity: vi.fn(),
  setClubActivityActive: vi.fn(),
}))
vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedClub = vi.mocked(getMyClub)
const mockedActivities = vi.mocked(getClubActivities)
const mockedCreate = vi.mocked(createClubActivity)
const ANTRENOR = 'add649ab-2e81-49d6-952d-31417215b770'
const LOC = 'f11ef72e-8114-48bc-bf4d-6cbee7897985'
const SPORT = '4c7a30c1-42a4-4bad-839c-f03d2b90e88a'

function renderPage(ruta = '/club/activities') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/club/activities" element={<ClubActivitiesPage />} />
          <Route path="/club/activities/new" element={<ClubActivitiesPage />} />
          <Route path="/club/activities/:id/edit" element={<ClubActivitiesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedClub.mockResolvedValue({ id: 'club-1', name: 'Club Audit' } as never)
  vi.mocked(fetchSports).mockResolvedValue([{ id: SPORT, name: 'Înot' }] as never)
  vi.mocked(getClubRosterForSelect).mockResolvedValue([
    { user_id: ANTRENOR, name: 'Audit Antrenor' },
  ])
  vi.mocked(getClubSelectableLocations).mockResolvedValue([
    { id: LOC, name: 'Bazin Audit Motion', city: 'Timișoara' },
  ] as never)
})

test('lista goală duce la formularul de activitate', async () => {
  mockedActivities.mockResolvedValue([])
  renderPage()
  expect(await screen.findByRole('link', { name: 'Creează prima activitate' })).toHaveAttribute(
    'href',
    '/club/activities/new',
  )
})

test('activitatea clubului se editează din formular', async () => {
  mockedActivities.mockResolvedValue([
    {
      id: 'act-1',
      name: 'Atelier de înot',
      activity_date: '2026-10-03',
      price: 5000,
      currency: 'RON',
      active: true,
      sport: { id: 's1', name: 'Înot' },
      location: { id: LOC, name: 'Bazin Audit Motion' },
      coach: { id: ANTRENOR, name: 'Audit Antrenor' },
    },
  ] as never)
  renderPage()
  expect(await screen.findByText('Atelier de înot')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editează' })).toHaveAttribute(
    'href',
    '/club/activities/act-1/edit',
  )
  expect(screen.queryByRole('link', { name: 'Fișierul regulamentului' })).not.toBeInTheDocument()
})

test('eroarea de listă oferă reîncercarea', async () => {
  mockedActivities.mockRejectedValue(new Error('retea'))
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca activitățile.')
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('formularul nou cere un antrenor din club și salvează regulamentul pe formular', async () => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'act-nou' } as never)
  renderPage('/club/activities/new')
  expect(await screen.findByRole('option', { name: 'Audit Antrenor' })).toBeInTheDocument()
  expect(screen.getByText('Fișierul regulamentului')).toBeInTheDocument()
  await user.type(screen.getByLabelText('Nume'), 'Atelier club')
  await user.selectOptions(screen.getByLabelText('Antrenor'), ANTRENOR)
  await user.selectOptions(screen.getByLabelText('Sport'), SPORT)
  await user.selectOptions(screen.getByLabelText('Locație'), LOC)
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-20' } })
  fireEvent.change(screen.getByLabelText('Ora început'), { target: { value: '10:00' } })
  fireEvent.change(screen.getByLabelText('Ora final'), { target: { value: '11:00' } })
  await user.type(screen.getByLabelText('Preț (lei)'), '40')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toBe('club-1')
  expect(mockedCreate.mock.calls[0][1]).toMatchObject({
    name: 'Atelier club',
    coach_id: ANTRENOR,
    sport_id: SPORT,
    location_id: LOC,
    price: 4000,
    currency: 'RON',
  })
})

test('editarea încarcă activitatea clubului', async () => {
  vi.mocked(getClubActivityById).mockResolvedValue({
    id: 'act-1',
    club_id: 'club-1',
    name: 'Atelier de înot',
    sport_id: SPORT,
    location_id: LOC,
    coach_id: ANTRENOR,
    activity_date: '2026-10-03',
    start_time: '10:00:00',
    end_time: '11:00:00',
    price: 4000,
    currency: 'RON',
    eur_ron_rate_micros: null,
    capacity: null,
    description: null,
    rules_file_storage_path: null,
    rules_file_name: null,
    rules_file_content_type: null,
    rules_file_size_bytes: null,
  } as never)
  renderPage('/club/activities/act-1/edit')
  expect(await screen.findByDisplayValue('Atelier de înot')).toBeInTheDocument()
  expect(screen.getByLabelText('Antrenor')).toHaveValue(ANTRENOR)
  expect(screen.getByRole('link', { name: 'Vezi pagina publică' })).toHaveAttribute(
    'href',
    '/activitati/act-1',
  )
})
