import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CourseFormPage from './CourseFormPage'
import {
  createCourse,
  cursulAreInscrieri,
  getCourseById,
  getSelectableLocations,
  updateCourse,
} from '@/api/coach'
import { fetchSports } from '@/api/sports'
import { getCursBnr } from '@/api/bnr-rate'
import { findSelectMenuOption, pickSelectMenuValue } from '@/test/select-menu'
import { setPickerValue, pickerValue } from '@/test/pickers'

vi.mock('@/api/coach', () => ({
  getSelectableLocations: vi.fn(),
  getCourseById: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  cursulAreInscrieri: vi.fn(),
}))
vi.mock('@/api/sports', () => ({ fetchSports: vi.fn() }))
vi.mock('@/api/bnr-rate', async () => {
  const real = await vi.importActual<typeof import('@/api/bnr-rate')>('@/api/bnr-rate')
  return { ...real, getCursBnr: vi.fn() }
})
vi.mock('@/api/offer-hero', () => ({
  schimbaPozaOferta: vi.fn().mockResolvedValue('c/hero/a.jpg'),
  renuntaLaOfertaFaraHero: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedLocations = vi.mocked(getSelectableLocations)
const mockedSports = vi.mocked(fetchSports)
const mockedExisting = vi.mocked(getCourseById)
const mockedCreate = vi.mocked(createCourse)
const mockedUpdate = vi.mocked(updateCourse)
const mockedInscrieri = vi.mocked(cursulAreInscrieri)

const LOC = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const SPORT = '4c7a30c1-42a4-4bad-839c-f03d2b90e88a'

function renderForm(ruta = '/coach/courses/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/coach/courses/new" element={<CourseFormPage />} />
          <Route path="/coach/courses/:id/edit" element={<CourseFormPage />} />
          <Route path="/coach/courses" element={<p>Lista cursuri</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function punePozaHero() {
  fireEvent.change(screen.getByLabelText('Poza din capul paginii'), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
}

async function completeazaProgram(user: ReturnType<typeof userEvent.setup>, zi = 'Luni') {
  await user.click(screen.getByRole('button', { name: zi }))
  const grup = screen.getByRole('group', { name: zi })
  setPickerValue(within(grup).getByLabelText('Ora start'), '18:00')
  setPickerValue(within(grup).getByLabelText('Ora final'), '19:30')
}

function cursSalvat(extra: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    name: 'Înot avansat',
    sport_id: SPORT,
    location_id: LOC,
    level: 'avansat',
    age_from: 9,
    age_to: 14,
    capacity: 14,
    price_per_session: 1200,
    description: 'Descriere salvată.',
    hero_photo_storage_path: 'c1/hero/a.jpg',
    currency: 'RON',
    recurrence_rule: JSON.stringify({
      daySchedules: { '3': { start: '16:00', end: '17:00' } },
    }),
    ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedSports.mockResolvedValue([{ id: SPORT, name: 'Înot' }] as never)
  mockedLocations.mockResolvedValue([
    { id: LOC, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
  ] as never)
  mockedInscrieri.mockResolvedValue(false)
  vi.mocked(getCursBnr).mockResolvedValue({ date: '2026-09-19', eur_ron_millionths: 5123456 })
})

test('fără program, salvarea e blocată și cursul nu se creează', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(await screen.findByLabelText(/^Nume curs/), 'Curs fără program')
  await pickSelectMenuValue(screen.getByLabelText(/^Sport/), SPORT)
  await pickSelectMenuValue(screen.getByLabelText(/^Locație/), LOC)
  await user.type(screen.getByLabelText(/^Preț \/ ședință \(lei\)/), '80')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(
    await screen.findByText('Selectează cel puțin o zi și completează orele.'),
  ).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('crearea trimite regula și anunță generarea ședințelor', async () => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'c-new' } as never)
  renderForm()
  await user.type(await screen.findByLabelText(/^Nume curs/), 'Înot de seară')
  await pickSelectMenuValue(screen.getByLabelText(/^Sport/), SPORT)
  await pickSelectMenuValue(screen.getByLabelText(/^Locație/), LOC)
  await user.type(screen.getByLabelText(/^Preț \/ ședință \(lei\)/), '80')
  await user.type(screen.getByLabelText(/^Capacitate/), '12')
  await user.type(screen.getByLabelText(/^Descriere/), 'Înot pentru începători.')
  await completeazaProgram(user)
  punePozaHero()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toMatchObject({
    name: 'Înot de seară',
    recurrence_rule: JSON.stringify({
      daySchedules: { '1': { start: '18:00', end: '19:30' } },
    }),
  })
  const { toast } = await import('sonner')
  expect(toast.success).toHaveBeenCalledWith('Curs creat. Ședințele au fost generate din program.')
  expect(await screen.findByText('Lista cursuri')).toBeInTheDocument()
})

test('la editare, programul salvat apare selectat', async () => {
  mockedExisting.mockResolvedValue({
    id: 'c1',
    name: 'Înot avansat',
    sport_id: SPORT,
    location_id: LOC,
    level: 'avansat',
    age_from: 9,
    age_to: 14,
    capacity: 14,
    price_per_session: 7500,
    description: '',
    recurrence_rule: JSON.stringify({
      daySchedules: { '3': { start: '16:00', end: '17:00' } },
    }),
  } as never)
  mockedUpdate.mockResolvedValue({ id: 'c1' } as never)
  renderForm('/coach/courses/c1/edit')
  await screen.findByDisplayValue('Înot avansat')
  expect(screen.getByRole('button', { name: 'Miercuri' })).toHaveAttribute('aria-pressed', 'true')
  const grup = screen.getByRole('group', { name: 'Miercuri' })
  expect(pickerValue(within(grup).getByLabelText('Ora start'))).toBe('16:00')
  expect(pickerValue(within(grup).getByLabelText('Ora final'))).toBe('17:00')
})

test('EUR citește cursul BNR și îl îngheață pe curs', async () => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'c-eur' } as never)
  renderForm()
  await user.type(await screen.findByLabelText(/^Nume curs/), 'Înot euro')
  await pickSelectMenuValue(screen.getByLabelText(/^Sport/), SPORT)
  await pickSelectMenuValue(screen.getByLabelText(/^Locație/), LOC)
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Curs BNR din 19.09.2026: 5,123456 lei/EUR')).toBeInTheDocument()
  expect(screen.queryByLabelText('Cursul tău: 1 EUR în lei')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText(/^Preț \/ ședință \(EUR\)/), '20')
  await user.type(screen.getByLabelText(/^Capacitate/), '12')
  await user.type(screen.getByLabelText(/^Descriere/), 'Înot pentru începători.')
  await completeazaProgram(user)
  punePozaHero()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toMatchObject({
    currency: 'EUR',
    eur_ron_rate_micros: 5123456,
    price_per_session: 2000,
  })
})

test('fără descriere, salvarea cursului se oprește', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(await screen.findByLabelText(/^Nume curs/), 'Curs fără descriere')
  await pickSelectMenuValue(screen.getByLabelText(/^Sport/), SPORT)
  await pickSelectMenuValue(screen.getByLabelText(/^Locație/), LOC)
  await user.type(screen.getByLabelText(/^Preț \/ ședință \(lei\)/), '80')
  await user.type(screen.getByLabelText(/^Capacitate/), '12')
  await completeazaProgram(user)
  punePozaHero()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Descrierea este obligatorie.')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('fără capacitate, cursul se salvează fără limită de locuri', async () => {
  const user = userEvent.setup()
  mockedCreate.mockResolvedValue({ id: 'c-fara-limita' } as never)
  renderForm()
  await user.type(await screen.findByLabelText(/^Nume curs/), 'Curs fără capacitate')
  await pickSelectMenuValue(screen.getByLabelText(/^Sport/), SPORT)
  await pickSelectMenuValue(screen.getByLabelText(/^Locație/), LOC)
  await user.type(screen.getByLabelText(/^Preț \/ ședință \(lei\)/), '80')
  await user.type(screen.getByLabelText(/^Descriere/), 'Înot pentru începători.')
  await completeazaProgram(user)
  punePozaHero()
  expect(screen.getByLabelText('Capacitate')).toHaveAccessibleDescription(
    'Lasă gol dacă nu ai limită.',
  )
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate.mock.calls[0][0]).toMatchObject({ capacity: null })
})

