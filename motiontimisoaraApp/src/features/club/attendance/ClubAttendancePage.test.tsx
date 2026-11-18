import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import ClubAttendancePage from './ClubAttendancePage'
import { getClubSessions, type AdminSession } from '@/api/attendance/admin-sessions'
import { markAttendance, markManyPresent } from '@/api/attendance'
import {
  getActivityMarkedCounts,
  getManagedActivityRoster,
  markActivityAttendance,
} from '@/api/attendance/activity-attendance'
import { getClubActivities, getMyClub, type Club, type ClubActivity } from '@/api/club'
import { getSessionRoster } from '@/api/coach'

vi.mock('@/api/attendance/admin-sessions', () => ({
  ADMIN_SESSION_WINDOW_DAYS: 30,
  getClubSessions: vi.fn(),
}))
vi.mock('@/api/attendance', () => ({
  AttendanceError: class extends Error {},
  markAttendance: vi.fn(),
  markManyPresent: vi.fn(),
}))
vi.mock('@/api/club', () => ({ getMyClub: vi.fn(), getClubActivities: vi.fn() }))
vi.mock('@/api/attendance/activity-attendance', () => ({
  getManagedActivityRoster: vi.fn(),
  getActivityMarkedCounts: vi.fn(),
  markActivityAttendance: vi.fn(),
}))
vi.mock('@/api/coach', () => ({ getSessionRoster: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedSessions = vi.mocked(getClubSessions)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ClubAttendancePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

function session(p: Partial<AdminSession> & { id: string }): AdminSession {
  return {
    startsAt: daysAgo(2),
    endsAt: daysAgo(2),
    courseId: 'k1',
    courseName: 'Înot mic',
    locationName: 'Bazinul Olimpic',
    sportId: 's1',
    sportName: 'Înot',
    coachName: 'Radu Stan',
    organizerKey: 'coach:u1',
    organizerKind: 'coach',
    organizerName: 'Radu Stan',
    enrolledCount: 2,
    markedCount: 0,
    ...p,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMyClub).mockResolvedValue({ id: 'c1', name: 'Delfinul' } as Club)
  mockedSessions.mockResolvedValue([
    session({ id: 'o1' }),
    session({ id: 'o2', startsAt: daysAgo(3) }),
    session({
      id: 'o3',
      courseName: 'Polo',
      coachName: 'Ana Rusu',
      organizerKey: 'coach:u2',
      organizerName: 'Ana Rusu',
    }),
    session({ id: 'o4', courseName: 'Înot viitor', startsAt: daysAgo(-3) }),
  ])
  vi.mocked(getSessionRoster).mockResolvedValue([
    { child_id: 'a', child_name: 'Ana Popa', child_birth_date: '2016-03-01', status: null },
    { child_id: 'b', child_name: 'Bogdan Ilie', child_birth_date: '2017-03-01', status: null },
  ])
  vi.mocked(markAttendance).mockResolvedValue(undefined)
  vi.mocked(markManyPresent).mockResolvedValue(undefined)
})

describe('ClubAttendancePage', () => {
  it('lists the sessions of the club grouped by coach', async () => {
    renderPage()
    const radu = await screen.findByRole('region', { name: 'Radu Stan' })
    expect(mockedSessions).toHaveBeenCalledWith('c1')
    expect(within(radu).getByText('nepontate din 3', { exact: false })).toBeInTheDocument()
    await userEvent.click(within(radu).getByRole('button', { name: /Radu Stan/ }))
    expect(within(radu).getAllByRole('button', { name: /^Pontează/ })).toHaveLength(2)
    const ana = screen.getByRole('region', { name: 'Ana Rusu' })
    expect(within(ana).getAllByRole('button', { name: /^Pontează/ })).toHaveLength(1)
    expect(screen.getByText(/3 ședințe la 2 antrenori/)).toBeInTheDocument()
    expect(screen.queryByText('Cluburi', { exact: false })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveAttribute(
      'placeholder',
      'Caută curs, antrenor sau locație',
    )
  })

  it('marks one child and all children from the roster', async () => {
    renderPage()
    await userEvent.click((await screen.findAllByRole('button', { name: /^Pontează/ }))[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Absent: Ana Popa' }))
    await waitFor(() => expect(markAttendance).toHaveBeenCalledWith('o3', 'a', 'ABSENT'))
    await waitFor(() => expect(mockedSessions).toHaveBeenCalledTimes(2))
    await userEvent.click(screen.getByRole('button', { name: 'Toți prezenți' }))
    await waitFor(() => expect(markManyPresent).toHaveBeenCalledWith('o3', ['a', 'b']))
  })

  it('locks marking for a session that has not started', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Următoare 1' }))
    await userEvent.click(screen.getByRole('button', { name: /^Pontează/ }))
    expect(await screen.findByRole('button', { name: 'Prezent: Ana Popa' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Toți prezenți' })).toBeDisabled()
  })

  it('marks the activities of the club through the managed roster', async () => {
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
    const activity = (p: Partial<ClubActivity>) =>
      ({
        start_time: '10:00:00',
        end_time: '12:00:00',
        location: { id: 'l1', name: 'Bazin' },
        enrolled: 2,
        ...p,
      }) as ClubActivity
    vi.mocked(getClubActivities).mockResolvedValue([
      activity({ id: 'a1', name: 'Cros de toamnă', activity_date: day(-2) }),
      activity({ id: 'a2', name: 'Fără copii', activity_date: day(-3), enrolled: 0 }),
    ])
    vi.mocked(getActivityMarkedCounts).mockResolvedValue(new Map([['a1', 1]]))
    vi.mocked(getManagedActivityRoster).mockResolvedValue([
      { child_id: 'a', child_name: 'Ana Popa', child_birth_date: '2016-03-01', status: 'PRESENT' },
      { child_id: 'b', child_name: 'Bogdan Ilie', child_birth_date: '2017-03-01', status: null },
    ])
    vi.mocked(markActivityAttendance).mockResolvedValue(1)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Activități' }))
    expect(await screen.findByText('1/2 pontați')).toBeInTheDocument()
    expect(getClubActivities).toHaveBeenCalledWith('c1')
    expect(screen.queryByText('Fără copii')).not.toBeInTheDocument()
    await waitFor(() => expect(getManagedActivityRoster).toHaveBeenCalledWith('a1'))
    await userEvent.click((await screen.findAllByRole('button', { name: 'Absent: Bogdan Ilie' }))[0])
    await waitFor(() =>
      expect(markActivityAttendance).toHaveBeenCalledWith('a1', ['b'], 'ABSENT', undefined),
    )
  })

  it('retries after a failed load and shows the empty state', async () => {
    mockedSessions.mockRejectedValueOnce(new Error('x'))
    mockedSessions.mockResolvedValueOnce([])
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Reîncearcă' }))
    expect(
      await screen.findByText('Nicio ședință în ultimele și următoarele 30 de zile.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Ședințele apar aici după ce programezi cursurile clubului.'),
    ).toBeInTheDocument()
  })
})
