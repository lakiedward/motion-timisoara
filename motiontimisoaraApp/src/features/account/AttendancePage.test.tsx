import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import AttendancePage from './AttendancePage'
import { getChildAttendance, getChildrenAttendance, getMyChildren } from '@/api/account'

vi.mock('@/api/account', () => ({
  getMyChildren: vi.fn(),
  getChildAttendance: vi.fn(),
  getChildrenAttendance: vi.fn(),
}))

const mockedCopii = vi.mocked(getMyChildren)
const mockedPrezenta = vi.mocked(getChildAttendance)
const mockedPrezentaToti = vi.mocked(getChildrenAttendance)

const COPIL_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const COPIL_B = 'bbbbbbbb-0000-4000-8000-000000000002'

const copii = [
  { id: COPIL_A, name: 'Ana' },
  { id: COPIL_B, name: 'Bogdan' },
]

/** Azi e fixat în teste ca să nu se schimbe rezultatul filtrului odată cu luna. */
const AZI = new Date('2026-08-26T09:00:00Z')

const rand = (
  id: string,
  zi: string,
  status: 'PRESENT' | 'ABSENT',
  curs: string | null,
  note: string | null = null,
  child_id: string = COPIL_A,
) => ({
  id,
  child_id,
  status,
  note,
  occurrence: { starts_at: zi, course: curs ? { name: curs } : null },
})

function renderPage(client?: QueryClient) {
  const queryClient =
    client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AttendancePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...utils, queryClient }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true, now: AZI })
  mockedCopii.mockResolvedValue(copii as never)
  const implicite = [
    rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot — audit UI'),
    rand('r2', '2026-07-20T15:00:00Z', 'ABSENT', null, 'A anunțat că e răcit.'),
    rand('r3', '2026-07-10T14:00:00Z', 'PRESENT', 'Înot — audit UI'),
  ]
  // Pagina pornește pe „Toți copiii", deci cererea implicită e cea combinată.
  mockedPrezentaToti.mockResolvedValue(implicite as never)
  mockedPrezenta.mockResolvedValue(implicite as never)
})

afterEach(() => {
  vi.useRealTimers()
})

// Regresie (criteriul 1): starea de încărcare a copiilor nu era citită deloc, deci
// un părinte care ARE copii vedea o clipă îndemnul să adauge unul.
test('cât timp se încarcă lista de copii nu apare îndemnul de a adăuga un copil', () => {
  mockedCopii.mockReturnValue(new Promise(() => {}) as never)
  const { container } = renderPage()
  expect(screen.queryByText('Adaugă un copil pentru a vedea prezența.')).not.toBeInTheDocument()
  expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
})

test('un cont fără copii vede îndemnul de a adăuga unul', async () => {
  mockedCopii.mockResolvedValue([] as never)
  renderPage()
  expect(await screen.findByText('Adaugă un copil pentru a vedea prezența.')).toBeInTheDocument()
})

// Regresie (criteriul 217 al secțiunii vecine, aprobat din 11 august și niciodată
// construit): o cădere de rețea afișa exact mesajul de istoric gol.
test('o citire căzută arată eroare cu reîncercare, nu mesajul de istoric gol', async () => {
  mockedPrezentaToti.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca prezența.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio prezență înregistrată încă.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Încearcă din nou' })).toBeInTheDocument()
})

test('rândurile apar de la cea mai recentă ședință la cea mai veche', async () => {
  renderPage()
  const randuri = await screen.findAllByRole('listitem')
  expect(randuri.map((li) => li.textContent)).toEqual([
    expect.stringContaining('20.08.2026'),
    expect.stringContaining('20.07.2026'),
    expect.stringContaining('10.07.2026'),
  ])
})

// Criteriul 218 al secțiunii vecine: data singură nu deosebește două ședințe din
// aceeași zi.
test('fiecare rând arată și ora ședinței', async () => {
  renderPage()
  const randuri = await screen.findAllByRole('listitem')
  expect(randuri[0].textContent).toMatch(/20\.08\.2026 · \d{2}:\d{2}/)
})

