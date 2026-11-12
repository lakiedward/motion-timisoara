import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { getCurrentLocationOccurrences } from '@/api/live-location'
import { getActiveLocationSessions } from '@/api/live-location/discovery'
import { CurrentLocationSessions } from './CurrentLocationSessions'
import type { CourseInfo } from './current-sessions'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'club-1', role: 'CLUB' } }),
}))
vi.mock('@/api/live-location', () => ({ getCurrentLocationOccurrences: vi.fn() }))
vi.mock('@/api/live-location/discovery', () => ({ getActiveLocationSessions: vi.fn() }))
vi.mock('./LocationViewer', () => ({
  LocationViewer: ({ occurrenceId }: { occurrenceId: string }) => <p>Vizualizare {occurrenceId}</p>,
}))

const ready = { isLoading: false, isError: false, retry: vi.fn() }
const curs = (id: string, name: string, coachName = 'Andrei Popescu'): CourseInfo => ({
  id,
  name,
  coachName,
})
const occurrence = (id: string, courseId: string, startMin = 0) => ({
  id,
  course_id: courseId,
  starts_at: new Date(Date.now() - startMin * 60_000).toISOString(),
  ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
})
const session = (occurrenceId: string, coachName = 'Andrei Popescu') => ({
  sessionId: '00000000-0000-4000-8000-000000000001',
  campId: null,
  occurrenceId,
  coachId: '00000000-0000-4000-8000-000000000002',
  coachName,
  title: 'x',
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
})

function mount(courses = [curs('course-1', 'Înot începători')], courseSource = ready) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = (list: CourseInfo[]) => (
    <QueryClientProvider client={client}>
      <CurrentLocationSessions courses={list} courseSource={courseSource} />
    </QueryClientProvider>
  )
  const result = render(view(courses))
  return { client, rerender: (list: CourseInfo[]) => result.rerender(view(list)) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentLocationOccurrences).mockResolvedValue([occurrence('occurrence-1', 'course-1')])
  vi.mocked(getActiveLocationSessions).mockResolvedValue([session('occurrence-1')])
})

test('selection survives disappearance from occurrence candidates so revocation stays reachable', async () => {
  const { client } = mount()
  await userEvent.click(await screen.findByRole('button', { name: /Înot începători/ }))
  await screen.findByText('Vizualizare occurrence-1')
  vi.mocked(getCurrentLocationOccurrences).mockResolvedValue([])
  await client.refetchQueries({ queryKey: ['live-location-occurrences'] })
  await screen.findByText('Nicio ședință în desfășurare.')
  expect(screen.getByText('Vizualizare occurrence-1')).toBeInTheDocument()
})

test('discovery asks once per distinct club course', async () => {
  mount([curs('course-2', 'Atletism'), curs('course-1', 'Înot'), curs('course-1', 'Înot')])
  await screen.findByRole('button', { name: /Înot/ })
  expect(getCurrentLocationOccurrences).toHaveBeenCalledWith(['course-1', 'course-2'])
})

test('a club without courses does not see the panel nor issue a request', () => {
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <CurrentLocationSessions courses={[]} courseSource={ready} />
    </QueryClientProvider>,
  )
  expect(container).toBeEmptyDOMElement()
  expect(getCurrentLocationOccurrences).not.toHaveBeenCalled()
})

test('failure is distinct from a genuinely empty current schedule', async () => {
  vi.mocked(getCurrentLocationOccurrences).mockRejectedValue(new Error('offline'))
  mount()
  await screen.findByText('Nu am putut încărca ședințele pentru locație.')
  expect(screen.queryByText('Nicio ședință în desfășurare.')).not.toBeInTheDocument()
})

test('Reîncearcă reloads the failed session sources', async () => {
  vi.mocked(getActiveLocationSessions).mockRejectedValueOnce(new Error('offline'))
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Reîncearcă' }))
  await screen.findAllByText('Partajează acum')
  expect(getActiveLocationSessions).toHaveBeenCalledTimes(2)
})

test('a course list failure retries the course source', async () => {
  const retry = vi.fn()
  mount([curs('course-1', 'Înot')], { isLoading: false, isError: true, retry })
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(retry).toHaveBeenCalled()
  expect(getCurrentLocationOccurrences).not.toHaveBeenCalled()
})

test('rows show course, coach, time range and sharing state, sharing first', async () => {
  vi.mocked(getCurrentLocationOccurrences).mockResolvedValue([
    occurrence('occurrence-2', 'course-2', 5),
    occurrence('occurrence-1', 'course-1', 30),
  ])
  mount([curs('course-1', 'Înot începători'), curs('course-2', 'Atletism juniori', 'Maria Ionescu')])
  await screen.findAllByText('Partajează acum')
  const rows = screen.getAllByRole('button', { expanded: false })
  expect(rows[0]).toHaveTextContent('Înot începători')
  expect(rows[0]).toHaveTextContent('Andrei Popescu')
  expect(rows[0]).toHaveTextContent(/\d{2}:\d{2}–\d{2}:\d{2}/)
  expect(rows[1]).toHaveTextContent('Atletism juniori')
  expect(rows[1]).toHaveTextContent('Maria Ionescu')
  expect(rows[1]).toHaveTextContent('Nu partajează')
})

test('opening a session without sharing shows a neutral note, not the viewer', async () => {
  vi.mocked(getActiveLocationSessions).mockResolvedValue([])
  mount()
  await userEvent.click(await screen.findByRole('button', { name: /Înot începători/ }))
  const note = await screen.findByText(/nu partajează locația la această ședință/)
  expect(note.closest('[role="alert"]')).toBeNull()
  expect(screen.queryByText('Vizualizare occurrence-1')).not.toBeInTheDocument()
})

test('more than three sessions collapse behind „Arată toate (N)”', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e']
  vi.mocked(getCurrentLocationOccurrences).mockResolvedValue(
    ids.map((id, i) => occurrence(`occ-${id}`, `course-${id}`, i)),
  )
  vi.mocked(getActiveLocationSessions).mockResolvedValue([session('occ-e')])
  mount(ids.map((id) => curs(`course-${id}`, `Curs ${id}`)))
  const list = (await screen.findByText('Curs e')).closest('ul')!
  expect(within(list).getAllByRole('listitem')).toHaveLength(3)
  expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Curs e')
  await userEvent.click(screen.getByRole('button', { name: 'Arată toate (5)' }))
  await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(5))
})

test('rows open and close from the keyboard', async () => {
  mount()
  const row = await screen.findByRole('button', { name: /Înot începători/ })
  row.focus()
  await userEvent.keyboard('{Enter}')
  expect(row).toHaveAttribute('aria-expanded', 'true')
  await screen.findByText('Vizualizare occurrence-1')
  await userEvent.keyboard(' ')
  expect(row).toHaveAttribute('aria-expanded', 'false')
})

test('no live session shows the empty explanation without the choose prompt', async () => {
  vi.mocked(getCurrentLocationOccurrences).mockResolvedValue([])
  mount()
  await screen.findByText('Nicio ședință în desfășurare.')
  expect(screen.queryByText(/Alege ședința/)).not.toBeInTheDocument()
})
