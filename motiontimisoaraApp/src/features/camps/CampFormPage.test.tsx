import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { toast } from 'sonner'

import CampFormPage from './CampFormPage'
import {
  getCategoriile,
  getPreturilePeVarsta,
  getTabaraDeEditat,
  getTaberelemele,
  saveCampOffer,
} from '@/api/camps-admin'
import { getClubSelectableLocations } from '@/api/club'
import { getSelectableLocations } from '@/api/coach'

vi.mock('@/api/camps-admin', async () => {
  const real = await vi.importActual<typeof import('@/api/camps-admin')>('@/api/camps-admin')
  return {
    ...real,
    getCategoriile: vi.fn(),
    getPreturilePeVarsta: vi.fn(),
    getTabaraDeEditat: vi.fn(),
    getTaberelemele: vi.fn(),
    saveCampOffer: vi.fn(),
  }
})
vi.mock('@/api/club', () => ({ getClubSelectableLocations: vi.fn() }))
vi.mock('@/api/coach', () => ({ getSelectableLocations: vi.fn() }))
vi.mock('./useProprietarTabere', () => ({
  useProprietarTabere: () => ({
    proprietar: { clubId: 'club-1', coachUserId: null },
    gata: true,
    eClub: true,
    eroare: false,
    reincearca: () => {},
  }),
}))
vi.mock('./CampPhotosSection', () => ({ default: () => null }))
vi.mock('./CampCoachesSection', () => ({ default: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const TABARA = {
  id: 'tabara-1',
  title: 'Tabără de înot',
  slug: 'tabara-inot-2026',
  period_start: '2026-09-13',
  period_end: '2026-09-20',
  location_text: 'Băile Herculane',
  capacity: 20,
  price: 90000,
  allow_cash: false,
  description: '',
  hero_photo_storage_path: null,
  pricing_mode: 'single',
  location_id: null,
  club_id: 'club-1',
  coach_id: null,
  currency: 'RON',
  gallery_json: null,
}

const BAZIN = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const CABANA = '1f0f4d5e-7c3a-4b1e-9a2f-0c6e8d7b5a41'

function renderForm(ruta = '/club/camps/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/club/camps/new" element={<CampFormPage baza="/club/camps" />} />
          <Route path="/club/camps/:id/edit" element={<CampFormPage baza="/club/camps" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function completeazaTabara(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Titlu'), 'Tabără de înot')
  await user.type(screen.getByLabelText('Adresa paginii'), 'tabara-inot')
  fireEvent.change(screen.getByLabelText('Începe'), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText('Se termină'), { target: { value: '2027-07-17' } })
  await user.type(screen.getByLabelText('Prețul taberei (lei)'), '900')
}

async function adaugaCategorie(
  user: ReturnType<typeof userEvent.setup>,
  deLa: string,
  panaLa: string,
  lei: string,
) {
  await user.click(screen.getByRole('button', { name: 'Adaugă o categorie de vârstă' }))
  const randuri = within(screen.getByRole('list', { name: 'Categorii de vârstă' })).getAllByRole(
    'listitem',
  )
  const rand = randuri[randuri.length - 1]
  await user.type(within(rand).getByLabelText('De la (ani)'), deLa)
  await user.type(within(rand).getByLabelText('Până la (ani)'), panaLa)
  await user.type(within(rand).getByLabelText('Sumă (lei)'), lei)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveCampOffer).mockResolvedValue(undefined)
  vi.mocked(getTaberelemele).mockResolvedValue([] as never)
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([] as never)
  vi.mocked(getClubSelectableLocations).mockResolvedValue([
    { id: BAZIN, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
    { id: CABANA, name: 'Cabana Muntele Mic', city: null },
  ])
  vi.mocked(getSelectableLocations).mockResolvedValue([])
})
test('retry after an uncertain save reuses the camp identity and complete offer', async () => {
  const user = userEvent.setup()
  vi.mocked(saveCampOffer).mockRejectedValueOnce(new Error('Răspuns pierdut'))
  renderForm()
  await completeazaTabara(user)
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Răspuns pierdut'))
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(saveCampOffer).toHaveBeenCalledTimes(2))
  expect(vi.mocked(saveCampOffer).mock.calls[0]).toEqual(vi.mocked(saveCampOffer).mock.calls[1])
})

test('tabăra alege locul din locațiile clubului, iar salvarea trimite location_id', async () => {
  const user = userEvent.setup()
  renderForm()

  const select = await screen.findByLabelText('Loc')
  await waitFor(() =>
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['— fără loc ales —', 'Bazin Olimpic Timișoara · Timișoara', 'Cabana Muntele Mic']),
  )
  expect(getClubSelectableLocations).toHaveBeenCalledWith('club-1', null)
  expect(getSelectableLocations).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: /Adaugă o locație nouă/ })).toHaveAttribute(
    'href',
    '/club/locations/new',
  )

  await completeazaTabara(user)
  await user.selectOptions(select, CABANA)
  await user.type(screen.getByLabelText('Detalii despre loc'), 'Intrarea din spate')
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))

  await waitFor(() => expect(saveCampOffer).toHaveBeenCalled())
  expect(vi.mocked(saveCampOffer).mock.calls[0][6]).toMatchObject({
    location_id: CABANA,
    location_text: 'Intrarea din spate',
  })
})

