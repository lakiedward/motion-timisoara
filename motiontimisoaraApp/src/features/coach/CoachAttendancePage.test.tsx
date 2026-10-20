import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachAttendancePage from './CoachAttendancePage'
vi.mock('@/features/live-location/CoachLocationPanel', () => ({ CoachLocationPanel: () => null }))
import { getCoachSessions, getSessionRoster, type CoachSession } from '@/api/coach'

vi.mock('@/api/coach', () => ({
  getCoachSessions: vi.fn(),
  getSessionRoster: vi.fn(),
  markAttendance: vi.fn(),
  markManyPresent: vi.fn(),
  PAST_VISIBLE_DAYS: 14,
  SESSION_GROUP_LIMIT: 100,
}))

const mockedGetCoachSessions = vi.mocked(getCoachSessions)
const mockedGetSessionRoster = vi.mocked(getSessionRoster)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoachAttendancePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function session(overrides: Partial<CoachSession> & { id: string }): CoachSession {
  return {
    course_id: 'c1',
    starts_at: '2026-08-20T14:00:00.000Z',
    ends_at: '2026-08-20T15:00:00.000Z',
    course: { id: 'c1', name: 'Înot începători', location: { name: 'Bazin Olimpic' }, sport: null },
    enrolled_count: 3,
    marked_count: 0,
    attendance_recorded: false,
    ...overrides,
  } as CoachSession
}

const groups = (over: Partial<Awaited<ReturnType<typeof getCoachSessions>>> = {}) => ({
  upcoming: [],
  past: [],
  pastRecentCount: 0,
  truncated: false,
  ...over,
})

beforeEach(() => {
  mockedGetSessionRoster.mockResolvedValue([])
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-18T12:00:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

// --- Criteriul 1: starea pontării pe card ---
test('fiecare card spune dacă ședința e pontată, nepontată sau urmează, ca la admin', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [session({ id: 's0' })],
      past: [
        session({ id: 's1', starts_at: '2026-08-15T14:00:00.000Z', marked_count: 3 }),
        session({ id: 's2', starts_at: '2026-08-16T14:00:00.000Z' }),
        session({ id: 's3', starts_at: '2026-08-17T14:00:00.000Z', marked_count: 1 }),
      ],
      pastRecentCount: 3,
    }),
  )
  renderPage()
  expect(await screen.findByText('Pontată')).toBeInTheDocument()
  expect(screen.getByText('Nepontată')).toBeInTheDocument()
  expect(screen.getByText('1 din 3 pontați')).toBeInTheDocument()
  expect(screen.getByText('Urmează')).toBeInTheDocument()
})

// --- Criteriul 2: gruparea Următoarele / Trecute ---
test('ședințele viitoare și cele trecute stau în grupuri separate, viitorul primul', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [session({ id: 's1' })],
      past: [session({ id: 's2', starts_at: '2026-08-15T14:00:00.000Z' })],
      pastRecentCount: 1,
    }),
  )
  renderPage()
  const urmatoarele = await screen.findByRole('heading', { name: /^Următoarele/ })
  const trecute = screen.getByRole('heading', { name: /^Trecute/ })
  expect(urmatoarele.compareDocumentPosition(trecute)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})

// --- Criteriul 3: eroarea nu mai arată ca lista goală ---
test('eroarea de încărcare are mesaj propriu și Reîncearcă, nu textul de listă goală', async () => {
  mockedGetCoachSessions.mockRejectedValue(new Error('boom'))
  renderPage()
  const alert = await screen.findByRole('alert')
  expect(within(alert).getByText('Nu am putut încărca ședințele.')).toBeInTheDocument()
  expect(within(alert).getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  expect(screen.queryByText(/Nicio ședință programată/)).not.toBeInTheDocument()
})

test('lista goală păstrează textul ei și nu oferă Reîncearcă', async () => {
  mockedGetCoachSessions.mockResolvedValue(groups())
  renderPage()
  expect(await screen.findByText(/Nicio ședință programată/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
})

// --- Criteriul 14: starea goală nu mai e drum înfundat ---
test('starea goală duce spre Cursurile mele printr-un control de 44 px', async () => {
  mockedGetCoachSessions.mockResolvedValue(groups())
  renderPage()
  const link = await screen.findByRole('link', { name: /cursurile mele/i })
  expect(link).toHaveAttribute('href', '/coach/courses')
  expect(link.className).toMatch(/min-h-touch-target/)
})

// --- Criteriul 13: preselectarea ședinței celei mai apropiate ---
test('pagina se deschide pe prima ședință care urmează', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [session({ id: 'urmatoarea' }), session({ id: 's2' })],
      past: [session({ id: 'trecuta', starts_at: '2026-08-15T14:00:00.000Z' })],
      pastRecentCount: 1,
    }),
  )
  renderPage()
  const cards = await screen.findAllByRole('button', { name: /Înot începători/ })
  expect(cards[0]).toHaveAttribute('aria-current', 'true')
  expect(cards[1]).not.toHaveAttribute('aria-current')
})

