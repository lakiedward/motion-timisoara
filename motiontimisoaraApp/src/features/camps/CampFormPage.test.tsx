import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { toast } from 'sonner'

import CampFormPage from './CampFormPage'
import type { CampPortalBaza } from './camp-portal'
import {
  getCategoriile,
  getPreturilePeVarsta,
  getTabaraDeEditat,
  getTaberelemele,
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
  camp_requirements: [],
  rules: null,
}

const BAZIN = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const CABANA = '1f0f4d5e-7c3a-4b1e-9a2f-0c6e8d7b5a41'
const PORTALE: CampPortalBaza[] = ['/club/camps', '/coach/camps', '/admin/camps']

function renderForm(ruta = '/club/camps/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          {PORTALE.flatMap((baza) => [
            <Route
              key={`${baza}-new`}
              path={`${baza}/new`}
              element={<CampFormPage baza={baza} />}
            />,
            <Route
              key={`${baza}-edit`}
              path={`${baza}/:id/edit`}
              element={<CampFormPage baza={baza} />}
            />,
          ])}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function completeazaDetalii(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Titlu'), 'Tabără de înot')
  await user.type(screen.getByLabelText('Adresa paginii'), 'tabara-inot')
  fireEvent.change(screen.getByLabelText('Începe'), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText('Se termină'), { target: { value: '2027-07-17' } })
}

async function laCosturi(user: ReturnType<typeof userEvent.setup>) {
  await completeazaDetalii(user)
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Categorii și costuri' })
}

