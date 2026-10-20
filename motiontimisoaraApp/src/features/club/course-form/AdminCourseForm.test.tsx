import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ClubCourseFormPage from '../ClubCourseFormPage'
import {
  createClubCourse,
  getClubCourseById,
  getClubRosterForSelect,
  getClubSelectableLocations,
  getMyClub,
  updateClubCourse,
} from '@/api/club'
import { getAllClubs, getCoachesForSelect } from '@/api/admin'
import { getSelectableLocations } from '@/api/coach'
import { fetchSports } from '@/api/sports'

vi.mock('@/api/offer-hero', () => ({
  schimbaPozaOferta: vi.fn().mockResolvedValue('c/hero/a.jpg'),
  renuntaLaOfertaFaraHero: vi.fn(),
}))
vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubSelectableLocations: vi.fn(),
  getClubRosterForSelect: vi.fn(),
  getClubCourseById: vi.fn(),
  createClubCourse: vi.fn(),
  updateClubCourse: vi.fn(),
}))
vi.mock('@/api/admin', () => ({ getAllClubs: vi.fn(), getCoachesForSelect: vi.fn() }))
vi.mock('@/api/coach', () => ({ getSelectableLocations: vi.fn() }))
vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const CLUB = 'c0a80101-0000-4000-8000-000000000001'
const ANTRENOR_CLUB = 'add649ab-2e81-49d6-952d-31417215b770'
const ANTRENOR_INDEPENDENT = 'b1e5f0a2-7d3c-4c1e-9a55-2f7d1c0e9b11'
const LOC_CLUB = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const LOC_PUBLICA = 'e3f1a9c4-5b2d-4f8e-8a10-6c7d9e0b1a22'
const SPORT = '4c7a30c1-42a4-4bad-839c-f03d2b90e88a'

function renderForm(ruta = '/admin/courses/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin/courses" element={<p>Lista admin</p>} />
          <Route path="/admin/courses/new" element={<ClubCourseFormPage portal="admin" />} />
          <Route path="/admin/courses/:id/edit" element={<ClubCourseFormPage portal="admin" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchSports).mockResolvedValue([{ id: SPORT, name: 'Înot' }] as never)
  vi.mocked(getAllClubs).mockResolvedValue([
    { id: CLUB, name: 'Club Audit Motion', city: 'Timișoara', email: null },
  ])
  vi.mocked(getClubRosterForSelect).mockResolvedValue([
    { user_id: ANTRENOR_CLUB, name: 'Antrenor de club' },
  ])
  vi.mocked(getClubSelectableLocations).mockResolvedValue([
    { id: LOC_CLUB, name: 'Bazinul clubului', city: 'Timișoara' },
  ])
  vi.mocked(getCoachesForSelect).mockResolvedValue([
    { user_id: ANTRENOR_INDEPENDENT, name: 'Antrenor independent Ana' },
  ])
  vi.mocked(getSelectableLocations).mockResolvedValue([
    { id: LOC_PUBLICA, name: 'Stadion public', city: 'Timișoara' },
  ])
})

test('adminul nu citește „clubul meu" și trebuie să aleagă organizatorul', async () => {
  const user = userEvent.setup()
  renderForm()
  await screen.findByRole('option', { name: 'Club Audit Motion' })
  expect(getMyClub).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Alege organizatorul')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Organizator/)).toHaveAttribute('aria-invalid', 'true')
  expect(createClubCourse).not.toHaveBeenCalled()
})