test('câmpurile sunt grupate în Despre curs, Copii și locuri și Preț', async () => {
  renderForm()
  expect(await screen.findByText('Despre curs')).toBeInTheDocument()
  expect(screen.getByText('Copii și locuri')).toBeInTheDocument()
  expect(screen.getByText('Preț')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Vârstă minimă/)).toHaveAccessibleDescription(
    'Lasă gol dacă nu ai limită. Poți completa doar una.',
  )
})

test('sub vârste stă fraza despre limita opțională, fără toggle', async () => {
  renderForm()
  expect(
    await screen.findByText('Lasă gol dacă nu ai limită. Poți completa doar una.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})

test('fraza de la poza din cap este cea comună tuturor panourilor, iar butonul rămâne Alege o poză', async () => {
  renderForm()
  expect(
    await screen.findByText(
      'Obligatorie. Se vede în banda de deasupra titlului, pe pagina publică. Galeria rămâne separată.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('Alege o poză')).toBeInTheDocument()
})

test('fără curs BNR, EUR blochează salvarea cursului', async () => {
  vi.mocked(getCursBnr).mockRejectedValue(new Error('Nu am putut citi cursul BNR. Reîncearcă.'))
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Nu am putut citi cursul BNR. Reîncearcă.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('la curs nou, sportul și locația rămân pe linie până alegi', async () => {
  renderForm()
  await findSelectMenuOption(await screen.findByLabelText(/^Sport/), 'Înot')
  expect(screen.getByLabelText(/^Sport/)).toHaveAttribute('data-value', '')
  expect(screen.getByLabelText(/^Locație/)).toHaveAttribute('data-value', '')
  expect(
    screen.queryByText('Sportul rămâne cel salvat: cursul are înscrieri.'),
  ).not.toBeInTheDocument()
})

test('sportul și locația salvate rămân după ce listele ajung târziu', async () => {
  let rezolvaSporturi: (valoare: unknown) => void = () => {}
  let rezolvaLocatii: (valoare: unknown) => void = () => {}
  mockedSports.mockReturnValue(
    new Promise((resolve) => {
      rezolvaSporturi = resolve
    }) as never,
  )
  mockedLocations.mockReturnValue(
    new Promise((resolve) => {
      rezolvaLocatii = resolve
    }) as never,
  )
  mockedExisting.mockResolvedValue(cursSalvat() as never)
  renderForm('/coach/courses/c1/edit')
  await screen.findByDisplayValue('Înot avansat')
  expect(screen.getByLabelText(/^Sport/)).toHaveTextContent('')
  expect(screen.getByLabelText(/^Locație/)).toHaveTextContent('')
  rezolvaSporturi([{ id: SPORT, name: 'Înot' }])
  rezolvaLocatii([{ id: LOC, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' }])
  await waitFor(() => {
    expect(screen.getByLabelText(/^Sport/)).toHaveAttribute('data-value', SPORT)
    expect(screen.getByLabelText(/^Locație/)).toHaveAttribute('data-value', LOC)
  })
})

test('înscrierea activă blochează sportul, locația și prețul, iar restul se salvează', async () => {
  const user = userEvent.setup()
  mockedInscrieri.mockResolvedValue(true)
  mockedExisting.mockResolvedValue(cursSalvat() as never)
  mockedUpdate.mockResolvedValue({ id: 'c1' } as never)
  renderForm('/coach/courses/c1/edit')
  await screen.findByDisplayValue('Înot avansat')
  await waitFor(() => expect(screen.getByLabelText(/^Sport/)).toBeDisabled())
  expect(screen.getByLabelText(/^Sport/)).toHaveAttribute('data-value', SPORT)
  expect(screen.getByLabelText(/^Locație/)).toBeDisabled()
  expect(screen.getByLabelText(/^Locație/)).toHaveAttribute('data-value', LOC)
  expect(screen.getByLabelText(/^Preț \/ ședință \(lei\)/)).toBeDisabled()
  expect(screen.getByLabelText(/^Preț \/ ședință \(lei\)/)).toHaveValue(12)
  expect(screen.getByRole('radio', { name: 'Lei (RON)' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Euro (EUR)' })).toBeDisabled()
  expect(screen.getByText('Sportul rămâne cel salvat: cursul are înscrieri.')).toBeInTheDocument()
  expect(screen.getByText('Locația rămâne cea salvată: cursul are înscrieri.')).toBeInTheDocument()
  expect(screen.getByText('Prețul rămâne cel salvat: cursul are înscrieri.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Nume curs/)).toBeEnabled()
  expect(screen.getByLabelText('Nivel')).toBeEnabled()
  expect(screen.getByLabelText('Vârstă minimă')).toBeEnabled()
  expect(screen.getByLabelText(/^Capacitate/)).toBeEnabled()
  expect(screen.getByLabelText(/^Descriere/)).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Luni' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Șterge' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Dezactivează' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Luni' }))
  expect(screen.getByRole('button', { name: 'Luni' })).toHaveAttribute('aria-pressed', 'true')
  const luni = screen.getByRole('group', { name: 'Luni' })
  setPickerValue(within(luni).getByLabelText('Ora start'), '10:00')
  setPickerValue(within(luni).getByLabelText('Ora final'), '11:00')
  await user.type(screen.getByLabelText(/^Descriere/), ' Actualizat.')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
  expect(mockedUpdate.mock.calls[0][1]).toMatchObject({
    sport_id: SPORT,
    location_id: LOC,
    price_per_session: 1200,
    description: 'Descriere salvată. Actualizat.',
  })
  const { toast } = await import('sonner')
  expect(toast.success).toHaveBeenCalledWith(
    'Curs actualizat. Ședințele viitoare urmează programul.',
  )
})

test('fără înscriere, sportul, locația și prețul rămân deschise', async () => {
  mockedExisting.mockResolvedValue(cursSalvat() as never)
  renderForm('/coach/courses/c1/edit')
  await screen.findByDisplayValue('Înot avansat')
  await waitFor(() => expect(mockedInscrieri).toHaveBeenCalledWith('c1'))
  expect(screen.getByLabelText(/^Sport/)).toBeEnabled()
  expect(screen.getByLabelText(/^Locație/)).toBeEnabled()
  expect(screen.getByLabelText(/^Preț \/ ședință \(lei\)/)).toBeEnabled()
  expect(
    screen.queryByText('Sportul rămâne cel salvat: cursul are înscrieri.'),
  ).not.toBeInTheDocument()
})

test('Anulează fără modificări pleacă direct', async () => {
  const user = userEvent.setup()
  mockedExisting.mockResolvedValue(cursSalvat() as never)
  renderForm('/coach/courses/c1/edit')
  await screen.findByDisplayValue('Înot avansat')
  await user.click(screen.getByRole('link', { name: 'Anulează' }))
  expect(await screen.findByText('Lista cursuri')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('Anulează și Înapoi întreabă când editarea are modificări', async () => {
  const user = userEvent.setup()
  mockedExisting.mockResolvedValue(cursSalvat() as never)
  renderForm('/coach/courses/c1/edit')
  await screen.findByDisplayValue('Înot avansat')
  await user.type(screen.getByLabelText(/^Nume curs/), ' x')
  await user.click(screen.getByRole('link', { name: 'Anulează' }))
  expect(
    await screen.findByRole('alertdialog', { name: 'Renunți la modificări?' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Rămân' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Renunț' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Rămân' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^Nume curs/)).toHaveValue('Înot avansat x')
  await user.click(screen.getByRole('link', { name: 'Înapoi la cursuri' }))
  expect(
    await screen.findByRole('alertdialog', { name: 'Renunți la modificări?' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Renunț' }))
  expect(await screen.findByText('Lista cursuri')).toBeInTheDocument()
})

test('la curs nou, Anulează pleacă fără întrebare', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(await screen.findByLabelText(/^Nume curs/), 'Curs nou')
  await user.click(screen.getByRole('link', { name: 'Anulează' }))
  expect(await screen.findByText('Lista cursuri')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('un curs inexistent arată „Cursul nu a fost găsit.” în loc de formular gol', async () => {
  mockedExisting.mockResolvedValue(null)
  renderForm('/coach/courses/c-lipsa/edit')
  expect(await screen.findByText('Cursul nu a fost găsit.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Nume curs')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Salvează' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Înapoi la cursuri' })).toHaveAttribute(
    'href',
    '/coach/courses',
  )
})

test('cât se încarcă cursul nu apare formularul gol', async () => {
  mockedExisting.mockReturnValue(new Promise(() => {}))
  renderForm('/coach/courses/c1/edit')
  expect(await screen.findByRole('status', { name: 'Se încarcă cursul' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Nume curs')).not.toBeInTheDocument()
})

test('dacă citirea cursului eșuează, Reîncearcă îl încarcă din nou', async () => {
  const user = userEvent.setup()
  mockedExisting.mockRejectedValueOnce(new Error('rețea')).mockResolvedValue(cursSalvat() as never)
  renderForm('/coach/courses/c1/edit')
  expect(await screen.findByText('Nu am putut încărca cursul.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByDisplayValue('Înot avansat')).toBeInTheDocument()
})

test('secțiunile cursului au aceeași ordine ca la club și admin', async () => {
  renderForm()
  await screen.findByLabelText(/^Nume curs/)
  const titluri = ['Despre curs', 'Program', 'Copii și locuri', 'Preț', 'Poza din capul paginii']
  const noduri = titluri.map((t) => screen.getByText(t, { selector: '[data-slot="card-title"]' }))
  for (let i = 1; i < noduri.length; i += 1) {
    expect(
      noduri[i - 1].compareDocumentPosition(noduri[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      `${titluri[i - 1]} înainte de ${titluri[i]}`,
    ).toBeTruthy()
  }
  expect(screen.getByLabelText(/^Descriere/)).toBeRequired()
  expect(screen.getByLabelText('Capacitate')).not.toBeRequired()
})
