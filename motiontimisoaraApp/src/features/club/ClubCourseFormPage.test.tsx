import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import ClubCourseFormPage from './ClubCourseFormPage'
import {
  createClubCourse,
  getClubCourseById,
  getClubRosterForSelect,
  getClubSelectableLocations,
  getMyClub,
} from '@/api/club'
import { fetchSports } from '@/api/sports'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubSelectableLocations: vi.fn(),
  getClubRosterForSelect: vi.fn(),
  getClubCourseById: vi.fn(),
  createClubCourse: vi.fn(),
  updateClubCourse: vi.fn(),
}))
vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedClub = vi.mocked(getMyClub)
const mockedLocations = vi.mocked(getClubSelectableLocations)
const mockedRoster = vi.mocked(getClubRosterForSelect)
const mockedSports = vi.mocked(fetchSports)
const mockedExisting = vi.mocked(getClubCourseById)

const ANTRENOR = 'add649ab-2e81-49d6-952d-31417215b770'
const LOC_COMUNA = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const SPORT = '4c7a30c1-42a4-4bad-839c-f03d2b90e88a'

function renderForm(ruta = '/club/courses/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/club/courses/new" element={<ClubCourseFormPage />} />
          <Route path="/club/courses/:id/edit" element={<ClubCourseFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedClub.mockResolvedValue({ id: 'club-1', name: 'UI Audit Club TM' } as never)
  mockedSports.mockResolvedValue([{ id: SPORT, name: 'Înot' }] as never)
  mockedRoster.mockResolvedValue([{ user_id: ANTRENOR, name: 'Audit Antrenor' }] as never)
  mockedLocations.mockResolvedValue([{ id: LOC_COMUNA, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' }] as never)
})

// --- Criteriul 1: precompletarea nu mai pierde antrenorul si locatia ---
test('la editare, antrenorul salvat apare selectat chiar dacă lista lui vine după curs', async () => {
  // Cursul se rezolvă imediat, listele mai târziu — exact ordinea care spărgea
  // select-urile: `reset` punea o valoare fără `<option>`, iar efectul nu se relua.
  mockedExisting.mockResolvedValue({
    id: 'c1',
    name: 'Înot avansat',
    sport_id: SPORT,
    location_id: LOC_COMUNA,
    coach_id: ANTRENOR,
    level: 'avansat',
    age_from: 9,
    age_to: 14,
    capacity: 14,
    price_per_session: 7500,
    description: '',
  } as never)
  mockedRoster.mockImplementation(
    () => new Promise((r) => setTimeout(() => r([{ user_id: ANTRENOR, name: 'Audit Antrenor' }] as never), 40)),
  )

  renderForm('/club/courses/c1/edit')
  await screen.findByDisplayValue('Înot avansat')

  await waitFor(() => {
    expect(screen.getByLabelText('Antrenor')).toHaveValue(ANTRENOR)
    expect(screen.getByLabelText('Locație')).toHaveValue(LOC_COMUNA)
  })
})

// --- Criteriul 4: selectul include si salile comune ale platformei ---
test('selectul de locație folosește lista utilizabilă, nu doar locațiile proprii', async () => {
  renderForm()
  // Selectul se randează imediat; abia opțiunea dovedește că lista a sosit.
  expect(await screen.findByRole('option', { name: 'Bazin Olimpic Timișoara' })).toBeInTheDocument()
  // La creare nu exista curs, deci nicio locatie de pastrat.
  expect(mockedLocations).toHaveBeenCalledWith('club-1', null)
  expect(within(screen.getByLabelText('Locație')).getByText('Bazin Olimpic Timișoara')).toBeInTheDocument()
})

// Regresie (Bugbot): filtrul `is_active` nu are voie sa scoata din lista locatia
// deja pusa pe curs. Altfel editarea unui curs a carui sala a fost dezactivata
// pierde locatia — exact esecul pe care acest set de schimbari il repara.
test('locația dezactivată a unui curs rămâne în listă la editare', async () => {
  mockedExisting.mockResolvedValue({
    id: 'c1', name: 'Înot avansat', sport_id: SPORT, location_id: 'loc-inactiva', coach_id: ANTRENOR,
    level: 'avansat', age_from: 9, age_to: 14, capacity: 14, price_per_session: 7500, description: '',
  } as never)
  mockedLocations.mockResolvedValue([
    { id: LOC_COMUNA, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
    { id: 'loc-inactiva', name: 'Sala Închisă', city: 'Timișoara' },
  ] as never)

  renderForm('/club/courses/c1/edit')
  await screen.findByDisplayValue('Înot avansat')

  // Interogarea primeste locatia curenta, ca sa o poata pastra chiar inactiva.
  await waitFor(() => expect(mockedLocations).toHaveBeenCalledWith('club-1', 'loc-inactiva'))
  await waitFor(() => expect(screen.getByLabelText('Locație')).toHaveValue('loc-inactiva'))
})

// --- Criteriul 3: fiecare camp gresit e marcat si legat de mesajul lui ---
test('validarea marchează toate câmpurile greșite și leagă fiecare mesaj de câmpul lui', async () => {
  const user = userEvent.setup()
  renderForm()
  await screen.findByLabelText('Nume curs')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  for (const eticheta of ['Nume curs', 'Antrenor', 'Sport', 'Locație', 'Preț / ședință (lei)']) {
    const camp = screen.getByLabelText(eticheta)
    await waitFor(() => expect(camp).toHaveAttribute('aria-invalid', 'true'))
    const id = camp.getAttribute('aria-describedby')
    expect(id, `${eticheta} nu are aria-describedby`).toBeTruthy()
    expect(document.getElementById(id as string)?.textContent).toBeTruthy()
  }
  // Câmpurile opționale nu se marchează degeaba.
  expect(screen.getByLabelText('Capacitate')).not.toHaveAttribute('aria-invalid', 'true')
})

// --- Criteriul 2: tinta de tap sub 1024 px ---
test('câmpurile și acțiunea de trimitere cresc la 44 px sub 1024 px', async () => {
  renderForm()
  const nume = await screen.findByLabelText('Nume curs')
  expect(nume.className).toMatch(/(^| )h-11( |$)/)
  expect(nume.className).toMatch(/lg:h-9/)
  const select = screen.getByLabelText('Antrenor')
  expect(select.className).toMatch(/(^| )h-11( |$)/)
  expect(select.className).toMatch(/lg:h-9/)
  const salveaza = screen.getByRole('button', { name: 'Salvează' })
  expect(salveaza.className).toMatch(/(^| )h-11( |$)/)
  expect(salveaza.className).toMatch(/lg:h-9/)
})

// --- Criteriul 7: fara select gol neexplicat ---
test('mesajul „Adaugă o locație” apare doar când nu există nicio locație utilizabilă', async () => {
  mockedLocations.mockResolvedValue([])
  const { unmount } = renderForm()
  expect(await screen.findByText(/Nu ai locații/)).toBeInTheDocument()
  unmount()

  mockedLocations.mockResolvedValue([{ id: LOC_COMUNA, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' }] as never)
  renderForm()
  await screen.findByRole('option', { name: 'Bazin Olimpic Timișoara' })
  expect(screen.queryByText(/Nu ai locații/)).not.toBeInTheDocument()
})

// --- Criteriul 5: salvarea reusita duce in lista, cu mesaj ---
test('salvarea reușită creează cursul și duce înapoi în listă', async () => {
  const user = userEvent.setup()
  vi.mocked(createClubCourse).mockResolvedValue(undefined as never)
  renderForm()
  await user.type(await screen.findByLabelText('Nume curs'), 'Curs nou de test')
  await user.selectOptions(screen.getByLabelText('Antrenor'), ANTRENOR)
  await user.selectOptions(screen.getByLabelText('Sport'), SPORT)
  await user.selectOptions(screen.getByLabelText('Locație'), LOC_COMUNA)
  await user.type(screen.getByLabelText('Preț / ședință (lei)'), '80')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  await waitFor(() => expect(createClubCourse).toHaveBeenCalled())
  const { toast } = await import('sonner')
  expect(toast.success).toHaveBeenCalledWith('Curs creat.')
})

// --- Criteriul 6: salvarea esuata pastreaza ce ai scris ---
test('salvarea eșuată păstrează valorile completate și anunță eroarea', async () => {
  const user = userEvent.setup()
  vi.mocked(createClubCourse).mockRejectedValue(new Error('500'))
  renderForm()
  await user.type(await screen.findByLabelText('Nume curs'), 'Curs care nu se salvează')
  await user.selectOptions(screen.getByLabelText('Antrenor'), ANTRENOR)
  await user.selectOptions(screen.getByLabelText('Sport'), SPORT)
  await user.selectOptions(screen.getByLabelText('Locație'), LOC_COMUNA)
  await user.type(screen.getByLabelText('Preț / ședință (lei)'), '80')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  const { toast } = await import('sonner')
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nu am putut salva cursul.'))
  // Într-un formular cu 10 câmpuri, pierderea datelor la eroare e cel mai scump lucru.
  expect(screen.getByLabelText('Nume curs')).toHaveValue('Curs care nu se salvează')
  expect(screen.getByLabelText('Preț / ședință (lei)')).toHaveValue(80)
})

// --- Criteriul 8: structura si titlurile celor doua moduri ---
test('titlul urmează modul: „Curs nou” la creare, „Editează curs” la editare', async () => {
  const { unmount } = renderForm()
  expect(await screen.findByRole('heading', { name: 'Curs nou' })).toBeInTheDocument()
  unmount()

  mockedExisting.mockResolvedValue({
    id: 'c1', name: 'Înot avansat', sport_id: SPORT, location_id: LOC_COMUNA, coach_id: ANTRENOR,
    level: 'avansat', age_from: 9, age_to: 14, capacity: 14, price_per_session: 7500, description: '',
  } as never)
  renderForm('/club/courses/c1/edit')
  expect(await screen.findByRole('heading', { name: 'Editează curs' })).toBeInTheDocument()
})
