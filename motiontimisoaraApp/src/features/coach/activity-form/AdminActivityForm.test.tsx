import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ActivityFormPage from '../ActivityFormPage'
import { getActivityById, getSelectableLocations } from '@/api/coach'
import { getAllClubs, getCoachesForSelect } from '@/api/admin'
import { getClubRosterForSelect, getClubSelectableLocations } from '@/api/club'
import { createAdminActivity, updateAdminActivity } from '@/api/activities/admin-activities'
import { fetchSports } from '@/api/sports'

vi.mock('@/api/coach', () => ({
  activitateaAreInscrieri: vi.fn().mockResolvedValue(false),
  getSelectableLocations: vi.fn(),
  getActivityById: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
}))
vi.mock('@/api/admin', () => ({ getAllClubs: vi.fn(), getCoachesForSelect: vi.fn() }))
vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubRosterForSelect: vi.fn(),
  getClubSelectableLocations: vi.fn(),
}))
vi.mock('@/api/activities/admin-activities', () => ({
  createAdminActivity: vi.fn(),
  updateAdminActivity: vi.fn(),
}))
vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('@/api/offer-hero', () => ({
  schimbaPozaOferta: vi.fn().mockResolvedValue('a/hero/a.jpg'),
  renuntaLaOfertaFaraHero: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const CLUB = 'c0a80101-0000-4000-8000-000000000001'
const CLUB_COACH = 'b1e5f0a2-7d3c-4c1e-9a55-2f7d1c0e9b11'
const SOLO_COACH = 'b1e5f0a2-7d3c-4c1e-9a55-2f7d1c0e9b22'
const CLUB_LOC = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const SOLO_LOC = 'b6d97609-d740-44aa-b930-fb222ffadb14'
const SPORT = '4c7a30c1-42a4-4bad-839c-f03d2b90e88a'

function renderForm(ruta: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin/activities" element={<p>Lista admin</p>} />
          <Route path="/admin/activities/new" element={<ActivityFormPage portal="admin" />} />
          <Route path="/admin/activities/:id/edit" element={<ActivityFormPage portal="admin" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchSports).mockResolvedValue([{ id: SPORT, name: 'Înot' }] as never)
  vi.mocked(getAllClubs).mockResolvedValue([
    { id: CLUB, name: 'Club Audit Motion', city: 'Timișoara', email: null, approved_at: '2026-09-01T00:00:00Z' },
  ])
  vi.mocked(getClubRosterForSelect).mockResolvedValue([
    { user_id: CLUB_COACH, name: 'Dan Pop' },
  ] as never)
  vi.mocked(getCoachesForSelect).mockResolvedValue([{ user_id: SOLO_COACH, name: 'Ana Rusu' }])
  vi.mocked(getClubSelectableLocations).mockResolvedValue([
    { id: CLUB_LOC, name: 'Bazin Audit Motion', city: 'Timișoara' },
  ])
  vi.mocked(getSelectableLocations).mockResolvedValue([
    { id: SOLO_LOC, name: 'Parcul Rozelor', city: 'Timișoara' },
  ] as never)
  vi.mocked(createAdminActivity).mockResolvedValue({ id: 'nou' } as never)
  vi.mocked(updateAdminActivity).mockResolvedValue({ id: 'a1' } as never)
})

async function completeaza(user: ReturnType<typeof userEvent.setup>, locatie: string) {
  await user.type(screen.getByLabelText(/^Nume/), 'Atelier ciclism')
  await user.selectOptions(screen.getByLabelText(/^Sport/), SPORT)
  await user.selectOptions(screen.getByLabelText(/^Locație/), locatie)
  fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText(/^Ora început/), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText(/^Ora final/), { target: { value: '11:00' } })
  await user.type(screen.getByLabelText(/^Preț \(lei\)/), '20')
  await user.type(screen.getByLabelText(/^Descriere/), 'Atelier pentru copii.')
  fireEvent.change(screen.getByLabelText('Poza din capul paginii'), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
}

test('admin creates a club activity with the chosen club coach and location', async () => {
  const user = userEvent.setup()
  renderForm('/admin/activities/new')
  const antrenor = await screen.findByLabelText('Antrenor')
  expect(antrenor).toBeDisabled()
  await screen.findByRole('option', { name: 'Club Audit Motion' })
  await user.selectOptions(screen.getByRole('combobox', { name: 'Organizator' }), CLUB)
  await waitFor(() => expect(screen.getByRole('option', { name: 'Dan Pop' })).toBeInTheDocument())
  await user.selectOptions(antrenor, CLUB_COACH)
  await completeaza(user, CLUB_LOC)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(createAdminActivity).toHaveBeenCalled())
  expect(vi.mocked(createAdminActivity).mock.calls[0][0]).toEqual({
    clubId: CLUB,
    coachId: CLUB_COACH,
  })
  expect(vi.mocked(createAdminActivity).mock.calls[0][1]).toMatchObject({
    location_id: CLUB_LOC,
    price: 2000,
  })
  expect(await screen.findByText('Lista admin')).toBeInTheDocument()
})

test('switching to an independent coach offers that coach list and locations', async () => {
  const user = userEvent.setup()
  renderForm('/admin/activities/new')
  await user.selectOptions(
    await screen.findByRole('combobox', { name: 'Organizator' }),
    'independent',
  )
  await waitFor(() => expect(screen.getByRole('option', { name: 'Ana Rusu' })).toBeInTheDocument())
  expect(screen.getByRole('option', { name: 'Parcul Rozelor' })).toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Antrenor'), SOLO_COACH)
  await completeaza(user, SOLO_LOC)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(createAdminActivity).toHaveBeenCalled())
  expect(vi.mocked(createAdminActivity).mock.calls[0][0]).toEqual({
    clubId: null,
    coachId: SOLO_COACH,
  })
})

