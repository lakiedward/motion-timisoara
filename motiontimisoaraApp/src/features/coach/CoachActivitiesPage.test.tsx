import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { toast } from 'sonner'

import CoachActivitiesPage from './CoachActivitiesPage'
import { getMyActivities, setActivityActive, type CoachActivity } from '@/api/coach'

vi.mock('@/api/coach', () => ({ getMyActivities: vi.fn(), setActivityActive: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedList = vi.mocked(getMyActivities)
const mockedToggle = vi.mocked(setActivityActive)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoachActivitiesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function act(p: Partial<CoachActivity> & { id: string; name: string }): CoachActivity {
  return {
    activity_date: '2099-05-04',
    start_time: '10:00:00',
    end_time: '12:00:00',
    active: true,
    sport_id: 's1',
    sport: { id: 's1', code: 'swim', name: 'Înot' },
    location: { id: 'l1', name: 'Bazin Neptun' },
    price: 5000,
    currency: 'RON',
    enrolled: 0,
    ...p,
  } as CoachActivity
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('error state offers a retry instead of the empty message', async () => {
  mockedList.mockRejectedValue(new Error('500'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca activitățile.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Reîncearcă/ })).toBeInTheDocument()
  expect(screen.queryByText('Nicio activitate încă.')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Activitățile mele' })).toBeInTheDocument()
})

test('empty state links to the first activity', async () => {
  mockedList.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText('Nicio activitate încă.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Creează prima activitate' })).toHaveAttribute(
    'href',
    '/coach/activities/new',
  )
})

test('opens on upcoming, shows free price and past badge under Încheiate', async () => {
  mockedList.mockResolvedValue([
    act({ id: 'a', name: 'Atelier gratuit', price: 0 }),
    act({ id: 'b', name: 'Tura veche', activity_date: '2000-01-02' }),
  ])
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('Atelier gratuit')).toBeInTheDocument()
  expect(screen.getByText('Gratuit')).toBeInTheDocument()
  expect(screen.queryByText('Tura veche')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Viitoare/ })).toHaveAttribute('aria-pressed', 'true')

  await user.click(screen.getByRole('button', { name: /Încheiate/ }))
  expect(screen.getByText('Tura veche')).toBeInTheDocument()
  expect(screen.getByText('Încheiată')).toBeInTheDocument()
})

test('no-results state clears search, status and sport', async () => {
  mockedList.mockResolvedValue([
    act({ id: 'a', name: 'Atelier' }),
    act({ id: 'b', name: 'Tura veche', activity_date: '2000-01-02' }),
  ])
  const user = userEvent.setup()
  renderPage()
  await user.type(await screen.findByRole('searchbox'), 'zzz')
  expect(screen.getByText('Nicio activitate pentru filtrele alese.')).toBeInTheDocument()
  expect(screen.queryByText('Nicio activitate încă.')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Șterge filtrele' }))
  expect(screen.getByText('Atelier')).toBeInTheDocument()
  expect(screen.getByText('Tura veche')).toBeInTheDocument()
})

test('deactivating with enrollments asks first; without them applies directly', async () => {
  mockedToggle.mockResolvedValue(undefined)
  mockedList.mockResolvedValue([
    act({ id: 'a', name: 'Cu înscriși', enrolled: 3 }),
    act({ id: 'b', name: 'Fără înscriși' }),
  ])
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Dezactivează Fără înscriși' }))
  await waitFor(() => expect(mockedToggle).toHaveBeenCalledWith('b', false))
  expect(toast.success).toHaveBeenCalledWith('Fără înscriși a fost dezactivată.')

  await user.click(screen.getByRole('button', { name: 'Dezactivează Cu înscriși' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(/3 înscrieri active/)).toBeInTheDocument()
  expect(mockedToggle).toHaveBeenCalledTimes(1)
  await user.click(within(dialog).getByRole('button', { name: 'Dezactivează' }))
  await waitFor(() => expect(mockedToggle).toHaveBeenCalledWith('a', false))
})
