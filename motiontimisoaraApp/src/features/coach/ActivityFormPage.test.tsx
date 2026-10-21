import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ActivityFormPage from './ActivityFormPage'
import {
  activitateaAreInscrieri,
  createActivity,
  getActivityById,
  getSelectableLocations,
  updateActivity,
} from '@/api/coach'
import { fetchSports } from '@/api/sports'
import { getCursBnr } from '@/api/bnr-rate'

vi.mock('@/api/coach', () => ({
  activitateaAreInscrieri: vi.fn().mockResolvedValue(false),
  getSelectableLocations: vi.fn(),
  getActivityById: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
}))
vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('@/api/bnr-rate', async () => {
  const real = await vi.importActual<typeof import('@/api/bnr-rate')>('@/api/bnr-rate')
  return { ...real, getCursBnr: vi.fn() }
})
vi.mock('@/api/offer-hero', () => ({
  schimbaPozaOferta: vi.fn().mockResolvedValue('a/hero/a.jpg'),
  renuntaLaOfertaFaraHero: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const LOC = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const SPORT = '4c7a30c1-42a4-4bad-839c-f03d2b90e88a'
const mockedCreate = vi.mocked(createActivity)
const mockedUpdate = vi.mocked(updateActivity)

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/coach/activities/new']}>
        <Routes>
          <Route path="/coach/activities/new" element={<ActivityFormPage />} />
          <Route path="/coach/activities" element={<p>Lista activități</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(activitateaAreInscrieri).mockResolvedValue(false)
  vi.mocked(fetchSports).mockResolvedValue([{ id: SPORT, name: 'Înot' }] as never)
  vi.mocked(getSelectableLocations).mockResolvedValue([
    { id: LOC, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
  ] as never)
  vi.mocked(getCursBnr).mockResolvedValue({ date: '2026-09-19', eur_ron_millionths: 5123456 })
})

test('EUR citește cursul BNR și îl îngheață pe activitate', async () => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'a-eur' } as never)
  renderForm()
  await user.type(await screen.findByLabelText(/^Nume/), 'Open water euro')
  await user.selectOptions(screen.getByLabelText(/^Sport/), SPORT)
  await user.selectOptions(screen.getByLabelText(/^Locație/), LOC)
  fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText(/^Ora început/), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText(/^Ora final/), { target: { value: '11:00' } })
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Curs BNR din 19.09.2026: 5,123456 lei/EUR')).toBeInTheDocument()
  expect(screen.queryByLabelText('Cursul tău: 1 EUR în lei')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Preț \(EUR\)/), '15')
  await user.type(screen.getByLabelText(/^Descriere/), 'Ieșire pe lac.')
  fireEvent.change(screen.getByLabelText('Poza din capul paginii'), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toMatchObject({
    currency: 'EUR',
    eur_ron_rate_micros: 5123456,
    price: 1500,
  })
})

test('fără poza din cap, activitatea nu se salvează', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(await screen.findByLabelText(/^Nume/), 'Fără poză')
  await user.selectOptions(screen.getByLabelText(/^Sport/), SPORT)
  await user.selectOptions(screen.getByLabelText(/^Locație/), LOC)
  fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText(/^Ora început/), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText(/^Ora final/), { target: { value: '11:00' } })
  await user.type(screen.getByLabelText(/^Preț \(lei\)/), '20')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Poza din capul paginii este obligatorie.',
  )
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('fără curs BNR, EUR blochează salvarea activității', async () => {
  vi.mocked(getCursBnr).mockRejectedValue(new Error('Nu am putut citi cursul BNR. Reîncearcă.'))
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Nu am putut citi cursul BNR. Reîncearcă.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  expect(mockedCreate).not.toHaveBeenCalled()
})

async function completeaza(user: ReturnType<typeof userEvent.setup>, descriere = 'Ieșire pe lac.') {
  await user.type(await screen.findByLabelText(/^Nume/), 'Open water')
  await user.selectOptions(screen.getByLabelText(/^Sport/), SPORT)
  await user.selectOptions(screen.getByLabelText(/^Locație/), LOC)
  fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText(/^Ora început/), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText(/^Ora final/), { target: { value: '11:00' } })
  await user.type(screen.getByLabelText(/^Preț \(lei\)/), '20')
  if (descriere) await user.type(screen.getByLabelText(/^Descriere/), descriere)
  fireEvent.change(screen.getByLabelText('Poza din capul paginii'), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
}