test('saving without organizer or coach shows the errors next to the fields', async () => {
  const user = userEvent.setup()
  renderForm('/admin/activities/new')
  await screen.findByRole('option', { name: 'Club Audit Motion' })
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Alege organizatorul')).toBeInTheDocument()
  await user.selectOptions(screen.getByRole('combobox', { name: 'Organizator' }), CLUB)
  await waitFor(() => expect(screen.getByRole('option', { name: 'Dan Pop' })).toBeInTheDocument())
  await completeaza(user, CLUB_LOC)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Alege un antrenor')).toBeInTheDocument()
  expect(createAdminActivity).not.toHaveBeenCalled()
})

test('editing keeps the organizer locked and saves a new coach', async () => {
  const user = userEvent.setup()
  vi.mocked(getActivityById).mockResolvedValue({
    id: 'a1',
    name: 'Atelier existent',
    club_id: CLUB,
    coach_id: CLUB_COACH,
    sport_id: SPORT,
    location_id: CLUB_LOC,
    activity_date: '2027-07-10',
    start_time: '09:00:00',
    end_time: '11:00:00',
    price: 2000,
    currency: 'RON',
    eur_ron_rate_micros: null,
    capacity: null,
    age_from: null,
    age_to: null,
    description: 'Text',
    hero_photo_storage_path: 'a1/hero/a.jpg',
  } as never)
  vi.mocked(getClubRosterForSelect).mockResolvedValue([
    { user_id: CLUB_COACH, name: 'Dan Pop' },
    { user_id: SOLO_COACH, name: 'Ana Rusu' },
  ] as never)
  renderForm('/admin/activities/a1/edit')
  await waitFor(() => expect(screen.getByLabelText(/^Nume/)).toHaveValue('Atelier existent'))
  expect(screen.getByRole('combobox', { name: 'Organizator' })).toBeDisabled()
  expect(screen.getByLabelText('Antrenor')).toHaveValue(CLUB_COACH)
  await user.selectOptions(screen.getByLabelText('Antrenor'), SOLO_COACH)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(updateAdminActivity).toHaveBeenCalled())
  expect(vi.mocked(updateAdminActivity).mock.calls[0].slice(0, 2)).toEqual(['a1', SOLO_COACH])
})

test('an unknown id shows the not-found state', async () => {
  vi.mocked(getActivityById).mockResolvedValue(null)
  renderForm('/admin/activities/lipsa/edit')
  expect(await screen.findByText('Activitatea nu a fost găsită.')).toBeInTheDocument()
})

test('a failed load offers a retry instead of not-found', async () => {
  vi.mocked(getActivityById).mockRejectedValueOnce(new Error('offline'))
  renderForm('/admin/activities/a1/edit')
  expect(await screen.findByText('Nu am putut încărca activitatea.')).toBeInTheDocument()
  vi.mocked(getActivityById).mockResolvedValueOnce(null)
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Activitatea nu a fost găsită.')).toBeInTheDocument()
})