// Criteriul 216: nota antrenorului era citită din baza de date și aruncată.
test('nota antrenorului se vede sub rândul ei', async () => {
  renderPage()
  const randuri = await screen.findAllByRole('listitem')
  expect(within(randuri[1]).getByText('A anunțat că e răcit.')).toBeInTheDocument()
  expect(within(randuri[0]).queryByText('A anunțat că e răcit.')).not.toBeInTheDocument()
})

test('rezumatul respectă acordul la număr', async () => {
  mockedPrezentaToti.mockResolvedValue([rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot')] as never)
  renderPage()
  const rezumat = await screen.findByText(/ședință înregistrată/)
  expect(rezumat.textContent).toContain('1 prezență din 1 ședință înregistrată.')
})

// Criteriul 2: filtrul de perioadă taie lista, iar rezumatul se recalculează.
test('filtrul de perioadă taie ședințele din afara intervalului', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderPage()
  expect(await screen.findAllByRole('listitem')).toHaveLength(3)

  await user.selectOptions(screen.getByLabelText('Perioadă'), 'luna')
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
  expect(screen.getByText(/ședință înregistrată/).textContent).toContain('1 prezență din 1')
})

// Criteriul 3: „nu ai nimic în perioada asta" nu e totuna cu „nu ai nimic deloc".
test('când filtrul goleste lista, mesajul spune că e vorba de perioadă', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockedPrezentaToti.mockResolvedValue([rand('r3', '2026-07-10T14:00:00Z', 'PRESENT', 'Înot')] as never)
  renderPage()
  await screen.findAllByRole('listitem')

  await user.selectOptions(screen.getByLabelText('Perioadă'), 'luna')
  expect(await screen.findByText('Nicio prezență în perioada aleasă.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio prezență înregistrată încă.')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Vezi tot istoricul' }))
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
})

test('un copil fără nicio pontare vede mesajul de istoric gol, cu rezumat la zero', async () => {
  mockedPrezentaToti.mockResolvedValue([] as never)
  renderPage()
  expect(await screen.findByText('Nicio prezență înregistrată încă.')).toBeInTheDocument()
  expect(screen.getByText(/ședințe înregistrate/).textContent).toContain('0 prezențe din 0')
})

// Regresie (criteriul 4): alegerea era ținută separat de lista de copii și nu era
// verificată niciodată. După ștergerea copilului ales din „Copiii mei", cererea
// pleca pe un id mort, iar selectorul arăta vizual alt copil. Acum revenirea se
// face pe „Toți copiii", nu pe un copil ales arbitrar.
test('un copil șters între timp nu mai rămâne selectat', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  renderPage(queryClient)
  // Întâi se așază pagina: interacțiunea înainte ca lista de copii să ajungă
  // găsește un selector care încă nu există.
  await screen.findAllByRole('listitem')

  await user.selectOptions(screen.getByLabelText('Copil'), COPIL_B)
  await waitFor(() => expect(mockedPrezenta).toHaveBeenCalledWith(COPIL_B))

  mockedPrezenta.mockClear()
  mockedPrezentaToti.mockClear()
  queryClient.setQueryData(['children'], [copii[0]])

  await waitFor(() => expect(mockedPrezentaToti).toHaveBeenCalledWith([COPIL_A]))
  expect(mockedPrezenta).not.toHaveBeenCalledWith(COPIL_B)
  // Cu un singur copil rămas, selectorul dispare cu totul — nu mai are între ce
  // să comute. Ce contează e că cererea a plecat pe copilul real, nu pe id-ul mort.
  expect(screen.queryByLabelText('Copil')).not.toBeInTheDocument()
})

// Criteriul 13: pagina e o privire de ansamblu, iar implicitul de dinainte — primul
// copil în ordine alfabetică — era arbitrar.
test('pagina pornește pe „Toți copiii", prima opțiune din listă', async () => {
  renderPage()
  const selector = (await screen.findByLabelText('Copil')) as HTMLSelectElement
  expect(selector.options[0].textContent).toBe('Toți copiii')
  expect(selector.value).toBe('toti')
  await waitFor(() => expect(mockedPrezentaToti).toHaveBeenCalledWith([COPIL_A, COPIL_B]))
  expect(mockedPrezenta).not.toHaveBeenCalled()
})