test('fără loc ales, location_id pleacă null, nu șir gol', async () => {
  const user = userEvent.setup()
  renderForm()
  await screen.findByLabelText('Loc')

  await completeazaTabara(user)
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))

  await waitFor(() => expect(saveCampOffer).toHaveBeenCalled())
  expect(vi.mocked(saveCampOffer).mock.calls[0][6]).toMatchObject({ location_id: null })
})

test('la editare, locul salvat apare selectat chiar dacă lista vine după tabără', async () => {
  vi.mocked(getTabaraDeEditat).mockResolvedValue({ ...TABARA, location_id: BAZIN } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  vi.mocked(getClubSelectableLocations).mockImplementation(
    () =>
      new Promise((r) =>
        setTimeout(
          () => r([{ id: BAZIN, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' }]),
          40,
        ),
      ),
  )

  renderForm('/club/camps/tabara-1/edit')
  await screen.findByDisplayValue('Tabără de înot')

  await waitFor(() => expect(screen.getByLabelText('Loc')).toHaveValue(BAZIN))
  expect(getClubSelectableLocations).toHaveBeenCalledWith('club-1', BAZIN)
})
test('o tabără nouă pornește pe preț unic, fără categorii de vârstă la vedere', async () => {
  const user = userEvent.setup()
  renderForm()

  expect(screen.getByRole('radio', { name: /Preț unic/ })).toBeChecked()
  expect(screen.queryByRole('list', { name: 'Categorii de vârstă' })).not.toBeInTheDocument()

  await completeazaTabara(user)
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))

  await waitFor(() =>
    expect(saveCampOffer).toHaveBeenCalledWith(
      expect.any(String),
      90000,
      [],
      { currency: 'RON', eur_ron_rate_micros: null },
      'single',
      [],
      expect.any(Object),
      { clubId: 'club-1', coachUserId: null },
    ),
  )
})

test('pe categorii: comutatorul arată lista, iar salvarea trimite intervalele în ani și sumele în bani', async () => {
  const user = userEvent.setup()
  renderForm()

  await completeazaTabara(user)
  await user.click(screen.getByRole('radio', { name: /Pe categorii de vârstă/ }))
  await adaugaCategorie(user, '6', '8', '700')
  await adaugaCategorie(user, '9', '12', '900.5')
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))

  await waitFor(() =>
    expect(saveCampOffer).toHaveBeenCalledWith(
      expect.any(String),
      90000,
      [],
      { currency: 'RON', eur_ron_rate_micros: null },
      'by_age',
      [
        { age_from: 6, age_to: 8, amount: 70000 },
        { age_from: 9, age_to: 12, amount: 90050 },
      ],
      expect.any(Object),
      { clubId: 'club-1', coachUserId: null },
    ),
  )
})
test('două intervale care se suprapun opresc salvarea și numesc perechea', async () => {
  const user = userEvent.setup()
  renderForm()

  await completeazaTabara(user)
  await user.click(screen.getByRole('radio', { name: /Pe categorii de vârstă/ }))
  await adaugaCategorie(user, '6', '8', '700')
  await adaugaCategorie(user, '8', '10', '800')
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Categoria 6–8 ani se suprapune cu 8–10 ani',
  )
  expect(saveCampOffer).not.toHaveBeenCalled()
  expect(saveCampOffer).not.toHaveBeenCalled()
})

