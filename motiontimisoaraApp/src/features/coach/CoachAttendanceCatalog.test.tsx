import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { toast } from 'sonner'

import CoachAttendancePage from './CoachAttendancePage'
vi.mock('@/features/live-location/CoachLocationPanel', () => ({ CoachLocationPanel: () => null }))
import {
  getCoachSessions,
  getSessionRoster,
  markAttendance,
  markManyPresent,
  type CoachSession,
  type RosterEntry,
} from '@/api/coach'

vi.mock('@/api/coach', () => ({
  getCoachSessions: vi.fn(),
  getSessionRoster: vi.fn(),
  markAttendance: vi.fn(),
  markManyPresent: vi.fn(),
  PAST_VISIBLE_DAYS: 14,
  SESSION_GROUP_LIMIT: 100,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedSessions = vi.mocked(getCoachSessions)
const mockedRoster = vi.mocked(getSessionRoster)
const mockedMark = vi.mocked(markAttendance)
const mockedMarkAll = vi.mocked(markManyPresent)

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

function session(over: Partial<CoachSession> & { id: string }): CoachSession {
  return {
    course_id: 'crs',
    starts_at: '2026-08-20T14:00:00.000Z',
    ends_at: '2026-08-20T15:00:00.000Z',
    course: { id: 'crs', name: 'Înot începători', location: { name: 'Bazin' } },
    enrolled_count: 3,
    attendance_recorded: false,
    ...over,
  } as CoachSession
}

const groups = (over: Partial<Awaited<ReturnType<typeof getCoachSessions>>> = {}) => ({
  upcoming: [],
  past: [],
  pastRecentCount: 0,
  truncated: false,
  ...over,
})

function copil(over: Partial<RosterEntry> & { child_id: string; child_name: string }): RosterEntry {
  return { child_birth_date: '2016-05-01', status: null, ...over }
}

const trioCopii = (): RosterEntry[] => [
  copil({ child_id: 'c1', child_name: 'Ana Dumitrescu', status: 'PRESENT' }),
  copil({ child_id: 'c2', child_name: 'Andrei Popescu', status: 'ABSENT' }),
  copil({ child_id: 'c3', child_name: 'Luca Georgescu' }),
]

const oSedinta = () => groups({ upcoming: [session({ id: 's1' })] })

function renderCatalog(roster: RosterEntry[]) {
  mockedSessions.mockResolvedValue(oSedinta())
  mockedRoster.mockResolvedValue(roster)
  return renderPage()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-21T12:00:00.000Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

test('antetul catalogului conține cursul, ziua, data și ora ședinței', async () => {
  renderCatalog(trioCopii())
  const antet = await screen.findByRole('heading', { name: /Prezență · Înot începători/ })
  expect(antet.textContent).toMatch(
    /(Luni|Marți|Miercuri|Joi|Vineri|Sâmbătă|Duminică) \d{2}\.\d{2}\.\d{4} · \d{2}:\d{2}/,
  )
})

test('contorul arată câți copii sunt pontați din total', async () => {
  renderCatalog(trioCopii())
  expect(await screen.findByText('2 din 3 pontați')).toBeInTheDocument()
})

test('Toți prezenți trimite doar copiii nepontați', async () => {
  const user = userEvent.setup()
  renderCatalog(trioCopii())
  await user.click(await screen.findByRole('button', { name: 'Toți prezenți' }))
  expect(mockedMarkAll).toHaveBeenCalledWith('s1', ['c3'])
})

test('Toți prezenți e dezactivat când toți copiii sunt deja pontați', async () => {
  renderCatalog([
    copil({ child_id: 'c1', child_name: 'Ana Dumitrescu', status: 'PRESENT' }),
    copil({ child_id: 'c2', child_name: 'Andrei Popescu', status: 'ABSENT' }),
  ])
  expect(await screen.findByRole('button', { name: 'Toți prezenți' })).toBeDisabled()
})

test('reapăsarea butonului activ șterge pontarea, o apăsare nouă o setează', async () => {
  const user = userEvent.setup()
  renderCatalog(trioCopii())
  const randAna = (await screen.findByText('Ana Dumitrescu')).closest('li')!
  await user.click(within(randAna).getByRole('button', { name: 'Prezent' }))
  expect(mockedMark).toHaveBeenLastCalledWith('s1', 'c1', null)

  const randLuca = screen.getByText('Luca Georgescu').closest('li')!
  await user.click(within(randLuca).getByRole('button', { name: 'Prezent' }))
  expect(mockedMark).toHaveBeenLastCalledWith('s1', 'c3', 'PRESENT')
})

test('butonul activ e marcat pentru tehnologiile asistive', async () => {
  renderCatalog(trioCopii())
  const randAna = (await screen.findByText('Ana Dumitrescu')).closest('li')!
  expect(within(randAna).getByRole('button', { name: 'Prezent' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(within(randAna).getByRole('button', { name: 'Absent' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('mesajul de eroare la salvare conține numele copilului', async () => {
  const user = userEvent.setup()
  mockedMark.mockRejectedValueOnce(new Error('boom'))
  renderCatalog(trioCopii())
  const randLuca = (await screen.findByText('Luca Georgescu')).closest('li')!
  await user.click(within(randLuca).getByRole('button', { name: 'Absent' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Nu am putut salva prezența pentru Luca Georgescu.'),
  )
})

test('eroarea la încărcarea copiilor are mesaj propriu și Reîncearcă', async () => {
  mockedSessions.mockResolvedValue(oSedinta())
  mockedRoster.mockRejectedValue(new Error('boom'))
  renderPage()
  const alerte = await screen.findAllByRole('alert')
  const alerta = alerte.find((a) => /Nu am putut încărca lista de copii/.test(a.textContent ?? ''))!
  expect(alerta).toBeDefined()
  expect(within(alerta).getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  expect(screen.queryByText(/Niciun copil înscris/)).not.toBeInTheDocument()
})

test('un refetch eșuat păstrează copiii deja încărcați, fără să arate eroarea', async () => {
  const user = userEvent.setup()
  mockedSessions.mockResolvedValue(oSedinta())
  mockedRoster.mockResolvedValueOnce(trioCopii()).mockRejectedValue(new Error('blip'))
  renderPage()
  expect(await screen.findByText('Ana Dumitrescu')).toBeInTheDocument()

  const randLuca = screen.getByText('Luca Georgescu').closest('li')!
  await user.click(within(randLuca).getByRole('button', { name: 'Prezent' }))
  await waitFor(() => expect(mockedRoster).toHaveBeenCalledTimes(2))

  expect(screen.getByText('Ana Dumitrescu')).toBeInTheDocument()
  expect(screen.getByText('Luca Georgescu')).toBeInTheDocument()
  expect(screen.queryByText(/Nu am putut încărca lista de copii/)).not.toBeInTheDocument()
})

test('lista goală de copii explică rolul părinților și nu oferă niciun buton', async () => {
  renderCatalog([])
  expect(await screen.findByText(/Niciun copil înscris la acest curs încă/)).toBeInTheDocument()
  expect(screen.getByText(/Înscrierile le fac părinții/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
  expect(screen.queryByText(/din \d+ pontați/)).not.toBeInTheDocument()
})

test('rândul arată vârsta, se oprește la două rânduri și are forma cardurilor site-ului', async () => {
  renderCatalog(trioCopii())
  const nume = await screen.findByText('Ana Dumitrescu')
  const rand = nume.closest('li')!
  expect(within(rand).getByText(/^\d+ ani$/)).toBeInTheDocument()
  expect(nume.className).toMatch(/line-clamp-1/)
  expect(nume.className).toMatch(/lg:line-clamp-2/)
  expect(rand.className).toMatch(/rounded-3xl/)
  expect(rand.className).toMatch(/shadow-card/)
})

test('scheletele de încărcare au înălțimea unui rând de copil, pe fiecare viewport', async () => {
  mockedSessions.mockResolvedValue(oSedinta())
  mockedRoster.mockReturnValue(new Promise(() => {}))
  const { container } = renderPage()

  await screen.findByText('Înot începători')
  const schelete = await waitFor(() => {
    const found = container.querySelectorAll('[data-slot="skeleton"]')
    expect(found.length).toBeGreaterThanOrEqual(3)
    return found
  })
  schelete.forEach((s) => {
    expect(s.className).toMatch(/(^| )h-32( |$)/)
    expect(s.className).toMatch(/lg:h-\[70px\]/)
  })
})

test('sub 1024 px butoanele stau pe rândul lor și împart lățimea, cu ținta de tap întreagă', async () => {
  renderCatalog(trioCopii())
  const rand = (await screen.findByText('Ana Dumitrescu')).closest('li')!
  const buton = within(rand).getByRole('button', { name: 'Prezent' })
  expect(buton.className).toMatch(/min-h-11/)
  expect(buton.className).toMatch(/flex-1/)
  expect(buton.className).toMatch(/lg:min-h-9/)
  expect(buton.className).not.toMatch(/md:min-h-9/)
  expect(rand.className).toMatch(/flex-col/)
  expect(rand.className).toMatch(/lg:flex-row/)
})

test('ședința mai veche de două săptămâni e marcată ca pontare retroactivă', async () => {
  mockedSessions.mockResolvedValue(
    groups({
      past: [session({ id: 'vechi', starts_at: '2026-01-05T14:00:00.000Z' })],
      pastRecentCount: 1,
    }),
  )
  mockedRoster.mockResolvedValue(trioCopii())
  renderPage()
  expect((await screen.findAllByText('Pontare retroactivă')).length).toBeGreaterThan(0)
})

test('ședința recentă nu e marcată ca retroactivă', async () => {
  renderCatalog(trioCopii())
  await screen.findByText('2 din 3 pontați')
  expect(screen.queryByText('Pontare retroactivă')).not.toBeInTheDocument()
})

test.each([
  { age: '14 zile minus 1 ms', startsAt: '2026-08-25T12:00:00.001Z', retroactive: false },
  { age: 'exact 14 zile', startsAt: '2026-08-25T12:00:00.000Z', retroactive: false },
  { age: '14 zile plus 1 ms', startsAt: '2026-08-25T11:59:59.999Z', retroactive: true },
])('la $age, pontarea retroactivă este $retroactive', async ({ startsAt, retroactive }) => {
  vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'))
  mockedSessions.mockResolvedValue(
    groups({
      past: [session({ id: 'boundary', starts_at: startsAt, ends_at: '2026-08-25T13:00:00.000Z' })],
      pastRecentCount: retroactive ? 0 : 1,
    }),
  )
  mockedRoster.mockResolvedValue(trioCopii())
  renderPage()
  await screen.findByText('2 din 3 pontați')
  expect(screen.queryAllByText('Pontare retroactivă').length > 0).toBe(retroactive)
})

test('textul de rezervă Selectează o ședință nu mai există', async () => {
  renderCatalog(trioCopii())
  await screen.findByText('2 din 3 pontați')
  expect(screen.queryByText(/Selectează o ședință/)).not.toBeInTheDocument()
})

test('apăsarea unei ședințe strânge lista pe telefon și oferă Înapoi la ședințe', async () => {
  const user = userEvent.setup()
  mockedSessions.mockResolvedValue(
    groups({
      upcoming: [
        session({ id: 's1' }),
        session({ id: 's2', starts_at: '2026-08-21T14:00:00.000Z' }),
      ],
    }),
  )
  mockedRoster.mockResolvedValue(trioCopii())
  renderPage()

  const carduri = await screen.findAllByRole('button', { name: /Înot începători/ })
  expect(screen.queryByRole('button', { name: /Înapoi la ședințe/ })).not.toBeInTheDocument()
  expect(carduri.map((c) => c.closest('li')!.className).join(' ')).not.toMatch(/hidden/)

  await user.click(carduri[1])

  const inapoi = await screen.findByRole('button', { name: /Înapoi la ședințe/ })
  expect(inapoi.className).toMatch(/md:hidden/)
  const dupa = screen.getAllByRole('button', { name: /Înot începători/ })
  expect(dupa.filter((c) => /hidden md:block/.test(c.closest('li')!.className))).toHaveLength(1)
  expect(dupa[1].closest('li')!.className).not.toMatch(/hidden/)

  await user.click(inapoi)
  expect(screen.queryByRole('button', { name: /Înapoi la ședințe/ })).not.toBeInTheDocument()
  expect(dupa[1]).toHaveAttribute('aria-current', 'true')
})

test('pe telefon catalogul stă sub ședința aleasă, cu contor și acțiune în masă', async () => {
  const user = userEvent.setup()
  renderCatalog(trioCopii())
  const card = await screen.findByRole('button', { name: /Înot începători/ })
  await user.click(card)
  const panou = card.closest('li')!.querySelector('div.md\\:hidden') as HTMLElement
  expect(panou).not.toBeNull()
  expect(within(panou).getByText('2 din 3 pontați')).toBeInTheDocument()
  expect(within(panou).getByRole('button', { name: 'Toți prezenți' })).toBeInTheDocument()
})
