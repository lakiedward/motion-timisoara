import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import { CoachActivityAttendance } from './CoachActivityAttendance'
import { getMyActivities } from '@/api/coach'
import {
  getActivityMarkedCounts,
  getActivityRoster,
  markActivityAttendance,
} from '@/api/attendance/activity-attendance'

vi.mock('@/api/coach', () => ({ getMyActivities: vi.fn() }))
vi.mock('@/api/attendance/activity-attendance', () => ({
  getActivityMarkedCounts: vi.fn(),
  getActivityRoster: vi.fn(),
  markActivityAttendance: vi.fn(),
}))

const activity = (id: string, name: string, activity_date: string, enrolled: number) => ({
  id,
  name,
  activity_date,
  start_time: '10:00:00',
  end_time: '12:00:00',
  enrolled,
  location: { id: 'l1', name: 'Parcul Rozelor' },
  sport: null,
})

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CoachActivityAttendance />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-21T09:00:00.000Z') })
  vi.mocked(getMyActivities).mockResolvedValue([
    activity('a1', 'Ștafeta de toamnă', '2026-10-18', 2),
    activity('a2', 'Înot de Halloween', '2026-10-31', 3),
    activity('a3', 'Fără copii', '2026-10-19', 0),
  ] as never)
  vi.mocked(getActivityMarkedCounts).mockResolvedValue(new Map([['a1', 1]]))
  vi.mocked(getActivityRoster).mockResolvedValue([
    { child_id: 'c1', child_name: 'Ana Pop', child_birth_date: '2017-03-01', status: 'PRESENT' },
    { child_id: 'c2', child_name: 'Dan Ilie', child_birth_date: '2016-05-01', status: null },
  ])
  vi.mocked(markActivityAttendance).mockResolvedValue(1)
})

afterEach(() => vi.useRealTimers())

test('grupează activitățile cu copii în trecute și următoare, cu numărul pontat', async () => {
  renderList()
  const trecute = await screen.findByRole('region', { name: 'Azi și trecute' })
  expect(within(trecute).getByText('Ștafeta de toamnă')).toBeInTheDocument()
  expect(await within(trecute).findByText('1/2 pontați')).toBeInTheDocument()
  const urmatoare = screen.getByRole('region', { name: 'Următoare' })
  expect(within(urmatoare).getByText('Înot de Halloween')).toBeInTheDocument()
  expect(screen.queryByText('Fără copii')).not.toBeInTheDocument()
})

test('Absent la un copil trimite pontajul activității selectate', async () => {
  const user = userEvent.setup()
  renderList()
  const [buton] = await screen.findAllByRole('button', { name: 'Absent: Dan Ilie' })
  await user.click(buton)
  await waitFor(() =>
    expect(markActivityAttendance).toHaveBeenCalledWith('a1', ['c2'], 'ABSENT', undefined),
  )
})

test('o activitate viitoare arată când se deschide pontajul și blochează butoanele', async () => {
  const user = userEvent.setup()
  renderList()
  await user.click(await screen.findByRole('button', { name: /Înot de Halloween/ }))
  expect(
    (await screen.findAllByText(/Pontajul se deschide în ziua activității/)).length,
  ).toBeGreaterThan(0)
  for (const b of screen.getAllByRole('button', { name: /Prezent: Ana Pop/ }))
    expect(b).toBeDisabled()
})
