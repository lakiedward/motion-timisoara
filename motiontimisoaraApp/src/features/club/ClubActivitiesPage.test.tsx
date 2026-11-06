import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ClubActivitiesPage from './ClubActivitiesPage'
import {
  createClubActivity,
  getClubActivities,
  getClubActivityById,
  getClubActivityEnrollmentCounts,
  getClubRosterForSelect,
  setClubActivityActive,
  getClubSelectableLocations,
  getMyClub,
  updateClubActivity,
} from '@/api/club'
import { fetchSports } from '@/api/sports'
import { toast } from 'sonner'
import { findSelectMenuOption, pickSelectMenuValue } from '@/test/select-menu'
import { setPickerValue } from '@/test/pickers'

vi.mock('@/api/offer-hero', () => ({
  schimbaPozaOferta: vi.fn().mockResolvedValue('a/hero/a.jpg'),
  renuntaLaOfertaFaraHero: vi.fn(),
}))

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubActivities: vi.fn(),
  getClubActivityById: vi.fn(),
  getClubActivityEnrollmentCounts: vi.fn(),
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
  const router = createMemoryRouter(
    [
      { path: '/club/activities', element: <ClubActivitiesPage /> },
      { path: '/club/activities/new', element: <ClubActivitiesPage /> },
      { path: '/club/activities/:id/edit', element: <ClubActivitiesPage /> },
    ],
    { initialEntries: [ruta] },
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
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
  vi.mocked(getClubActivityEnrollmentCounts).mockResolvedValue(new Map())
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
      activity_date: '2099-10-03',
      start_time: '10:00:00',
      end_time: '12:00:00',
      capacity: 20,
      price: 5000,
      currency: 'RON',
      active: true,
      sport: { id: 's1', name: 'Înot' },
      location: { id: LOC, name: 'Bazin Audit Motion' },
      coach: { id: ANTRENOR, name: 'Audit Antrenor' },
      enrolled: 3,
    },
  ] as never)
  renderPage()
  expect(await screen.findByText('Atelier de înot')).toBeInTheDocument()
  const rand = screen.getByText('Atelier de înot').closest('li')!
  expect(rand).toHaveTextContent('03.10.2099 · 10:00–12:00')
  expect(rand).toHaveTextContent('Antrenor: Audit Antrenor')
  expect(rand).toHaveTextContent('3/20 înscriși')
  expect(screen.getByRole('link', { name: 'Editează Atelier de înot' })).toHaveAttribute(
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
  await findSelectMenuOption(await screen.findByLabelText(/^Antrenor/), 'Audit Antrenor')
  expect(screen.getByText('Fișierul regulamentului')).toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Nume/), 'Atelier club')
  await pickSelectMenuValue(screen.getByLabelText(/^Antrenor/), ANTRENOR)
  await pickSelectMenuValue(screen.getByLabelText(/^Sport/), SPORT)
  await pickSelectMenuValue(screen.getByLabelText(/^Locație/), LOC)
  setPickerValue(screen.getByLabelText(/^Data/), '2026-10-20')
  setPickerValue(screen.getByLabelText(/^Ora început/), '10:00')
  setPickerValue(screen.getByLabelText(/^Ora final/), '11:00')
  await user.type(screen.getByLabelText(/^Preț \(lei\)/), '40')
  await user.type(screen.getByLabelText(/^Descriere/), 'Atelier pentru copii')
  fireEvent.change(screen.getByLabelText('Poza din capul paginii'), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
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
    description: 'Atelier pentru copii',
    age_from: null,
    age_to: null,
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
  expect(screen.getByLabelText(/^Antrenor/)).toHaveAttribute('data-value', ANTRENOR)
  expect(screen.getByRole('link', { name: 'Vezi pagina publică' })).toHaveAttribute(
    'href',
    '/activitati/act-1',
  )
})

