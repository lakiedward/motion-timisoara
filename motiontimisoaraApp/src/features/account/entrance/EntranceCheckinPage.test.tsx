import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import EntranceCheckinPage from './EntranceCheckinPage'
import {
  entranceCheckin,
  getEntranceCheckinOptions,
  type EntranceOption,
} from '@/api/attendance/entrance'

vi.mock('@/api/attendance/entrance', () => ({
  getEntranceCheckinOptions: vi.fn(),
  entranceCheckin: vi.fn(),
}))

const TOKEN = '0123456789abcdef0123456789abcdef'
const SESSION = {
  occurrenceId: 'o1',
  courseId: 'c1',
  courseName: 'Înot începători',
  startsAt: '2026-11-12T15:00:00Z',
  endsAt: '2026-11-12T16:00:00Z',
}
const maria: EntranceOption = {
  ...SESSION,
  childId: 'ch1',
  childName: 'Maria',
  remainingSessions: 4,
  state: 'AVAILABLE',
}
const ion: EntranceOption = { ...maria, childId: 'ch2', childName: 'Ion', remainingSessions: 2 }

function renderPage(path = `/prezenta/${TOKEN}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/prezenta/:token" element={<EntranceCheckinPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function offer(options: EntranceOption[]) {
  vi.mocked(getEntranceCheckinOptions).mockResolvedValue({
    success: true,
    coachName: 'Ana Pop',
    serverTime: '2026-11-12T14:50:00Z',
    options,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('un singur copil în fereastră e ales deja; o apăsare marchează prezența', async () => {
  offer([maria])
  vi.mocked(entranceCheckin).mockResolvedValue({
    success: true,
    outcome: 'recorded',
    occurrenceId: 'o1',
    childId: 'ch1',
    childName: 'Maria',
    courseName: 'Înot începători',
    startsAt: SESSION.startsAt,
    remainingSessions: 3,
  })
  renderPage()

  expect(await screen.findByText('Codul antrenorului Ana Pop')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /Maria/ })).toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'Marchează prezent' }))

  expect(await screen.findByText('Prezență salvată pentru Maria')).toBeInTheDocument()
  expect(screen.getByText(/Mai are 3 ședințe în abonament/)).toBeInTheDocument()
  expect(entranceCheckin).toHaveBeenCalledWith(
    expect.objectContaining({ token: TOKEN, occurrenceId: 'o1', childId: 'ch1' }),
  )
})

test('cu doi copii, părintele alege înainte să marcheze', async () => {
  offer([maria, ion])
  renderPage()

  const button = await screen.findByRole('button', { name: 'Marchează prezent' })
  expect(button).toBeDisabled()
  expect(screen.getByText('Alege copilul și ședința, apoi marchează prezența.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: /Ion/ }))
  expect(button).toBeEnabled()
})

test('copiii deja prezenți sau corectați de antrenor nu pot fi aleși', async () => {
  offer([
    { ...maria, state: 'ALREADY_PRESENT' },
    { ...ion, state: 'MANUAL_OVERRIDE' },
  ])
  renderPage()

  expect(await screen.findByText('Prezență salvată')).toBeInTheDocument()
  expect(screen.getByText('Corectat de antrenor')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /Maria/ })).toBeDisabled()
  expect(screen.getByRole('radio', { name: /Ion/ })).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Vezi prezența' })).toHaveAttribute(
    'href',
    '/account/attendance',
  )
})

test('în afara ferestrei, pagina spune când se deschide următoarea ședință', async () => {
  vi.mocked(getEntranceCheckinOptions).mockResolvedValue({
    success: false,
    code: 'OUTSIDE_WINDOW',
    coachName: 'Ana Pop',
    serverTime: '2026-11-12T08:00:00Z',
    nextOpensAt: '2026-11-12T14:45:00Z',
  })
  renderPage()

  expect(
    await screen.findByRole('heading', { name: 'Acum nu e nicio ședință deschisă' }),
  ).toBeInTheDocument()
  expect(screen.getByText(/se deschide azi la 16:45/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Verifică din nou' }))
  await waitFor(() => expect(getEntranceCheckinOptions).toHaveBeenCalledTimes(2))
})

test('codul vechi sau greșit primește explicația, fără reîncercare', async () => {
  vi.mocked(getEntranceCheckinOptions).mockResolvedValue({
    success: false,
    code: 'INVALID_CODE',
    coachName: null,
    serverTime: null,
    nextOpensAt: null,
  })
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Codul nu mai e valabil' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
})

test('un link stricat nu ajunge la server', async () => {
  renderPage('/prezenta/nu-e-cod')
  expect(await screen.findByRole('heading', { name: 'Codul nu mai e valabil' })).toBeInTheDocument()
  expect(getEntranceCheckinOptions).not.toHaveBeenCalled()
})

test('fără copii înscriși la antrenor, pagina trimite la înscrieri', async () => {
  vi.mocked(getEntranceCheckinOptions).mockResolvedValue({
    success: false,
    code: 'NOT_ENROLLED',
    coachName: 'Ana Pop',
    serverTime: null,
    nextOpensAt: null,
  })
  renderPage()
  expect(
    await screen.findByRole('heading', { name: 'Niciun copil înscris aici' }),
  ).toBeInTheDocument()
  expect(screen.getByText(/cursurile lui Ana Pop/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Vezi înscrierile' })).toHaveAttribute(
    'href',
    '/account/enrollments',
  )
})

test('refuzul antrenorului apare clar, iar după o pierdere de rețea se retrimite aceeași cerere', async () => {
  offer([maria])
  vi.mocked(entranceCheckin)
    .mockRejectedValueOnce(new Error('Failed to fetch'))
    .mockResolvedValueOnce({ success: false, code: 'MANUAL_OVERRIDE' })
  renderPage()

  const button = await screen.findByRole('button', { name: 'Marchează prezent' })
  await userEvent.click(button)
  expect(await screen.findByText('Prezența nu a ajuns la server.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Marchează prezent' }))

  expect(await screen.findByText('Antrenorul a corectat deja prezența')).toBeInTheDocument()
  const [first, second] = vi
    .mocked(entranceCheckin)
    .mock.calls.map(([request]) => request.requestId)
  expect(second).toBe(first)
})

test('o eroare de rețea la verificare oferă reîncercarea', async () => {
  vi.mocked(getEntranceCheckinOptions).mockRejectedValue(new Error('Failed to fetch'))
  renderPage()
  expect(
    await screen.findByRole('heading', { name: 'Nu am putut verifica ședințele.' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('ședințele rămase se spun corect la singular și plural', async () => {
  const { remainingText } = await import('./entrance-messages')
  expect(remainingText(1)).toBe('Mai are o ședință în abonament.')
  expect(remainingText(21)).toBe('Mai are 21 de ședințe în abonament.')
  expect(remainingText(0)).toBe('Nu mai are ședințe rămase.')
  expect(remainingText(null)).toBeNull()
})
