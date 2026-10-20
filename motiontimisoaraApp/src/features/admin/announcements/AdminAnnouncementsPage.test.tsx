import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { toast } from 'sonner'

import AdminAnnouncementsPage from './AdminAnnouncementsPage'
import {
  getAllAnnouncementsAdmin,
  type AdminAnnouncement,
} from '@/api/announcements/admin-announcements'
import { deleteClubAnnouncement, setAnnouncementActive } from '@/api/club'
import { setCourseAnnouncementPinned } from '@/api/coach-announcements'
import { stergeFisiereleAnuntului } from '@/api/attachments'

vi.mock('@/api/announcements/admin-announcements', () => ({ getAllAnnouncementsAdmin: vi.fn() }))
vi.mock('@/api/club', () => ({ setAnnouncementActive: vi.fn(), deleteClubAnnouncement: vi.fn() }))
vi.mock('@/api/coach-announcements', () => ({
  setCourseAnnouncementPinned: vi.fn(),
  deleteCourseAnnouncement: vi.fn(),
}))
vi.mock('@/api/attachments', () => ({
  getAtasamente: vi.fn(),
  stergeFisiereleAnuntului: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedList = vi.mocked(getAllAnnouncementsAdmin)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminAnnouncementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function ann(p: Partial<AdminAnnouncement> & { id: string }): AdminAnnouncement {
  return {
    source: 'club',
    title: 'Program nou',
    content: 'Text scurt',
    createdAt: '2026-10-01T10:00:00Z',
    visible: true,
    pinned: false,
    priority: 'NORMAL',
    organizerKey: 'club:c1',
    organizerKind: 'club',
    organizerName: 'Clubul Delfinul',
    audience: 'Toți părinții clubului',
    coachName: null,
    mediaCount: 0,
    ...p,
  }
}

const lista = () => [
  ...Array.from({ length: 5 }, (_, i) =>
    ann({ id: `a${i}`, title: `Anunț ${i + 1}`, createdAt: `2026-10-0${i + 1}T10:00:00Z` }),
  ),
  ann({ id: 'h1', title: 'Anunț ascuns', visible: false }),
  ann({
    id: 'k1',
    source: 'coach',
    title: null,
    content: 'Aduceți ochelari',
    audience: 'Curs: Înot mic',
    organizerKey: 'coach:u1',
    organizerKind: 'coach',
    organizerName: 'Ana Rusu',
    pinned: true,
  }),
]

beforeEach(() => {
  vi.clearAllMocks()
  mockedList.mockResolvedValue(lista())
  vi.mocked(setAnnouncementActive).mockResolvedValue({} as never)
  vi.mocked(setCourseAnnouncementPinned).mockResolvedValue(undefined)
  vi.mocked(deleteClubAnnouncement).mockResolvedValue({} as never)
  vi.mocked(stergeFisiereleAnuntului).mockResolvedValue(undefined)
})

test('groups visible announcements by organizer with a preview of four', async () => {
  renderPage()
  const clubs = await screen.findByRole('region', { name: 'Cluburi' })
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anunțuri(7)')
  const delfin = within(clubs).getByRole('region', { name: 'Clubul Delfinul' })
  expect(within(delfin).getByText('vizibile din 6', { exact: false })).toBeInTheDocument()
  expect(within(delfin).getAllByRole('listitem')).toHaveLength(4)
  expect(within(delfin).queryByText('Anunț ascuns')).not.toBeInTheDocument()
  await userEvent.click(within(delfin).getByRole('button', { name: 'Vezi toate cele 5 anunțuri' }))
  expect(within(delfin).getAllByRole('listitem')).toHaveLength(5)
  expect(screen.getByRole('region', { name: 'Antrenori independenți' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Anunț nou/ })).toHaveAttribute(
    'href',
    '/admin/announcements/new',
  )
})

test('filters by status and source and searches with a hint for other filters', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('region', { name: 'Cluburi' })
  await user.click(screen.getByRole('button', { name: 'Ascunse 1' }))
  expect(screen.getByText('Anunț ascuns')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Toate 7' }))
  await user.click(screen.getByRole('button', { name: 'Antrenor 1' }))
  expect(screen.queryByRole('region', { name: 'Cluburi' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Toți expeditorii' }))
  await user.click(screen.getByRole('button', { name: 'Vizibile 6' }))
  await user.type(screen.getByRole('searchbox'), 'ascuns')
  expect(screen.getByRole('button', { name: 'Încă 1 rezultat în alte filtre' })).toBeInTheDocument()
})

test('hides a club announcement and unpins a coach announcement', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('region', { name: 'Cluburi' })
  await user.click(screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Anunț 5”' }))
  await waitFor(() => expect(setAnnouncementActive).toHaveBeenCalledWith('a4', false))
  await user.click(screen.getByRole('button', { name: 'Desprinde anunțul „Curs: Înot mic”' }))
  await waitFor(() => expect(setCourseAnnouncementPinned).toHaveBeenCalledWith('k1', false))
  expect(toast.success).toHaveBeenCalledWith('Anunț desprins.')
})

test('deletes after confirmation, removing the files first', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('region', { name: 'Cluburi' })
  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Anunț 5”' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Șterge' }))
  await waitFor(() => expect(deleteClubAnnouncement).toHaveBeenCalledWith('a4'))
  expect(stergeFisiereleAnuntului).toHaveBeenCalledWith('a4', 'club')
})

test('shows retry when the list fails to load', async () => {
  mockedList.mockRejectedValueOnce(new Error('x'))
  renderPage()
  await screen.findByText('Nu am putut încărca anunțurile.')
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await screen.findByRole('region', { name: 'Cluburi' })
})