test('frazele de fus și de capacitate stau pe formular, iar poza folosește fraza scurtă', async () => {
  renderForm()
  expect(await screen.findByText('Orele sunt în fusul României.')).toBeInTheDocument()
  expect(screen.getByText('Lasă gol dacă nu ai limită.')).toBeInTheDocument()
  expect(screen.getByLabelText('Capacitate')).toHaveValue(null)
  expect(screen.getByLabelText('Vârstă minimă')).toHaveValue(null)
  expect(screen.getByLabelText('Vârstă maximă')).toHaveValue(null)
  expect(
    screen.getByText('Lasă gol dacă nu ai limită. Poți completa doar una.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  expect(screen.getByText('Poza din capul paginii este obligatorie.')).toBeInTheDocument()
  expect(
    screen.queryByText(
      'Obligatorie. Se vede în banda de deasupra titlului, pe pagina publică. Galeria rămâne separată.',
    ),
  ).not.toBeInTheDocument()
})

test('ora final înainte de început oprește salvarea', async () => {
  const user = userEvent.setup()
  renderForm()
  await completeaza(user)
  fireEvent.change(screen.getByLabelText(/^Ora final/), { target: { value: '08:00' } })
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(
    await screen.findByText('Ora final trebuie să fie după ora de început.'),
  ).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('data și orele goale spun ce trebuie ales', async () => {
  const user = userEvent.setup()
  renderForm()
  await screen.findByLabelText(/^Nume/)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Alege data.')).toBeInTheDocument()
  expect(screen.getByText('Alege ora de început.')).toBeInTheDocument()
  expect(screen.getByText('Alege ora de final.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Data/)).toHaveAttribute('aria-describedby', 'activity_date-error')
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('descrierea goală oprește salvarea', async () => {
  const user = userEvent.setup()
  renderForm()
  await completeaza(user, '')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Descrierea este obligatorie.')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('capacitatea goală se salvează fără limită de locuri', async () => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'a-cap' } as never)
  renderForm()
  await completeaza(user)
  expect(screen.getByLabelText('Capacitate')).toHaveValue(null)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toMatchObject({
    capacity: null,
    description: 'Ieșire pe lac.',
    age_from: null,
    age_to: null,
  })
})

test.each([
  ['doar vârstă minimă', '8', '', 8, null],
  ['doar vârstă maximă', '', '12', null, 12],
  ['ambele vârste', '8', '12', 8, 12],
  ['nicio vârstă', '', '', null, null],
])('se salvează cu %s', async (_caz, minim, maxim, ageFrom, ageTo) => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'a-varsta' } as never)
  renderForm()
  await completeaza(user)
  if (minim) fireEvent.change(screen.getByLabelText('Vârstă minimă'), { target: { value: minim } })
  if (maxim) fireEvent.change(screen.getByLabelText('Vârstă maximă'), { target: { value: maxim } })
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toMatchObject({ age_from: ageFrom, age_to: ageTo })
})

test('editarea precompletează vârstele salvate', async () => {
  vi.mocked(getActivityById).mockResolvedValue({
    id: 'act-1',
    name: 'Activitate salvată',
    sport_id: SPORT,
    location_id: LOC,
    activity_date: '2027-07-10',
    start_time: '09:00:00',
    end_time: '11:00:00',
    price: 2000,
    capacity: null,
    description: 'Ieșire de probă.',
    currency: 'RON',
    eur_ron_rate_micros: null,
    age_from: 8,
    age_to: null,
    hero_photo_storage_path: 'act-1/hero/a.jpg',
  } as never)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/coach/activities/act-1/edit']}>
        <Routes>
          <Route path="/coach/activities/:id/edit" element={<ActivityFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByLabelText('Vârstă minimă')).toHaveValue(8))
  expect(screen.getByLabelText('Vârstă maximă')).toHaveValue(null)
  expect(mockedUpdate).not.toHaveBeenCalled()
})

const SALVATA = {
  id: 'act-1',
  name: 'Activitate salvată',
  sport_id: SPORT,
  location_id: LOC,
  activity_date: '2027-07-10',
  start_time: '09:00:00',
  end_time: '11:00:00',
  price: 2000,
  capacity: null,
  description: 'Ieșire de probă.',
  currency: 'RON',
  eur_ron_rate_micros: null,
  age_from: null,
  age_to: null,
  hero_photo_storage_path: 'act-1/hero/a.jpg',
}

function renderEdit() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/coach/activities/act-1/edit']}>
        <Routes>
          <Route path="/coach/activities/:id/edit" element={<ActivityFormPage />} />
          <Route path="/coach/activities" element={<p>Lista activități</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('numele prea scurt spune ce lipsește', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(await screen.findByLabelText(/^Nume/), 'Ab')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Numele are cel puțin 3 caractere.')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('editarea arată schelete cât se încarcă, fără formular gol', async () => {
  vi.mocked(getActivityById).mockReturnValue(new Promise(() => {}))
  renderEdit()
  expect(await screen.findByRole('status', { name: 'Se încarcă activitatea' })).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Nume/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Înapoi/ })).toBeInTheDocument()
})

test('cu înscrieri, sportul, locația și prețul rămân cele salvate', async () => {
  const user = userEvent.setup()
  vi.mocked(getActivityById).mockResolvedValue(SALVATA as never)
  vi.mocked(activitateaAreInscrieri).mockResolvedValue(true)
  mockedUpdate.mockResolvedValue(undefined as never)
  renderEdit()
  await waitFor(() => expect(screen.getByLabelText(/^Preț/)).toBeDisabled())
  expect(screen.getByLabelText(/^Sport/)).toBeDisabled()
  expect(screen.getByLabelText(/^Locație/)).toBeDisabled()
  expect(
    screen.getByText('Sportul rămâne cel salvat: activitatea are înscrieri.'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('Locația rămâne cea salvată: activitatea are înscrieri.'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('Prețul rămâne cel salvat: activitatea are înscrieri.'),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
  expect(mockedUpdate.mock.calls[0][1]).toMatchObject({
    sport_id: SPORT,
    location_id: LOC,
    price: 2000,
  })
})

test('fără înscrieri, câmpurile rămân editabile', async () => {
  vi.mocked(getActivityById).mockResolvedValue(SALVATA as never)
  renderEdit()
  await waitFor(() => expect(screen.getByLabelText(/^Nume/)).toHaveValue('Activitate salvată'))
  expect(screen.getByLabelText(/^Preț/)).toBeEnabled()
  expect(screen.queryByText(/activitatea are înscrieri/)).not.toBeInTheDocument()
})

test('cu modificări nesalvate, Anulează întreabă înainte de plecare', async () => {
  const user = userEvent.setup()
  vi.mocked(getActivityById).mockResolvedValue(SALVATA as never)
  renderEdit()
  const nume = await screen.findByLabelText(/^Nume/)
  await waitFor(() => expect(nume).toHaveValue('Activitate salvată'))
  await user.type(nume, ' nouă')
  await user.click(screen.getByRole('link', { name: 'Anulează' }))
  expect(await screen.findByRole('dialog', { name: 'Renunți la modificări?' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Rămân' }))
  expect(screen.getByLabelText(/^Nume/)).toHaveValue('Activitate salvată nouă')
  await user.click(screen.getByRole('link', { name: /Înapoi/ }))
  await user.click(await screen.findByRole('button', { name: 'Renunț' }))
  expect(await screen.findByText('Lista activități')).toBeInTheDocument()
})

test('fără modificări, Anulează pleacă direct', async () => {
  const user = userEvent.setup()
  vi.mocked(getActivityById).mockResolvedValue(SALVATA as never)
  renderEdit()
  await waitFor(() => expect(screen.getByLabelText(/^Nume/)).toHaveValue('Activitate salvată'))
  await user.click(screen.getByRole('link', { name: 'Anulează' }))
  expect(await screen.findByText('Lista activități')).toBeInTheDocument()
})
