import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'

import AttendancePage from './AttendancePage'
import { pickFilter } from '@/test/pick-filter'
vi.mock('@/features/live-location/parent/LiveLocationBanner', () => ({
  LiveLocationBanner: () => null,
}))
import {
  getChildAttendance,
  getChildrenAttendance,
  getMyChildren,
  getMyChildrenCampAttendance,
} from '@/api/account'

import { getMyChildrenActivityAttendance } from '@/api/attendance/activity-attendance'

vi.mock('@/api/attendance/activity-attendance', () => ({
  getMyChildrenActivityAttendance: vi.fn(),
}))

vi.mock('@/api/account', () => ({
  getMyChildren: vi.fn(),
  getChildAttendance: vi.fn(),
  getChildrenAttendance: vi.fn(),
  getMyChildrenCampAttendance: vi.fn(),
}))

const mockedCopii = vi.mocked(getMyChildren)
const mockedPrezenta = vi.mocked(getChildAttendance)
const mockedPrezentaToti = vi.mocked(getChildrenAttendance)
const mockedTabere = vi.mocked(getMyChildrenCampAttendance)
const mockedActivitati = vi.mocked(getMyChildrenActivityAttendance)

const COPIL_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const COPIL_B = 'bbbbbbbb-0000-4000-8000-000000000002'

const copii = [
  { id: COPIL_A, name: 'Ana' },
  { id: COPIL_B, name: 'Bogdan' },
]

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

function HistoryNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <span data-testid="attendance-url">{location.search}</span>
      <button onClick={() => navigate(-1)}>Back</button>
    </>
  )
}

function renderPage(client?: QueryClient, path = '/account/attendance') {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AttendancePage />
        <HistoryNavigation />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...utils, queryClient }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true, now: AZI })
  mockedCopii.mockResolvedValue(copii as never)
  mockedActivitati.mockResolvedValue([])
  const implicite = [
    rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot — audit UI'),
    rand('r2', '2026-07-20T15:00:00Z', 'ABSENT', null, 'A anunțat că e răcit.'),
    rand('r3', '2026-07-10T14:00:00Z', 'PRESENT', 'Înot — audit UI'),
  ]
  mockedPrezentaToti.mockResolvedValue(implicite as never)
  mockedPrezenta.mockResolvedValue(implicite as never)
  mockedTabere.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

test('a child attendance link filters history and browser back restores that filter', async () => {
  renderPage(undefined, `/account/attendance?copil=${COPIL_B}`)
  await waitFor(() => expect(mockedPrezenta).toHaveBeenCalledWith(COPIL_B))
  expect(mockedPrezentaToti).not.toHaveBeenCalled()
  expect(screen.getByTestId('attendance-url')).toHaveTextContent(`?copil=${COPIL_B}`)
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('button', { name: 'Ana' }))
  await waitFor(() => expect(mockedPrezenta).toHaveBeenCalledWith(COPIL_A))
  expect(screen.getByTestId('attendance-url')).toHaveTextContent(`?copil=${COPIL_A}`)
  await user.click(screen.getByRole('button', { name: 'Ana' }))
  await user.click(screen.getByRole('button', { name: 'Back' }))
  await waitFor(() =>
    expect(screen.getByTestId('attendance-url')).toHaveTextContent(`?copil=${COPIL_B}`),
  )
  expect(screen.getByRole('button', { name: 'Bogdan' })).toHaveAttribute('aria-pressed', 'true')
})

test('an unknown child in the URL falls back to the current parent children', async () => {
  renderPage(undefined, '/account/attendance?copil=unknown')
  await waitFor(() => expect(mockedPrezentaToti).toHaveBeenCalledWith([COPIL_A, COPIL_B]))
  expect(mockedPrezenta).not.toHaveBeenCalled()
})

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

test('o citire căzută arată eroare cu reîncercare, nu mesajul de istoric gol', async () => {
  mockedPrezentaToti.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca prezența.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio prezență înregistrată încă.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('rândurile apar de la cea mai recentă ședință la cea mai veche', async () => {
  renderPage()
  const randuri = await screen.findAllByRole('listitem')
  expect(randuri.map((li) => li.textContent)).toEqual([
    expect.stringContaining('20 august 2026'),
    expect.stringContaining('20 iulie 2026'),
    expect.stringContaining('10 iulie 2026'),
  ])
})

test('ședințele sunt grupate pe lună, cea mai recentă lună prima', async () => {
  renderPage()
  const luni = await screen.findAllByRole('heading', { level: 2 })
  expect(luni.map((h) => h.textContent)).toEqual(['August 2026', 'Iulie 2026'])
  expect(screen.getByText('1 prezență din 2')).toBeInTheDocument()
})

test('fiecare rând arată și ora ședinței', async () => {
  renderPage()
  const randuri = await screen.findAllByRole('listitem')
  expect(randuri[0].textContent).toMatch(/Joi, 20 august 2026, \d{2}:\d{2}/)
})

test('nota antrenorului se vede sub rândul ei', async () => {
  renderPage()
  const randuri = await screen.findAllByRole('listitem')
  expect(within(randuri[1]).getByText('A anunțat că e răcit.')).toBeInTheDocument()
  expect(within(randuri[0]).queryByText('A anunțat că e răcit.')).not.toBeInTheDocument()
})

test('rezumatul respectă acordul la număr', async () => {
  mockedPrezentaToti.mockResolvedValue([
    rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot'),
  ] as never)
  renderPage()
  const rezumat = await screen.findByText(/ședință înregistrată/)
  expect(rezumat.textContent).toContain('1 prezență din 1 ședință înregistrată.')
})

test('filtrul de perioadă taie ședințele din afara intervalului', async () => {
  renderPage()
  expect(await screen.findAllByRole('listitem')).toHaveLength(3)

  await pickFilter('Perioadă', 'Luna curentă')
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))
  expect(screen.getByText(/ședință înregistrată/).textContent).toContain('1 prezență din 1')
})

