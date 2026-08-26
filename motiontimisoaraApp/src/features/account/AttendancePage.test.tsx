import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import AttendancePage from './AttendancePage'
import { getChildAttendance, getMyChildren } from '@/api/account'

vi.mock('@/api/account', () => ({
  getMyChildren: vi.fn(),
  getChildAttendance: vi.fn(),
}))

const mockedCopii = vi.mocked(getMyChildren)
const mockedPrezenta = vi.mocked(getChildAttendance)

const COPIL_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const COPIL_B = 'bbbbbbbb-0000-4000-8000-000000000002'

const copii = [
  { id: COPIL_A, name: 'Ana' },
  { id: COPIL_B, name: 'Bogdan' },
]

/** Azi e fixat în teste ca să nu se schimbe rezultatul filtrului odată cu luna. */
const AZI = new Date('2026-08-26T09:00:00Z')

const rand = (id: string, zi: string, status: 'PRESENT' | 'ABSENT', curs: string | null, note: string | null = null) => ({
  id,
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
  mockedPrezenta.mockResolvedValue([
    rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot — audit UI'),
    rand('r2', '2026-07-20T15:00:00Z', 'ABSENT', null, 'A anunțat că e răcit.'),
    rand('r3', '2026-07-10T14:00:00Z', 'PRESENT', 'Înot — audit UI'),
  ] as never)
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
  mockedPrezenta.mockRejectedValue(new Error('network'))
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
  mockedPrezenta.mockResolvedValue([rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot')] as never)
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
  mockedPrezenta.mockResolvedValue([rand('r3', '2026-07-10T14:00:00Z', 'PRESENT', 'Înot')] as never)
  renderPage()
  await screen.findAllByRole('listitem')

  await user.selectOptions(screen.getByLabelText('Perioadă'), 'luna')
  expect(await screen.findByText('Nicio prezență în perioada aleasă.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio prezență înregistrată încă.')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Vezi tot istoricul' }))
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
})

test('un copil fără nicio pontare vede mesajul de istoric gol, cu rezumat la zero', async () => {
  mockedPrezenta.mockResolvedValue([] as never)
  renderPage()
  expect(await screen.findByText('Nicio prezență înregistrată încă.')).toBeInTheDocument()
  expect(screen.getByText(/ședințe înregistrate/).textContent).toContain('0 prezențe din 0')
})

// Regresie (criteriul 4): alegerea era ținută separat de lista de copii și nu era
// verificată niciodată. După ștergerea copilului ales din „Copiii mei", cererea
// pleca pe un id mort, iar selectorul arăta vizual alt copil.
test('un copil șters între timp nu mai rămâne selectat', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  renderPage(queryClient)

  await user.selectOptions(await screen.findByLabelText('Copil'), COPIL_B)
  await waitFor(() => expect(mockedPrezenta).toHaveBeenCalledWith(COPIL_B))

  mockedPrezenta.mockClear()
  queryClient.setQueryData(['children'], [copii[0]])

  await waitFor(() => expect(mockedPrezenta).toHaveBeenCalledWith(COPIL_A))
  expect(mockedPrezenta).not.toHaveBeenCalledWith(COPIL_B)
})
