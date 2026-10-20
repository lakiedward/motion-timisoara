import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { toast } from 'sonner'

import AdminActivitiesPage from './AdminActivitiesPage'
import {
  getAllActivitiesAdmin,
  setActivityActiveAdmin,
  type AdminActivity,
} from '@/api/activities/admin-activities'

vi.mock('@/api/activities/admin-activities', () => ({
  getAllActivitiesAdmin: vi.fn(),
  setActivityActiveAdmin: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedList = vi.mocked(getAllActivitiesAdmin)
const mockedToggle = vi.mocked(setActivityActiveAdmin)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminActivitiesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function act(p: Partial<AdminActivity> & { id: string; name: string }): AdminActivity {
  return {
    activity_date: '2099-05-04',
    start_time: '10:00:00',
    end_time: '12:00:00',
    active: true,
    club_id: null,
    coach_id: 'u1',
    sport_id: 's1',
    price: 5000,
    currency: 'RON',
    capacity: 10,
    sport: { id: 's1', name: 'Înot' },
    coach: { id: 'u1', name: 'Ana Rusu' },
    location: { id: 'l1', name: 'Bazin Neptun' },
    club: null,
    enrolled: 0,
    ...p,
  } as AdminActivity
}

const delfin = { id: 'c1', name: 'Clubul Delfinul' }
const clubRows = Array.from({ length: 5 }, (_, i) =>
  act({
    id: `c${i}`,
    name: `Atelier ${i + 1}`,
    club_id: 'c1',
    club: delfin,
    coach: { id: 'u9', name: 'Dan Pop' },
    activity_date: `2099-0${i + 1}-10`,
    enrolled: i === 0 ? 2 : 0,
  }),
)
const lista = () => [
  ...clubRows,
  act({ id: 'p1', name: 'Tură trecută', activity_date: '2000-01-01' }),
  act({ id: 'i1', name: 'Alergare oprită', active: false }),
]

beforeEach(() => {
  vi.clearAllMocks()
  mockedList.mockResolvedValue(lista())
  mockedToggle.mockResolvedValue(undefined)
})

test('groups upcoming activities by organizer with edit links and a new button', async () => {
  renderPage()
  await screen.findByRole('region', { name: 'Clubul Delfinul' })
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Activități\s*\(7\)/)
  expect(screen.getByRole('link', { name: /Activitate nouă/ })).toHaveAttribute(
    'href',
    '/admin/activities/new',
  )
  expect(screen.getByRole('status')).toHaveTextContent('5 activități la 1 organizator')
  const club = screen.getByRole('region', { name: 'Clubul Delfinul' })
  expect(within(club).getByText('viitoare din 5', { exact: false })).toBeInTheDocument()
  expect(within(club).getAllByRole('listitem')).toHaveLength(4)
  expect(within(club).getAllByText(/Antrenor:/)[0]).toHaveTextContent('Antrenor: Dan Pop')
  expect(screen.getByRole('link', { name: 'Editează Atelier 1' })).toHaveAttribute(
    'href',
    '/admin/activities/c0/edit',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Vezi toate cele 5 activități' }))
  expect(within(club).getAllByRole('listitem')).toHaveLength(5)
})

test('filters by status and search, and points to results in other filters', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('region', { name: 'Clubul Delfinul' })
  await user.click(screen.getByRole('button', { name: /^Încheiate/ }))
  expect(screen.getByRole('region', { name: 'Ana Rusu' })).toHaveTextContent('Tură trecută')
  await user.click(screen.getByRole('button', { name: /^Viitoare/ }))
  await user.type(screen.getByRole('searchbox'), 'oprita')
  expect(await screen.findByText('Nicio activitate pentru filtrele alese.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Încă 1 rezultat în alte filtre' }))
  expect(screen.getByRole('button', { name: 'Activează Alergare oprită' })).toBeInTheDocument()
})

test('deactivation asks for confirmation only when there are enrollments', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Dezactivează Atelier 2' }))
  expect(mockedToggle).toHaveBeenCalledWith('c1', false)
  await user.click(screen.getByRole('button', { name: 'Dezactivează Atelier 1' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('Are 2 înscrieri active.')
  await user.click(within(dialog).getByRole('button', { name: 'Dezactivează' }))
  await waitFor(() => expect(mockedToggle).toHaveBeenCalledWith('c0', false))
  expect(toast.success).toHaveBeenCalledWith('Atelier 1 a fost dezactivată.')
})

test('shows empty and error states', async () => {
  mockedList.mockResolvedValueOnce([])
  const { unmount } = renderPage()
  expect(await screen.findByText('Nicio activitate încă.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Creează prima activitate' })).toBeInTheDocument()
  unmount()
  mockedList.mockRejectedValueOnce(new Error('x'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca activitățile.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})