test('când filtrul goleste lista, mesajul spune că e vorba de perioadă', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockedPrezentaToti.mockResolvedValue([
    rand('r3', '2026-07-10T14:00:00Z', 'PRESENT', 'Înot'),
  ] as never)
  renderPage()
  await screen.findAllByRole('listitem')

  await pickFilter('Perioadă', 'Luna curentă')
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

test('un copil șters între timp nu mai rămâne selectat', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  renderPage(queryClient)
  await screen.findAllByRole('listitem')

  await user.click(screen.getByRole('button', { name: 'Bogdan' }))
  await waitFor(() => expect(mockedPrezenta).toHaveBeenCalledWith(COPIL_B))

  mockedPrezenta.mockClear()
  mockedPrezentaToti.mockClear()
  queryClient.setQueryData(['children'], [copii[0]])

  await waitFor(() => expect(mockedPrezentaToti).toHaveBeenCalledWith([COPIL_A]))
  expect(mockedPrezenta).not.toHaveBeenCalledWith(COPIL_B)
  expect(screen.queryByRole('group', { name: 'Copil' })).not.toBeInTheDocument()
})

test('pagina pornește pe „Toți copiii", primul buton din filtru', async () => {
  renderPage()
  const filtru = await screen.findByRole('group', { name: 'Copil' })
  const butoane = within(filtru).getAllByRole('button')
  expect(butoane.map((b) => b.textContent)).toEqual(['Toți copiii', 'AAna', 'BBogdan'])
  expect(butoane[0]).toHaveAttribute('aria-pressed', 'true')
  expect(butoane[1]).toHaveAttribute('aria-pressed', 'false')
  await waitFor(() => expect(mockedPrezentaToti).toHaveBeenCalledWith([COPIL_A, COPIL_B]))
  expect(mockedPrezenta).not.toHaveBeenCalled()
})

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

  await user.click(screen.getByRole('button', { name: 'Ana' }))
  await waitFor(() => expect(mockedPrezenta).toHaveBeenCalledWith(COPIL_A))
  const dupaFiltrare = await screen.findAllByRole('listitem')
  expect(dupaFiltrare[0]).not.toHaveTextContent('Ana')
})

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

test('cu un singur copil nu există selector, iar numele nu se repetă pe rânduri', async () => {
  mockedCopii.mockResolvedValue([{ id: COPIL_A, name: 'Ana' }] as never)
  mockedPrezentaToti.mockResolvedValue([
    rand('r1', '2026-08-20T14:00:00Z', 'PRESENT', 'Înot', null, COPIL_A),
  ] as never)
  renderPage()

  const randuri = await screen.findAllByRole('listitem')
  expect(screen.queryByRole('group', { name: 'Copil' })).not.toBeInTheDocument()
  expect(randuri[0]).not.toHaveTextContent('Ana')
  expect(randuri[0]).toHaveTextContent('Înot')
})

test('filtrul pe copil e un grup de butoane cu nume întreg, iar alegerea se vede', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderPage()
  await screen.findAllByRole('listitem')
  const ana = screen.getByRole('button', { name: 'Ana' })
  expect(ana).toHaveAttribute('aria-pressed', 'false')
  await user.click(ana)
  expect(ana).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Toți copiii' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await waitFor(() => expect(mockedPrezenta).toHaveBeenCalledWith(COPIL_A))
})

test('un copil ales fără pontări e numit în mesaj și se poate reveni la toți', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockedPrezenta.mockResolvedValue([] as never)
  renderPage()
  await screen.findAllByRole('listitem')

  await user.click(screen.getByRole('button', { name: 'Bogdan' }))

  expect(await screen.findByText('Bogdan nu are nicio prezență înregistrată.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio prezență înregistrată încă.')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Vezi toți copiii' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Toți copiii' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  )
})

const sosire = (
  id: string,
  sosit: string,
  child_id: string = COPIL_A,
  plecat: string | null = null,
) => ({
  id,
  child_id,
  camp_id: 'cccccccc-0000-4000-8000-000000000003',
  camp_title: 'Tabăra de vară',
  period_start: '2026-08-10',
  period_end: '2026-08-14',
  arrived_at: sosit,
  departed_at: plecat,
})

