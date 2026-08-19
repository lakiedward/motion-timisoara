import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachAttendancePage from './CoachAttendancePage'
import { getCoachSessions, getSessionRoster, type CoachSession } from '@/api/coach'

vi.mock('@/api/coach', () => ({
  getCoachSessions: vi.fn(),
  getSessionRoster: vi.fn(),
  markAttendance: vi.fn(),
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
    course: { id: 'c1', name: 'Înot începători', location: { name: 'Bazin Olimpic' } },
    enrolled_count: 3,
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
})

// --- Criteriul 1: starea pontării pe card ---
test('fiecare card spune dacă ședința e pontată sau nu', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [
        session({ id: 's1', attendance_recorded: true }),
        session({ id: 's2', attendance_recorded: false }),
      ],
    }),
  )
  renderPage()
  expect(await screen.findByText('Pontată')).toBeInTheDocument()
  expect(screen.getByText('Nepontată')).toBeInTheDocument()
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
  const urmatoarele = await screen.findByRole('heading', { name: 'Următoarele' })
  const trecute = screen.getByRole('heading', { name: 'Trecute' })
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
  expect(link.className).toMatch(/min-h-11/)
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
        session({ id: 'veche', starts_at: '2026-07-20T14:00:00.000Z', course: { id: 'c2', name: 'Alergare veche', location: null } }),
      ],
      pastRecentCount: 1,
    }),
  )
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Ședințe (1)')).toBeInTheDocument()
  expect(screen.queryByText('Alergare veche')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Vezi mai mult \(1\)/ }))

  expect(screen.getByText('Alergare veche')).toBeInTheDocument()
  expect(screen.getByText('Ședințe (2)')).toBeInTheDocument()
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
  expect(await screen.findByText('Ședințe (2)')).toBeInTheDocument()
  const cards = screen.getAllByRole('button', { name: /Înot începători/ })
  expect(cards).toHaveLength(2)
  expect(cards[0]).toHaveAttribute('aria-current', 'true')
  expect(screen.queryByRole('button', { name: /Vezi mai mult/ })).not.toBeInTheDocument()
})

// --- Criteriile 7, 9, 11: conținutul cardului și antetul ---
test('cardul arată locația, numărul de copii și ziua întreagă; antetul arată numărul', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [session({ id: 's1', enrolled_count: 1 }), session({ id: 's2', enrolled_count: 0 })],
    }),
  )
  renderPage()
  expect(await screen.findByText('Ședințe (2)')).toBeInTheDocument()
  expect(screen.getByText(/Bazin Olimpic · 1 copil$/)).toBeInTheDocument()
  expect(screen.getByText(/Bazin Olimpic · 0 copii$/)).toBeInTheDocument()

  const cards = screen.getAllByRole('button', { name: /Înot începători/ })
  expect(cards[0].textContent).toMatch(/(Duminică|Luni|Marți|Miercuri|Joi|Vineri|Sâmbătă) \d/)
})

test('fără locație pe curs, cardul scrie o liniuță în locul ei', async () => {
  mockedGetCoachSessions.mockResolvedValue(
    groups({
      upcoming: [session({ id: 's1', course: { id: 'c1', name: 'Înot începători', location: null } })],
    }),
  )
  renderPage()
  expect(await screen.findByText(/^— · 3 copii$/)).toBeInTheDocument()
})

// --- Criteriile 5, 6, 10: focus din sistemul de design, două coloane, formă de card ---
test('cardul folosește inelul de focus din sistemul de design și forma de card a site-ului', async () => {
  mockedGetCoachSessions.mockResolvedValue(groups({ upcoming: [session({ id: 's1' })] }))
  renderPage()
  const card = await screen.findByRole('button', { name: /Înot începători/ })
  expect(card.className).toMatch(/focus-visible:ring-\[3px\]/)
  expect(card.className).toMatch(/focus-visible:ring-ring\/50/)
  expect(card.className).toMatch(/rounded-3xl/)
  expect(card.className).toMatch(/shadow-card/)
})

// Regresie: `overflow-y` calculează `overflow-x: auto`, deci lista care derulează
// taie inelul de focus dacă n-are spațiu lateral. A apărut o dată, pe stânga.
test('lista care derulează lasă loc lateral inelului de focus', async () => {
  mockedGetCoachSessions.mockResolvedValue(groups({ upcoming: [session({ id: 's1' })] }))
  const { container } = renderPage()
  await screen.findByRole('button', { name: /Înot începători/ })
  const scroller = container.querySelector('[class*="overflow-y-auto"]')
  expect(scroller).not.toBeNull()
  expect(scroller!.className).toMatch(/md:px-/)
  expect(scroller!.className).not.toMatch(/md:pr-\d/)
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