test('pe categorii fără nicio categorie nu se poate salva', async () => {
  const user = userEvent.setup()
  renderForm()

  await completeazaTabara(user)
  await user.click(screen.getByRole('radio', { name: /Pe categorii de vârstă/ }))
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Prețul pe categorii are nevoie de cel puțin o categorie de vârstă',
  )
  expect(saveCampOffer).not.toHaveBeenCalled()
})

test('EUR requires an exchange rate and saves the exact source amount with its rate', async () => {
  const user = userEvent.setup()
  renderForm()
  await completeazaTabara(user)
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  const price = screen.getByLabelText('Prețul taberei (EUR)')
  await user.clear(price)
  await user.type(price, '123.45')
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Introdu un curs pozitiv')
  expect(saveCampOffer).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('Cursul tău: 1 EUR în lei'), '5,123456')
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() =>
    expect(saveCampOffer).toHaveBeenCalledWith(
      expect.any(String),
      12345,
      [],
      { currency: 'EUR', eur_ron_rate_micros: 5123456 },
      'single',
      [],
      expect.any(Object),
      { clubId: 'club-1', coachUserId: null },
    ),
  )
})

test('editing preserves EUR and switching to RON clears the saved exchange rate', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    currency: 'EUR',
    eur_ron_rate_micros: 5123456,
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')
  await screen.findByDisplayValue('Tabără de înot')
  expect(screen.getByRole('radio', { name: 'Euro (EUR)' })).toBeChecked()
  expect(screen.getByLabelText('Cursul tău: 1 EUR în lei')).toHaveValue('5.123456')
  await user.click(screen.getByRole('radio', { name: 'Lei (RON)' }))
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(saveCampOffer).toHaveBeenCalledWith(
      'tabara-1',
      90000,
      [],
      { currency: 'RON', eur_ron_rate_micros: null },
      'single',
      [],
      expect.any(Object),
      { clubId: 'club-1', coachUserId: null },
    ),
  )
})

test('la editare, categoriile salvate revin în formular, iar „copiază din" le înlocuiește cu ale altei tabere', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({ ...TABARA, pricing_mode: 'by_age' } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockImplementation(async (campId) =>
    campId === 'tabara-1'
      ? ([
          {
            id: 'p1',
            camp_id: 'tabara-1',
            age_from: 6,
            age_to: 8,
            amount: 70000,
            display_order: 0,
            created_at: '',
          },
        ] as never)
      : ([
          {
            id: 'p2',
            camp_id: 'tabara-2',
            age_from: 7,
            age_to: 9,
            amount: 65000,
            display_order: 0,
            created_at: '',
          },
          {
            id: 'p3',
            camp_id: 'tabara-2',
            age_from: 10,
            age_to: 14,
            amount: 85000,
            display_order: 1,
            created_at: '',
          },
        ] as never),
  )
  vi.mocked(getTaberelemele).mockResolvedValue([
    { ...TABARA, id: 'tabara-1', pricing_mode: 'by_age' },
    { ...TABARA, id: 'tabara-2', title: 'Tabăra de anul trecut', pricing_mode: 'by_age' },
    { ...TABARA, id: 'tabara-3', title: 'Tabără cu preț unic', pricing_mode: 'single' },
  ] as never)

  renderForm('/club/camps/tabara-1/edit')

  await screen.findByDisplayValue('Tabără de înot')
  expect(screen.getByRole('radio', { name: /Pe categorii de vârstă/ })).toBeChecked()
  const lista = await screen.findByRole('list', { name: 'Categorii de vârstă' })
  expect(within(lista).getAllByRole('listitem')).toHaveLength(1)
  expect(within(lista).getByLabelText('Sumă (lei)')).toHaveValue(700)
  const select = await screen.findByLabelText('Copiază categoriile din altă tabără')
  const optiuni = within(select)
    .getAllByRole('option')
    .map((o) => o.textContent)
  expect(optiuni).toEqual(['alege o tabără…', 'Tabăra de anul trecut'])

  await user.selectOptions(select, 'tabara-2')

  await waitFor(() => expect(within(lista).getAllByRole('listitem')).toHaveLength(2))
  expect(getPreturilePeVarsta).toHaveBeenCalledWith('tabara-2')
  const sume = within(lista).getAllByLabelText('Sumă (lei)')
  expect(sume[0]).toHaveValue(650)
  expect(sume[1]).toHaveValue(850)
})