test('antrenorii și locațiile urmează organizatorul ales', async () => {
  const user = userEvent.setup()
  renderForm()
  const organizator = await screen.findByLabelText(/^Organizator/)
  await screen.findByRole('option', { name: 'Club Audit Motion' })

  await user.selectOptions(organizator, CLUB)
  expect(await screen.findByRole('option', { name: 'Antrenor de club' })).toBeInTheDocument()
  expect(await screen.findByRole('option', { name: 'Bazinul clubului' })).toBeInTheDocument()
  expect(getClubRosterForSelect).toHaveBeenCalledWith(CLUB)

  await user.selectOptions(screen.getByLabelText(/^Antrenor/), ANTRENOR_CLUB)
  await user.selectOptions(organizator, 'independent')
  expect(
    await screen.findByRole('option', { name: 'Antrenor independent Ana' }),
  ).toBeInTheDocument()
  expect(await screen.findByRole('option', { name: 'Stadion public' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Antrenor de club' })).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^Antrenor/)).toHaveValue('')
})

test('un curs creat pentru antrenor independent pleacă fără club și duce în lista admin', async () => {
  const user = userEvent.setup()
  vi.mocked(createClubCourse).mockResolvedValue({ id: 'c-nou' } as never)
  renderForm()
  await screen.findByRole('option', { name: 'Club Audit Motion' })
  await user.selectOptions(screen.getByLabelText(/^Organizator/), 'independent')
  await screen.findByRole('option', { name: 'Antrenor independent Ana' })
  await user.type(screen.getByLabelText(/^Nume curs/), 'Atletism independent')
  await user.selectOptions(screen.getByLabelText(/^Antrenor/), ANTRENOR_INDEPENDENT)
  await user.selectOptions(screen.getByLabelText(/^Sport/), SPORT)
  await user.selectOptions(await screen.findByLabelText(/^Locație/), LOC_PUBLICA)
  await user.type(screen.getByLabelText(/^Preț \/ ședință \(lei\)/), '60')
  await user.click(screen.getByRole('button', { name: 'Luni' }))
  const luni = screen.getByRole('group', { name: 'Luni' })
  fireEvent.change(within(luni).getByLabelText('Ora start'), { target: { value: '18:00' } })
  fireEvent.change(within(luni).getByLabelText('Ora final'), { target: { value: '19:00' } })
  fireEvent.change(screen.getByLabelText('Poza din capul paginii'), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  await waitFor(() => expect(createClubCourse).toHaveBeenCalled())
  expect(vi.mocked(createClubCourse).mock.calls[0][0]).toBeNull()
  expect(vi.mocked(createClubCourse).mock.calls[0][1]).toMatchObject({
    coach_id: ANTRENOR_INDEPENDENT,
    location_id: LOC_PUBLICA,
  })
  expect(await screen.findByText('Lista admin')).toBeInTheDocument()
})

test('la editare organizatorul rămâne blocat pe cel salvat, iar antrenorul se poate schimba', async () => {
  const user = userEvent.setup()
  vi.mocked(updateClubCourse).mockResolvedValue()
  vi.mocked(getClubCourseById).mockResolvedValue({
    id: 'c1',
    club_id: CLUB,
    name: 'Înot de club',
    sport_id: SPORT,
    location_id: LOC_CLUB,
    coach_id: ANTRENOR_CLUB,
    level: null,
    age_from: null,
    age_to: null,
    capacity: null,
    price_per_session: 7500,
    description: '',
    hero_photo_storage_path: 'c1/hero.jpg',
    currency: 'RON',
    eur_ron_rate_micros: null,
    recurrence_rule: JSON.stringify({ daySchedules: { '1': { start: '18:00', end: '19:00' } } }),
  } as never)
  renderForm('/admin/courses/c1/edit')

  const organizator = await screen.findByLabelText(/^Organizator/)
  await waitFor(() => expect(organizator).toHaveValue(CLUB))
  expect(organizator).toBeDisabled()
  expect(screen.getByText(/Organizatorul rămâne cel de la creare/)).toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText(/^Antrenor/)).toHaveValue(ANTRENOR_CLUB))
  expect(screen.getByRole('link', { name: 'Anulează' })).toHaveAttribute('href', '/admin/courses')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(updateClubCourse).toHaveBeenCalled())
  expect(vi.mocked(updateClubCourse).mock.calls[0][0]).toBe('c1')
})