test('fără ședințe viitoare, se deschide pe cea mai recentă trecută', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      past: [
        session({ id: 'recenta', starts_at: '2026-08-15T14:00:00.000Z' }),
        session({ id: 'veche', starts_at: '2026-08-14T14:00:00.000Z' }),
      ],
      pastRecentCount: 2,
    }),
  )
  renderPage()
  const cards = await screen.findAllByRole('button', { name: /Înot începători/ })
  expect(cards[0]).toHaveAttribute('aria-current', 'true')
})

// --- Criteriul 12: Trecute tăiat la două săptămâni, restul după Vezi mai mult ---
test('ședințele mai vechi de două săptămâni apar abia după Vezi mai mult', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      past: [
        session({ id: 'recenta', starts_at: '2026-08-15T14:00:00.000Z' }),
        session({
          id: 'veche',
          starts_at: '2026-07-20T14:00:00.000Z',
          course: { id: 'c2', name: 'Alergare veche', location: null, sport: null },
        }),
      ],
      pastRecentCount: 1,
    }),
  )
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('1 ședință')).toBeInTheDocument()
  expect(screen.queryByText('Alergare veche')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Vezi mai mult \(1\)/ }))

  expect(screen.getByText('Alergare veche')).toBeInTheDocument()
  expect(screen.getByText('2 ședințe')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Vezi mai mult/ })).not.toBeInTheDocument()
})

// Regresie (Bugbot): plierea celor două săptămâni nu are voie să golească lista.
// Un antrenor cu numai ședințe vechi vedea „Ședințe (0)”, zero carduri randate și,
// pe telefon, niciun catalog — pentru că selecția cădea pe un card nemontat.
test('cu numai ședințe mai vechi de două săptămâni, lista le arată pe toate', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      past: [
        session({ id: 'vechi1', starts_at: '2026-07-01T14:00:00.000Z' }),
        session({ id: 'vechi2', starts_at: '2026-06-20T14:00:00.000Z' }),
      ],
      pastRecentCount: 0,
    }),
  )
  renderPage()
  expect(await screen.findByText('2 ședințe')).toBeInTheDocument()
  const cards = screen.getAllByRole('button', { name: /Înot începători/ })
  expect(cards).toHaveLength(2)
  expect(cards[0]).toHaveAttribute('aria-current', 'true')
  expect(screen.queryByRole('button', { name: /Vezi mai mult/ })).not.toBeInTheDocument()
})

// --- Criteriile 7, 9, 11: conținutul cardului și antetul ---
test('rândul arată locația și numărul de copii, ziua întreagă stă în antetul zilei', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [
        session({ id: 's1', enrolled_count: 1 }),
        session({ id: 's2', enrolled_count: 0 }),
      ],
    }),
  )
  renderPage()
  expect(await screen.findByText('2 ședințe')).toBeInTheDocument()
  expect(screen.getAllByText('Bazin Olimpic')).toHaveLength(2)
  expect(screen.getByText('1 copil')).toBeInTheDocument()
  expect(screen.getByText('0 copii')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Joi 20 august' })).toBeInTheDocument()
})

test('fără locație pe curs, cardul scrie o liniuță în locul ei', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [
        session({
          id: 's1',
          course: { id: 'c1', name: 'Înot începători', location: null, sport: null },
        }),
      ],
    }),
  )
  renderPage()
  const card = await screen.findByRole('button', { name: /Înot începători/ })
  expect(within(card).getByText('—')).toBeInTheDocument()
})