// Criteriul 14: în lista comună trebuie să se știe al cui e fiecare ședință, dar
// filtrat pe un copil același nume repetat pe fiecare rând ar fi doar zgomot.
test('numele copilului apare pe rânduri doar în vederea combinată', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockedPrezentaToti.mockResolvedValue([
    rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot', null, COPIL_A),
    rand('r2', '2026-07-20T15:00:00Z', 'ABSENT', 'Alergare', null, COPIL_B),
  ] as never)
  mockedPrezenta.mockResolvedValue([
    rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot', null, COPIL_A),
  ] as never)

  renderPage()
  const randuri = await screen.findAllByRole('listitem')
  expect(randuri[0]).toHaveTextContent('Ana')
  expect(randuri[1]).toHaveTextContent('Bogdan')

  await user.selectOptions(screen.getByLabelText('Copil'), COPIL_A)
  await waitFor(() => expect(mockedPrezenta).toHaveBeenCalledWith(COPIL_A))
  const dupaFiltrare = await screen.findAllByRole('listitem')
  expect(dupaFiltrare[0]).not.toHaveTextContent('Ana')
})

// Criteriul 15: rezumatul și filtrul lucrează peste ședințele tuturor copiilor.
test('rezumatul numără prezențele tuturor copiilor în vederea combinată', async () => {
  mockedPrezentaToti.mockResolvedValue([
    rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot', null, COPIL_A),
    rand('r2', '2026-08-19T15:00:00Z', 'ABSENT', 'Alergare', null, COPIL_B),
    rand('r3', '2026-08-18T15:00:00Z', 'PRESENT', 'Înot', null, COPIL_B),
  ] as never)
  renderPage()
  await screen.findAllByRole('listitem')
  expect(screen.getByText(/ședințe înregistrate/).textContent).toContain('2 prezențe din 3')
})

// ===== Secțiunea UI #3082 „Filtru copil", criterii aprobate 2026-09-01 =====

// Criteriul 1 + 2: cu un singur copil selectorul dispare, iar numele nu mai are
// ce dezambiguiza — până acum se repeta pe fiecare rând, deși nu exista selector.
test('cu un singur copil nu există selector, iar numele nu se repetă pe rânduri', async () => {
  mockedCopii.mockResolvedValue([{ id: COPIL_A, name: 'Ana' }] as never)
  mockedPrezentaToti.mockResolvedValue([
    rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot', null, COPIL_A),
  ] as never)
  renderPage()

  const randuri = await screen.findAllByRole('listitem')
  expect(screen.queryByLabelText('Copil')).not.toBeInTheDocument()
  expect(randuri[0]).not.toHaveTextContent('Ana')
  expect(randuri[0]).toHaveTextContent('Înot')
})

// Criteriul 4: eticheta era doar `aria-label`, deci cine se uită la ecran vedea
// numai valoarea aleasă. Regula casei vine de la filtrul de anunțuri club.
test('selectorul de copil are etichetă vizibilă, legată de el', async () => {
  renderPage()
  await screen.findAllByRole('listitem')
  const eticheta = screen.getByText('Copil', { selector: 'label' })
  expect(eticheta).toBeInTheDocument()
  expect(eticheta).toHaveAttribute('for', 'filtru-copil')
  expect(screen.getByLabelText('Copil')).toHaveAttribute('id', 'filtru-copil')
})

// Criteriul 3: un copil ales fără pontări cădea pe mesajul general, fără nicio
// cale înapoi — spre deosebire de filtrul de perioadă, care numește cauza și
// oferă întoarcerea. Acum îl oglindește.
test('un copil ales fără pontări e numit în mesaj și se poate reveni la toți', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockedPrezenta.mockResolvedValue([] as never)
  renderPage()
  await screen.findAllByRole('listitem')

  await user.selectOptions(screen.getByLabelText('Copil'), COPIL_B)

  expect(await screen.findByText('Bogdan nu are nicio prezență înregistrată.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio prezență înregistrată încă.')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Vezi toți copiii' }))
  await waitFor(() => expect(screen.getByLabelText('Copil')).toHaveValue('toti'))
})
