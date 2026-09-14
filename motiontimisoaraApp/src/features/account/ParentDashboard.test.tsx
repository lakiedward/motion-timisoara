import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { getMyChildren, getMyEnrollments, type Child, type EnrollmentRow } from '@/api/account'
import ParentDashboard from './ParentDashboard'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'parent-520', name: '  Ana   Popescu ' } }),
}))

vi.mock('@/api/account', () => ({
  getMyChildren: vi.fn(),
  getMyEnrollments: vi.fn(),
  childAge: () => 8,
}))

const childrenRequest = vi.mocked(getMyChildren)
const enrollmentsRequest = vi.mocked(getMyEnrollments)
const child = { id: 'child-520', name: 'Copil Test', birth_date: '2018-01-01' } as Child
const enrollment = (status: EnrollmentRow['status']) => ({ status }) as EnrollmentRow

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ParentDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

beforeEach(() => {
  vi.resetAllMocks()
  childrenRequest.mockResolvedValue([])
  enrollmentsRequest.mockResolvedValue([])
})

test('pending data shows loading states without false zero or empty-child actions', async () => {
  const children = deferred<Child[]>()
  const enrollments = deferred<EnrollmentRow[]>()
  childrenRequest.mockReturnValue(children.promise)
  enrollmentsRequest.mockReturnValue(enrollments.promise)
  renderDashboard()

  expect(screen.getByRole('status', { name: 'Se încarcă: Copii' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Se încarcă: Înscrieri active' })).toBeInTheDocument()
  expect(screen.queryByText('0')).not.toBeInTheDocument()
  expect(screen.queryByText('Niciun copil adăugat încă.')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Adaugă/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Caută cursuri' })).toHaveAttribute('href', '/cursuri')

  await act(async () => {
    children.resolve([])
    enrollments.resolve([])
  })
  await waitFor(() => expect(screen.getAllByText('0')).toHaveLength(2))
})

test('successful empty responses show true zeros and one add-child action', async () => {
  renderDashboard()
  expect(await screen.findByRole('link', { name: 'Adaugă primul copil' })).toHaveAttribute(
    'href',
    '/account/child/new',
  )
  expect(screen.queryByRole('link', { name: 'Adaugă copil' })).not.toBeInTheDocument()
  expect(screen.getAllByText('0')).toHaveLength(2)
  expect(screen.getByRole('heading', { name: 'Salut, Ana!' })).toBeInTheDocument()
})

test('populated responses count only active enrollments and keep the child list available', async () => {
  childrenRequest.mockResolvedValue([child])
  enrollmentsRequest.mockResolvedValue([
    enrollment('ACTIVE'),
    enrollment('CANCELLED'),
    enrollment('ACTIVE'),
  ])
  renderDashboard()

  expect(await screen.findByRole('link', { name: 'Adaugă copil' })).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Copii' })).getByText('1')).toBeInTheDocument()
  expect(
    within(screen.getByRole('group', { name: 'Înscrieri active' })).getByText('2'),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Copil Test/ })).toHaveAttribute(
    'href',
    '/account/child/child-520',
  )
  expect(screen.queryByRole('link', { name: 'Adaugă primul copil' })).not.toBeInTheDocument()
})

test('a failed child request does not hide successful enrollments or claim there are no children', async () => {
  childrenRequest.mockRejectedValue(new Error('Network unavailable'))
  enrollmentsRequest.mockResolvedValue([enrollment('ACTIVE')])
  renderDashboard()

  expect(await screen.findByRole('button', { name: 'Reîncearcă: Copii' })).toBeEnabled()
  expect(
    within(screen.getByRole('group', { name: 'Copii' })).queryByText('0'),
  ).not.toBeInTheDocument()
  expect(
    within(screen.getByRole('group', { name: 'Înscrieri active' })).getByText('1'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Niciun copil adăugat încă.')).not.toBeInTheDocument()
})

test('retry refetches only the failed request and disables its action while pending', async () => {
  const recovered = deferred<Child[]>()
  childrenRequest
    .mockRejectedValueOnce(new Error('Network unavailable'))
    .mockReturnValueOnce(recovered.promise)
  renderDashboard()
  fireEvent.click(await screen.findByRole('button', { name: 'Reîncearcă: Copii' }))

  await waitFor(() => expect(childrenRequest).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('button', { name: 'Reîncearcă: Copii' })).not.toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Se încarcă: Copii' })).toBeInTheDocument()
  expect(enrollmentsRequest).toHaveBeenCalledTimes(1)
  await act(async () => {
    recovered.resolve([child])
  })
  expect(await screen.findByRole('link', { name: /Copil Test/ })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an enrollment failure preserves children and can recover to a true zero', async () => {
  childrenRequest.mockResolvedValue([child])
  enrollmentsRequest.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([])
  renderDashboard()
  fireEvent.click(await screen.findByRole('button', { name: 'Reîncearcă: Înscrieri active' }))

  await waitFor(() =>
    expect(
      within(screen.getByRole('group', { name: 'Înscrieri active' })).getByText('0'),
    ).toBeInTheDocument(),
  )
  expect(screen.getByRole('link', { name: /Copil Test/ })).toBeInTheDocument()
  expect(childrenRequest).toHaveBeenCalledTimes(1)
})

test('a failed refresh displays an error instead of a stale count, and retry stays single-flight', async () => {
  childrenRequest.mockResolvedValueOnce([child]).mockRejectedValueOnce(new Error('Refresh failed'))
  const client = renderDashboard()
  await screen.findByRole('link', { name: /Copil Test/ })
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['children'] })
  })
  const group = screen.getByRole('group', { name: 'Copii' })
  expect(await within(group).findByRole('alert')).toBeInTheDocument()
  expect(within(group).queryByText('1')).not.toBeInTheDocument()
  const recovered = deferred<Child[]>()
  childrenRequest.mockReturnValueOnce(recovered.promise)
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă: Copii' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Reîncearcă: Copii' })).toBeDisabled(),
  )
  await act(async () => {
    recovered.resolve([])
  })
  expect(await screen.findByRole('link', { name: 'Adaugă primul copil' })).toBeInTheDocument()
})