// --- Criteriile 5, 6, 10: focus din sistemul de design, două coloane, formă de card ---
test('rândul folosește inelul de focus din sistemul de design, iar ziua e un card plat', async () => {
  mockedGetCoachSessions.mockResolvedValue(groups({ upcoming: [session({ id: 's1' })] }))
  renderPage()
  const card = await screen.findByRole('button', { name: /Înot începători/ })
  expect(card.className).toMatch(/focus-visible:outline-2/)
  expect(card.className).toMatch(/focus-visible:outline-ring/)
  const zi = card.closest('ul')!.parentElement!
  expect(zi.className).toMatch(/rounded-xl/)
  expect(zi.className).toMatch(/border/)
  expect(zi.className).not.toMatch(/shadow/)
})

// Regresie: `overflow-y` calculează `overflow-x: auto`, deci lista care derulează
// taie inelul de focus dacă n-are spațiu lateral. A apărut o dată, pe stânga.
test('lista care derulează lasă loc lateral inelului de focus', async () => {
  mockedGetCoachSessions.mockResolvedValue(groups({ upcoming: [session({ id: 's1' })] }))
  const { container } = renderPage()
  await screen.findByRole('button', { name: /Înot începători/ })
  const scroller = container.querySelector('[class*="overflow-y-auto"]')
  expect(scroller).not.toBeNull()
  // Plafonul de înălțime — și deci derularea — pornește de la `lg:`, nu de la
  // `md:`: pe tabletă lista încape fără să fie tăiată. Padding-ul trebuie să
  // urmeze aceeași treaptă, altfel inelul de focus rămâne fără loc exact acolo
  // unde apare bara de derulare.
  expect(scroller!.className).toMatch(/lg:px-/)
  expect(scroller!.className).not.toMatch(/lg:pr-\d/)
})

test('cele două coloane pornesc de la 768 px, nu de la 1024', async () => {
  mockedGetCoachSessions.mockResolvedValue(groups({ upcoming: [session({ id: 's1' })] }))
  const { container } = renderPage()
  await screen.findByRole('button', { name: /Înot începători/ })
  const grid = container.querySelector('[class*="grid-cols"]')
  expect(grid?.className).toMatch(/md:grid-cols-/)
  expect(grid?.className).not.toMatch(/lg:grid-cols-/)
})

// --- Criteriul 16: nu dispar ședințe în tăcere ---
test('când sunt mai multe ședințe decât aduce interogarea, lista o spune pe ecran', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({ upcoming: [session({ id: 's1' })], truncated: true }),
  )
  renderPage()
  expect(await screen.findByText(/Se afișează primele 100 de ședințe/)).toBeInTheDocument()
})

test('căutarea găsește ședințele după curs sau locație și spune câte din total', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [
        session({ id: 's1' }),
        session({
          id: 's2',
          course: { id: 'c2', name: 'Alergare', location: { name: 'Parcul Rozelor' }, sport: null },
        }),
      ],
    }),
  )
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('2 ședințe')
  await user.type(screen.getByRole('searchbox'), 'rozelor')
  expect(screen.getByText('1 din 2 ședințe')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Înot începători/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Alergare/ })).toBeInTheDocument()
})

test('filtrul Nepontate lasă doar ședințele începute cu copii nepontați', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [session({ id: 'viitoare' })],
      past: [
        session({ id: 'gata', starts_at: '2026-08-15T14:00:00.000Z', marked_count: 3 }),
        session({ id: 'restanta', starts_at: '2026-08-16T14:00:00.000Z' }),
      ],
      pastRecentCount: 2,
    }),
  )
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('3 ședințe')
  await user.click(screen.getByRole('button', { name: /^Nepontate/ }))
  expect(screen.getByText('1 ședință')).toBeInTheDocument()
  expect(screen.getByText('Nepontată')).toBeInTheDocument()
  expect(screen.queryByText('Pontată')).not.toBeInTheDocument()
  expect(screen.queryByText('Urmează')).not.toBeInTheDocument()
})