async function completeazaCategorie(
  user: ReturnType<typeof userEvent.setup>,
  rand: HTMLElement,
  deLa: string,
  panaLa: string,
  componente: { name: string; lei: string }[],
) {
  await user.type(within(rand).getByLabelText('De la (ani)'), deLa)
  await user.type(within(rand).getByLabelText('Până la (ani)'), panaLa)
  await user.type(within(rand).getAllByLabelText('Componentă')[0], componente[0].name)
  await user.type(within(rand).getAllByLabelText(/Sumă \(/)[0], componente[0].lei)
  for (let i = 1; i < componente.length; i++) {
    await user.click(within(rand).getByRole('button', { name: 'Adaugă o componentă' }))
    const names = within(rand).getAllByLabelText('Componentă')
    await user.type(names[names.length - 1], componente[i].name)
    const sume = within(rand).getAllByLabelText(/Sumă \(/)
    await user.type(sume[sume.length - 1], componente[i].lei)
  }
}

function randuriCategorii() {
  return screen.getAllByRole('listitem', { name: /Categoria de vârstă/ })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTaberelemele).mockResolvedValue([] as never)
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([] as never)
  vi.mocked(getClubSelectableLocations).mockResolvedValue([
    { id: BAZIN, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
    { id: CABANA, name: 'Cabana Muntele Mic', city: null },
  ])
  vi.mocked(getSelectableLocations).mockResolvedValue([])
})

test('draftul pornește pe Detalii, cu banner de prototip, fără preț global', () => {
  renderForm()
  expect(screen.getByRole('status')).toHaveTextContent(/Draft local/)
  expect(screen.getByRole('heading', { name: 'Detalii' })).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Pașii formularului' })).toHaveTextContent(
    '1Detalii2Categorii și costuri3Verificare',
  )
  expect(screen.queryByLabelText(/Prețul taberei/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Creează tabăra' })).not.toBeInTheDocument()
})

test('tabăra alege locul din locațiile clubului', async () => {
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

test('la editare, necesarul salvat poate primi categorii și articole numerotate', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    camp_requirements: [{ name: 'Haine', items: [{ name: 'Chiloți', quantity: 7 }] }],
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')

  await waitFor(() => expect(screen.getByLabelText('Categorie')).toHaveValue('Haine'))
  expect(screen.getByLabelText('Articol')).toHaveValue('Chiloți')
  expect(screen.getByLabelText('Număr')).toHaveValue(7)
  await user.click(screen.getByRole('button', { name: 'Adaugă categorie' }))
  await user.type(screen.getAllByLabelText('Categorie')[1], 'Ski')
  await user.click(screen.getAllByRole('button', { name: 'Adaugă articol' })[1])
  await user.type(screen.getAllByLabelText('Articol')[1], 'Schiuri')
  await user.type(screen.getAllByLabelText('Număr')[1], '1')
  expect(screen.getAllByLabelText('Categorie')[1]).toHaveValue('Ski')
})

test('regulamentul se păstrează în draft când revii de pe costuri', async () => {
  const user = userEvent.setup()
  renderForm()
  await completeazaDetalii(user)
  fireEvent.change(screen.getByLabelText('Regulamentul taberei'), {
    target: { value: 'Fără telefoane.\nFără dulciuri seara.' },
  })
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Categorii și costuri' })
  await user.click(screen.getByRole('button', { name: 'Înapoi' }))
  expect(screen.getByLabelText('Regulamentul taberei')).toHaveValue(
    'Fără telefoane.\nFără dulciuri seara.',
  )
})

test('la editare, regulamentul salvat revine în formular', async () => {
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    rules: 'Fără telefoane.',
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')
  await waitFor(() =>
    expect(screen.getByLabelText('Regulamentul taberei')).toHaveValue('Fără telefoane.'),
  )
})

test.each(PORTALE)(
  'perioada pe %s arată durata inclusiv și o scurtătură mută sfârșitul',
  async (baza) => {
    const user = userEvent.setup()
    renderForm(`${baza}/new`)
    expect(screen.getByRole('group', { name: 'Perioada taberei' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7 zile' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Începe'), { target: { value: '2027-07-10' } })
    expect(screen.getByLabelText('Se termină')).toHaveValue('2027-07-10')
    expect(screen.getByText(/· 1 zi/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '7 zile' }))
    expect(screen.getByLabelText('Se termină')).toHaveValue('2027-07-16')
    expect(screen.getByText(/· 7 zile/)).toBeInTheDocument()
  },
)

test.each(PORTALE)('un început după sfârșit pe %s mută sfârșitul pe aceeași zi', (baza) => {
  renderForm(`${baza}/new`)
  fireEvent.change(screen.getByLabelText('Începe'), { target: { value: '2027-07-10' } })
  fireEvent.change(screen.getByLabelText('Se termină'), { target: { value: '2027-07-12' } })
  fireEvent.change(screen.getByLabelText('Începe'), { target: { value: '2027-07-18' } })
  expect(screen.getByLabelText('Se termină')).toHaveValue('2027-07-18')
  expect(screen.getByText(/· 1 zi/)).toBeInTheDocument()
})

test.each(PORTALE)('la editare pe %s, intervalul salvat arată durata inclusivă', async (baza) => {
  vi.mocked(getTabaraDeEditat).mockResolvedValue(TABARA as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm(`${baza}/tabara-1/edit`)
  await screen.findByDisplayValue('Tabără de înot')
  expect(screen.getByLabelText('Începe')).toHaveValue('2026-09-13')
  expect(screen.getByLabelText('Se termină')).toHaveValue('2026-09-20')
  expect(screen.getByText(/· 8 zile/)).toBeInTheDocument()
})

test('fără titlu, pasul Detalii nu avansează', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findAllByText('Minim 3 caractere')).not.toHaveLength(0)
  expect(screen.getByRole('heading', { name: 'Detalii' })).toBeInTheDocument()
})

test('componentele adună totalul, iar Înapoi păstrează draftul', async () => {
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  const prima = randuriCategorii()[0]
  await completeazaCategorie(user, prima, '6', '8', [
    { name: 'Cazare', lei: '400' },
    { name: 'Masă', lei: '200' },
    { name: 'Antrenamente', lei: '100' },
  ])
  expect(within(prima).getByText(/Total 700,00 lei/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Înapoi' }))
  expect(screen.getByLabelText('Titlu')).toHaveValue('Tabără de înot')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(screen.getByLabelText('De la (ani)')).toHaveValue(6)
  expect(screen.getByDisplayValue('Cazare')).toBeInTheDocument()
  expect(screen.getByText(/Total 700,00 lei/)).toBeInTheDocument()
})

test('Marchează gratuit pune categoria pe zero', async () => {
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  const prima = randuriCategorii()[0]
  await completeazaCategorie(user, prima, '0', '2', [{ name: 'Cazare', lei: '50' }])
  await user.click(within(prima).getByRole('button', { name: 'Marchează gratuit' }))
  expect(await within(prima).findByDisplayValue('Participare')).toBeInTheDocument()
  expect(within(prima).getByLabelText(/Sumă \(/)).toHaveValue(0)
  expect(within(prima).getByText(/Total Gratuit/)).toBeInTheDocument()
})

test('două intervale care se suprapun opresc avansul și numesc perechea', async () => {
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  await completeazaCategorie(user, randuriCategorii()[0], '6', '8', [
    { name: 'Cazare', lei: '700' },
  ])
  await user.click(screen.getByRole('button', { name: 'Adaugă o categorie de vârstă' }))
  const randuri = randuriCategorii()
  await completeazaCategorie(user, randuri[randuri.length - 1], '8', '10', [
    { name: 'Cazare', lei: '800' },
  ])
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Categoria 6–8 ani se suprapune cu 8–10 ani',
  )
  expect(screen.getByRole('heading', { name: 'Categorii și costuri' })).toBeInTheDocument()
})

test('EUR cere cursul, iar verificarea arată componentele și totalul', async () => {
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  await completeazaCategorie(user, randuriCategorii()[0], '6', '12', [
    { name: 'Cazare', lei: '100' },
    { name: 'Masă', lei: '23.45' },
  ])
  await user.click(screen.getByRole('button', { name: 'Adaugă o categorie de vârstă' }))
  const randuri = randuriCategorii()
  await completeazaCategorie(user, randuri[randuri.length - 1], '13', '16', [
    { name: 'Cazare', lei: '150' },
  ])
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Introdu un curs pozitiv')
  await user.type(screen.getByLabelText('Cursul tău: 1 EUR în lei'), '5,123456')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Verificare' })
  expect(screen.getByText('EUR, curs 5,123456 lei')).toBeInTheDocument()
  expect(screen.getByText('6–12 ani')).toBeInTheDocument()
  expect(screen.getAllByText('Cazare').length).toBeGreaterThan(0)
  expect(screen.getByText('Masă')).toBeInTheDocument()
  expect(screen.getByText('123,45 EUR')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Păstrează draftul local' }))
  expect(toast.success).toHaveBeenCalledWith(
    'Draft local păstrat. Salvarea în tabără urmează după acest prototip.',
  )
})

test('editing preserves EUR on the cost step', async () => {
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    currency: 'EUR',
    eur_ron_rate_micros: 5123456,
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')
  await screen.findByDisplayValue('Tabără de înot')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Categorii și costuri' })
  expect(screen.getByRole('radio', { name: 'Euro (EUR)' })).toBeChecked()
  expect(screen.getByLabelText('Cursul tău: 1 EUR în lei')).toHaveValue('5.123456')
})

test('la editare, categoriile salvate revin ca o componentă, iar copiază din le înlocuiește', async () => {
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
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  const lista = await screen.findByRole('list', { name: 'Categorii de vârstă' })
  expect(within(lista).getByLabelText(/Sumă \(/)).toHaveValue(700)
  expect(within(lista).getByText(/Total 700,00 lei/)).toBeInTheDocument()
  const select = await screen.findByLabelText('Copiază categoriile din altă tabără')
  expect(
    within(select)
      .getAllByRole('option')
      .map((o) => o.textContent),
  ).toEqual(['alege o tabără…', 'Tabăra de anul trecut'])

  await user.selectOptions(select, 'tabara-2')
  await waitFor(() => expect(within(lista).getAllByLabelText('De la (ani)')).toHaveLength(2))
  expect(getPreturilePeVarsta).toHaveBeenCalledWith('tabara-2')
  const sume = within(lista).getAllByLabelText(/Sumă \(/)
  expect(sume[0]).toHaveValue(650)
  expect(sume[1]).toHaveValue(850)
})