test('fără tabere, rândurile nu au insignă de tip și rezumatul rămâne pe ședințe', async () => {
  renderPage()
  const rezumat = await screen.findByText(/ședințe înregistrate/)
  expect(rezumat.textContent).toContain('2 prezențe din 3 ședințe înregistrate.')
  expect(screen.queryByText('Curs')).not.toBeInTheDocument()
})

test('sosirea la tabără apare în istoric cu insigna Tabără, perioada și Sosit', async () => {
  mockedTabere.mockResolvedValue([
    sosire('t1', '2026-08-10T06:30:00Z', COPIL_A, '2026-08-14T13:00:00Z'),
  ] as never)
  renderPage()
  const titlu = await screen.findByText('Tabăra de vară')
  const rand = titlu.closest('li') as HTMLElement
  expect(within(rand).getByText('Tabără')).toBeInTheDocument()
  expect(within(rand).getByText(/10\.08\.2026 – 14\.08\.2026/)).toBeInTheDocument()
  expect(within(rand).getByText(/sosit 10 aug\.?, 09:30/)).toBeInTheDocument()
  expect(within(rand).getByText(/plecat 14 aug\.?, 16:00/)).toBeInTheDocument()
  expect(within(rand).getByText('Sosit')).toBeInTheDocument()
  expect(screen.getAllByText('Curs')).toHaveLength(3)
  const randuri = screen.getAllByRole('listitem')
  expect(within(randuri[0]).getByText('Înot — audit UI')).toBeInTheDocument()
  expect(randuri[1]).toBe(rand)
})

test('rezumatul numără separat ședințele de curs și taberele', async () => {
  mockedTabere.mockResolvedValue([sosire('t1', '2026-08-10T06:30:00Z')] as never)
  renderPage()
  const rezumat = await screen.findByText(/înregistrări/)
  expect(rezumat.textContent).toContain(
    '3 prezențe din 4 înregistrări: 3 ședințe de curs, 1 tabără.',
  )
  expect(
    screen.getByText(
      'Se numără ședințele pontate de tine la intrare sau de antrenor și sosirile la tabără.',
    ),
  ).toBeInTheDocument()
})

test('pe un copil ales se văd doar taberele lui', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockedTabere.mockResolvedValue([
    { ...sosire('t1', '2026-08-10T06:30:00Z', COPIL_A), camp_title: 'Tabăra Anei' },
    { ...sosire('t2', '2026-08-11T06:30:00Z', COPIL_B), camp_title: 'Tabăra lui Bogdan' },
  ] as never)
  renderPage()
  await screen.findByText('Tabăra lui Bogdan')
  await user.click(screen.getByRole('button', { name: /Ana/ }))
  await screen.findByText('Tabăra Anei')
  expect(screen.queryByText('Tabăra lui Bogdan')).not.toBeInTheDocument()
})

test('o citire căzută a taberelor arată eroare cu reîncercare', async () => {
  mockedTabere.mockRejectedValue(new Error('boom'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca prezența.')).toBeInTheDocument()
})

const activitate = (
  id: string,
  zi: string,
  status: 'PRESENT' | 'ABSENT',
  child_id: string = COPIL_A,
) => ({
  id,
  child_id,
  activity_id: 'dddddddd-0000-4000-8000-000000000004',
  status,
  activity: { name: 'Ștafeta de vară', activity_date: zi, start_time: '10:00:00' },
})

test('activitatea pontată apare cu insigna Activitate și intră în rezumat', async () => {
  mockedTabere.mockResolvedValue([sosire('t1', '2026-08-10T06:30:00Z')] as never)
  mockedActivitati.mockResolvedValue([
    activitate('v1', '2026-08-15', 'ABSENT'),
    activitate('v2', '2026-08-16', 'PRESENT', 'eeeeeeee-0000-4000-8000-000000000009'),
  ] as never)
  renderPage()
  const rezumat = await screen.findByText(/înregistrări/)
  expect(rezumat.textContent).toContain(
    '3 prezențe din 5 înregistrări: 3 ședințe de curs, 1 activitate, 1 tabără.',
  )
  expect(
    screen.getByText(
      'Se numără ședințele pontate de tine la intrare sau de antrenor, activitățile pontate și sosirile la tabără.',
    ),
  ).toBeInTheDocument()
  const rand = screen.getByText('Ștafeta de vară').closest('li')!
  expect(within(rand).getByText('Activitate')).toBeInTheDocument()
  expect(within(rand).getByText('Absent')).toBeInTheDocument()
  expect(screen.getAllByText('Ștafeta de vară')).toHaveLength(1)
})

test('o citire căzută a activităților arată eroare cu reîncercare', async () => {
  mockedActivitati.mockRejectedValue(new Error('boom'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca prezența.')).toBeInTheDocument()
})
