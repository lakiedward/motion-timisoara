import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import { deleteChild, getMyChildren, getMyEnrollments, type Child, type EnrollmentRow } from '@/api/account'
import ChildrenPage from './ChildrenPage'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'parent-547' } }),
}))

vi.mock('@/api/account', () => ({
  childAge: () => 10,
  deleteChild: vi.fn(),
  getMyChildren: vi.fn(),
  getMyEnrollments: vi.fn(),
}))

const ana = { id: 'c1', name: 'Ana Spec', birth_date: '2016-01-01', level: null, allergies: null, emergency_phone: null } as Child

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ChildrenPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMyEnrollments).mockResolvedValue([])
})

test('a failed load shows the error with retry, not the empty state', async () => {
  vi.mocked(getMyChildren).mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce([ana])
  renderPage()
  expect(await screen.findByText('Nu am putut încărca copiii.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun copil adăugat încă.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('Ana Spec')).toBeInTheDocument()
})

test('the empty state explains why and links to the new child form', async () => {
  vi.mocked(getMyChildren).mockResolvedValue([])
  renderPage()
  expect(await screen.findByText('Adaugă copilul ca să-l poți înscrie la cursuri.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Adaugă primul copil' })).toHaveAttribute('href', '/account/child/new')
  expect(screen.getByRole('link', { name: 'Adaugă copil' })).toBeInTheDocument()
})

test('deleting asks in an app dialog that warns about active enrollments', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm')
  vi.mocked(getMyChildren).mockResolvedValue([ana])
  vi.mocked(getMyEnrollments).mockResolvedValue([
    { child_id: 'c1', status: 'ACTIVE', offerTitle: 'Înot' } as EnrollmentRow,
  ])
  vi.mocked(deleteChild).mockResolvedValue(undefined)
  renderPage()
  expect(await screen.findByText('Înscris la: Înot')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Șterge' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(/are înscrieri active: Înot/)).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Anulează' })).toHaveFocus()
  expect(deleteChild).not.toHaveBeenCalled()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Șterge' }))
  expect(vi.mocked(deleteChild).mock.calls[0][0]).toBe('c1')
  expect(confirmSpy).not.toHaveBeenCalled()
})