test('pe un link de activitate inexistent apare „Activitatea nu a fost găsită.”', async () => {
  vi.mocked(getClubActivityById).mockResolvedValue(null)
  renderPage('/club/activities/lipsa/edit')
  expect(await screen.findByText('Activitatea nu a fost găsită.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Înapoi/ })).toHaveAttribute('href', '/club/activities')
  expect(screen.queryByRole('heading', { name: 'Editează activitatea' })).not.toBeInTheDocument()
})

test('activitatea altui club apare ca negăsită', async () => {
  vi.mocked(getClubActivityById).mockResolvedValue({ id: 'a9', club_id: 'alt-club' } as never)
  renderPage('/club/activities/a9/edit')
  expect(await screen.findByText('Activitatea nu a fost găsită.')).toBeInTheDocument()
})

test('dacă activitatea nu se poate citi, apare Reîncearcă', async () => {
  vi.mocked(getClubActivityById).mockRejectedValue(new Error('retea'))
  renderPage('/club/activities/act-1/edit')
  expect(await screen.findByText('Nu am putut încărca activitatea.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('formularul are cardurile pe grupe și spune ce lipsește la fiecare câmp', async () => {
  const user = userEvent.setup()
  renderPage('/club/activities/new')
  await findSelectMenuOption(await screen.findByLabelText(/^Antrenor/), 'Audit Antrenor')
  for (const titlu of [
    'Cine o organizează',
    'Despre activitate',
    'Când are loc',
    'Copii și locuri',
    'Preț',
  ])
    expect(screen.getByText(titlu)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Alege data.')).toBeInTheDocument()
  expect(screen.getByText('Alege ora de început.')).toBeInTheDocument()
  expect(screen.getByText('Descrierea este obligatorie.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Antrenor/)).toHaveAttribute('aria-describedby', 'coach_id-error')
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('ora de final trebuie să fie după ora de început', async () => {
  const user = userEvent.setup()
  renderPage('/club/activities/new')
  await findSelectMenuOption(await screen.findByLabelText(/^Antrenor/), 'Audit Antrenor')
  setPickerValue(screen.getByLabelText(/^Ora început/), '11:00')
  setPickerValue(screen.getByLabelText(/^Ora final/), '10:00')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(
    await screen.findByText('Ora final trebuie să fie după ora de început.'),
  ).toBeInTheDocument()
})

function activitate(over: Record<string, unknown>) {
  return {
    id: 'a',
    name: 'Activitate',
    activity_date: '2099-05-10',
    start_time: '10:00:00',
    end_time: '11:00:00',
    capacity: null,
    price: 0,
    currency: 'RON',
    active: true,
    sport_id: 's1',
    sport: { id: 's1', name: 'Înot' },
    location: { id: LOC, name: 'Bazin Audit Motion' },
    coach: { id: ANTRENOR, name: 'Audit Antrenor' },
    enrolled: 0,
    ...over,
  }
}

const LISTA = [
  activitate({ id: 'a1', name: 'Ștafetă', activity_date: '2099-06-01' }),
  activitate({
    id: 'a2',
    name: 'Atelier ciclism',
    activity_date: '2099-05-02',
    sport_id: 's2',
    sport: { id: 's2', name: 'Ciclism' },
    coach: { id: 'c2', name: 'Ioana Pop' },
  }),
  activitate({ id: 'a3', name: 'Activitate trecută', activity_date: '2020-01-10' }),
  activitate({ id: 'a4', name: 'Activitate oprită', active: false }),
]

test('lista pornește pe Viitoare, cea mai apropiată prima, grupată pe luni', async () => {
  mockedActivities.mockResolvedValue(LISTA as never)
  renderPage()
  expect(await screen.findByRole('button', { name: 'Viitoare 2' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Încheiate 1' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Inactive 1' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Toate 4' })).toBeInTheDocument()
  const grupuri = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))
  expect(grupuri).toEqual(['Mai 2099 · 1 activitate', 'Iunie 2099 · 1 activitate'])
  expect(screen.queryByText('Activitate trecută')).not.toBeInTheDocument()
})

test('căutarea găsește după antrenor fără diacritice și filtrul de antrenor se combină', async () => {
  const user = userEvent.setup()
  mockedActivities.mockResolvedValue(LISTA as never)
  renderPage()
  const cautare = await screen.findByRole('searchbox', {
    name: 'Caută activități după nume, locație sau antrenor',
  })
  await user.type(cautare, 'ioana')
  expect(screen.getByText('Atelier ciclism')).toBeInTheDocument()
  expect(screen.queryByText('Ștafetă')).not.toBeInTheDocument()
  await user.clear(cautare)
  await user.type(cautare, 'stafeta')
  expect(screen.getByText('Ștafetă')).toBeInTheDocument()
  await user.clear(cautare)
  await pickSelectMenuValue(screen.getByLabelText('Antrenor'), 'c2')
  expect(screen.getByText('Atelier ciclism')).toBeInTheDocument()
  expect(screen.queryByText('Ștafetă')).not.toBeInTheDocument()
})

test('fără rezultate, Șterge filtrele golește tot și arată Toate', async () => {
  const user = userEvent.setup()
  mockedActivities.mockResolvedValue(LISTA as never)
  renderPage()
  await user.type(await screen.findByRole('searchbox'), 'nimic de găsit')
  expect(screen.getByText('Nicio activitate pentru filtrele alese.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Șterge filtrele' }))
  expect(screen.getByRole('button', { name: 'Toate 4' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(screen.getByText('Activitate trecută')).toBeInTheDocument()
})

test('dezactivarea cu înscrieri cere confirmare, fără înscrieri se aplică direct', async () => {
  const user = userEvent.setup()
  vi.mocked(setClubActivityActive).mockResolvedValue(undefined)
  mockedActivities.mockResolvedValue([
    activitate({ id: 'a1', name: 'Cu copii', enrolled: 2 }),
    activitate({ id: 'a2', name: 'Fără copii' }),
  ] as never)
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Dezactivează Fără copii' }))
  await waitFor(() => expect(setClubActivityActive).toHaveBeenCalledWith('a2', false))
  expect(toast.success).toHaveBeenCalledWith('Fără copii a fost dezactivată.')
  await user.click(screen.getByRole('button', { name: 'Dezactivează Cu copii' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('Are 2 înscrieri active.')
  expect(setClubActivityActive).toHaveBeenCalledTimes(1)
})

test('antrenorul ieșit din club dă mesajul dedicat', async () => {
  const user = userEvent.setup()
  vi.mocked(setClubActivityActive).mockRejectedValue({ code: '42501' })
  mockedActivities.mockResolvedValue([activitate({ id: 'a1', name: 'Atelier' })] as never)
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Dezactivează Atelier' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'Nu poți modifica această activitate: antrenorul ei nu face parte din club.',
    ),
  )
})

const SALVATA = {
  id: 'act-1',
  club_id: 'club-1',
  name: 'Atelier de înot',
  sport_id: SPORT,
  location_id: LOC,
  coach_id: ANTRENOR,
  activity_date: '2099-10-03',
  start_time: '10:00:00',
  end_time: '11:00:00',
  price: 4000,
  currency: 'RON',
  eur_ron_rate_micros: null,
  capacity: null,
  description: 'Descriere',
  hero_photo_storage_path: 'act-1/hero/a.jpg',
}

test('cu înscrieri, sportul, locația și prețul rămân cele salvate', async () => {
  const user = userEvent.setup()
  vi.mocked(getClubActivityById).mockResolvedValue(SALVATA as never)
  vi.mocked(getClubActivityEnrollmentCounts).mockResolvedValue(
    new Map([['act-1', { active: 0, pending: 1 }]]),
  )
  renderPage('/club/activities/act-1/edit')
  expect(await screen.findByDisplayValue('Atelier de înot')).toBeInTheDocument()
  expect(screen.getByText('Sportul rămâne cel salvat: activitatea are înscrieri.')).toBeInTheDocument()
  expect(screen.getByText('Locația rămâne cea salvată: activitatea are înscrieri.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Preț \(lei\)/)).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(updateClubActivity).toHaveBeenCalled())
  expect(vi.mocked(updateClubActivity).mock.calls[0][1]).toMatchObject({
    sport_id: SPORT,
    location_id: LOC,
    price: 4000,
    currency: 'RON',
  })
})

test('fără înscrieri câmpurile rămân editabile', async () => {
  vi.mocked(getClubActivityById).mockResolvedValue(SALVATA as never)
  renderPage('/club/activities/act-1/edit')
  expect(await screen.findByDisplayValue('Atelier de înot')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Preț \(lei\)/)).not.toBeDisabled()
  expect(screen.queryByText(/rămâne cel salvat/)).not.toBeInTheDocument()
})

test('dacă înscrierile nu se pot citi, formularul nu apare și se poate reîncerca', async () => {
  vi.mocked(getClubActivityById).mockResolvedValue(SALVATA as never)
  vi.mocked(getClubActivityEnrollmentCounts).mockRejectedValue(new Error('retea'))
  renderPage('/club/activities/act-1/edit')
  expect(await screen.findByText('Nu am putut încărca activitatea.')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Editează activitatea' })).not.toBeInTheDocument()
})
