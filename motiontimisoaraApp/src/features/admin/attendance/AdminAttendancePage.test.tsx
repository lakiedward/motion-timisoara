import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { toast } from 'sonner'

import AdminAttendancePage from './AdminAttendancePage'
import { getAdminSessions, type AdminSession } from '@/api/attendance/admin-sessions'
import { markAttendance, markManyPresent } from '@/api/attendance'
import { getSessionRoster } from '@/api/coach'

vi.mock('@/api/attendance/admin-sessions', () => ({
  ADMIN_SESSION_WINDOW_DAYS: 30,
  getAdminSessions: vi.fn(),
}))
vi.mock('@/api/attendance', () => ({
  AttendanceError: class extends Error {},
  markAttendance: vi.fn(),
  markManyPresent: vi.fn(),
}))
vi.mock('@/api/coach', () => ({ getSessionRoster: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedSessions = vi.mocked(getAdminSessions)
const mockedRoster = vi.mocked(getSessionRoster)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminAttendancePage />
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
    organizerKey: 'club:c1',
    organizerKind: 'club',
    organizerName: 'Clubul Delfinul',
    enrolledCount: 3,
    markedCount: 0,
    ...p,
  }
}

const lista = () => [
  ...Array.from({ length: 6 }, (_, i) => session({ id: `c${i}`, startsAt: daysAgo(i + 1) })),
  session({ id: 'done', courseName: 'Polo', markedCount: 3 }),
  session({ id: 'next', courseName: 'Înot viitor', startsAt: daysAgo(-3) }),
  session({
    id: 'k1',
    courseId: 'k9',
    courseName: 'Tenis copii',
    organizerKey: 'coach:u1',
    organizerKind: 'coach',
    organizerName: 'Ana Rusu',
    coachName: 'Ana Rusu',
    locationName: 'Baza Bega',
    sportId: 's2',
    sportName: 'Tenis',
  }),
]

const roster = [
  {
    child_id: 'a',
    child_name: 'Ana Popa',
    child_birth_date: '2016-03-01',
    status: 'PRESENT' as const,
  },
  { child_id: 'b', child_name: 'Bogdan Ilie', child_birth_date: '2017-03-01', status: null },
  { child_id: 'c', child_name: 'Carla Matei', child_birth_date: '2018-03-01', status: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockedSessions.mockResolvedValue(lista())
  mockedRoster.mockResolvedValue(roster)
  vi.mocked(markAttendance).mockResolvedValue(undefined)
  vi.mocked(markManyPresent).mockResolvedValue(undefined)
})

describe('AdminAttendancePage', () => {
  it('groups unmarked sessions by organizer with a preview of five', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: 'Nepontate 7' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const clubs = screen.getByRole('region', { name: 'Cluburi' })
    const club = within(clubs).getByRole('region', { name: 'Clubul Delfinul' })
    expect(within(club).getByText('nepontate din 8', { exact: false })).toBeInTheDocument()
    expect(within(club).getAllByRole('button', { name: /^Pontează/ })).toHaveLength(5)
    await userEvent.click(within(club).getByRole('button', { name: 'Vezi toate cele 6 ședințe' }))
    expect(within(club).getAllByRole('button', { name: /^Pontează/ })).toHaveLength(6)
    expect(screen.getByRole('region', { name: 'Antrenori independenți' })).toBeInTheDocument()
    expect(screen.queryByText('Polo')).not.toBeInTheDocument()
  })

  it('searches across statuses and offers results in other filters', async () => {
    renderPage()
    await screen.findByRole('region', { name: 'Clubul Delfinul' })
    await userEvent.type(screen.getByRole('searchbox'), 'polo')
    expect(screen.getByText('Nicio ședință pentru filtrele alese.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Încă 1 rezultat în alte filtre' }))
    expect(screen.getByRole('button', { name: 'Toate 9' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Polo', { selector: 'mark' })).toBeInTheDocument()
    expect(screen.getByText('Pontată')).toBeInTheDocument()
  })

  it('marks children from the inline roster', async () => {
    renderPage()
    await userEvent.click((await screen.findAllByRole('button', { name: /^Pontează/ }))[0])
    expect(await screen.findByText('1 din 3 copii pontați')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Prezent: Bogdan Ilie' }))
    await waitFor(() => expect(markAttendance).toHaveBeenCalledWith('c0', 'b', 'PRESENT'))
    await userEvent.click(screen.getByRole('button', { name: 'Prezent: Ana Popa' }))
    await waitFor(() => expect(markAttendance).toHaveBeenCalledWith('c0', 'a', null))
    await userEvent.click(screen.getByRole('button', { name: 'Toți prezenți' }))
    await waitFor(() => expect(markManyPresent).toHaveBeenCalledWith('c0', ['b', 'c']))
  })

  it('reports a failed save without losing the roster', async () => {
    vi.mocked(markAttendance).mockRejectedValue(new Error('x'))
    renderPage()
    await userEvent.click((await screen.findAllByRole('button', { name: /^Pontează/ }))[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Absent: Carla Matei' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Nu am putut salva prezența pentru Carla Matei.'),
    )
    expect(screen.getByText('Carla Matei')).toBeInTheDocument()
  })

  it('shows a retry when the list fails and an empty state without sessions', async () => {
    mockedSessions.mockRejectedValueOnce(new Error('x'))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Reîncearcă' }))
    expect(await screen.findByRole('region', { name: 'Clubul Delfinul' })).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    mockedSessions.mockResolvedValue([])
    renderPage()
    expect(
      await screen.findByText('Nicio ședință în ultimele și următoarele 30 de zile.'),
    ).toBeInTheDocument()
  })
})
