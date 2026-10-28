import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import type { AdminSession } from '@/api/attendance/admin-sessions'
import { markAttendance, markManyPresent } from '@/api/attendance'
import { getSessionRoster, type RosterEntry } from '@/api/coach'
import { CoachSessionCatalog } from './CoachSessionCatalog'

vi.mock('@/api/coach', () => ({ getSessionRoster: vi.fn(), PAST_VISIBLE_DAYS: 14 }))
vi.mock('@/api/attendance', () => ({
  AttendanceError: class extends Error {},
  markAttendance: vi.fn(),
  markManyPresent: vi.fn(),
}))

const NOW = new Date('2026-10-28T13:00:00.000Z')

const session = (startsAt: string): AdminSession => ({
  id: 'o1',
  startsAt,
  endsAt: new Date(Date.parse(startsAt) + 3_600_000).toISOString(),
  courseId: 'c1',
  courseName: 'Înot începători',
  locationName: 'Bazin Olimpic',
  sportId: null,
  sportName: null,
  coachName: null,
  organizerKey: 'c1',
  organizerKind: 'coach',
  organizerName: 'Înot începători',
  enrolledCount: 2,
  markedCount: 0,
})

const rows = (status: RosterEntry['status'] = null): RosterEntry[] => [
  { child_id: 'k1', child_name: 'Ana Pop', child_birth_date: '2018-01-01', status },
  { child_id: 'k2', child_name: 'Dan Ionescu', child_birth_date: '2017-05-05', status: null },
]

function renderCatalog(s: AdminSession) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoachSessionCatalog session={s} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  vi.mocked(getSessionRoster).mockResolvedValue(rows())
  vi.mocked(markAttendance).mockResolvedValue(undefined)
  vi.mocked(markManyPresent).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('o ședință viitoare explică de când se poate ponta și nu lasă marcarea', async () => {
  renderCatalog(session('2026-11-03T16:00:00.000Z'))
  expect(await screen.findByText('Ana Pop')).toBeInTheDocument()
  expect(
    screen.getByText(/Pontajul se deschide la începutul ședinței, Marți 3 noiembrie/),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Prezent: Ana Pop' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Absent: Dan Ionescu' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Toți prezenți' })).toBeDisabled()
})

test('un pontaj pus înainte pe o ședință viitoare se poate anula, dar nu schimba', async () => {
  vi.mocked(getSessionRoster).mockResolvedValue(rows('PRESENT'))
  const user = userEvent.setup()
  renderCatalog(session('2026-11-03T16:00:00.000Z'))
  const present = await screen.findByRole('button', { name: 'Prezent: Ana Pop' })
  expect(screen.getByRole('button', { name: 'Absent: Ana Pop' })).toBeDisabled()
  await user.click(present)
  expect(markAttendance).toHaveBeenCalledWith('o1', 'k1', null)
})

test('o ședință începută se pontează normal, fără mesaj', async () => {
  const user = userEvent.setup()
  renderCatalog(session('2026-10-28T12:30:00.000Z'))
  await user.click(await screen.findByRole('button', { name: 'Prezent: Ana Pop' }))
  expect(markAttendance).toHaveBeenCalledWith('o1', 'k1', 'PRESENT')
  expect(screen.queryByText(/Pontajul se deschide/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Toți prezenți' })).toBeEnabled()
})

test('pontajul se deschide singur la ora de început, fără reîncărcare', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: NOW })
  renderCatalog(session('2026-10-28T13:01:00.000Z'))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100)
  })
  expect(screen.getByRole('button', { name: 'Prezent: Ana Pop' })).toBeDisabled()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000)
  })
  expect(screen.getByRole('button', { name: 'Prezent: Ana Pop' })).toBeEnabled()
  expect(screen.queryByText(/Pontajul se deschide/)).not.toBeInTheDocument()
})
