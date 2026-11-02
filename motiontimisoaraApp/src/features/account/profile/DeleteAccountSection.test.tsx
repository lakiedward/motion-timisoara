import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import { DeleteAccountSection } from './DeleteAccountSection'

const api = vi.hoisted(() => ({ getMyEnrollments: vi.fn() }))
const deletion = vi.hoisted(() => {
  class AccountDeletionError extends Error {}
  return {
    AccountDeletionError,
    ACCOUNT_DELETION_ERROR: 'eroare generală',
    deleteMyAccount: vi.fn(),
    signOutDeletedAccount: vi.fn(),
  }
})
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('@/api/account', () => api)
vi.mock('@/api/account-deletion', () => deletion)
vi.mock('sonner', () => ({ toast: toasts }))

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/profile']}>
        <Routes>
          <Route path="/account/profile" element={<DeleteAccountSection userId="parent-1" />} />
          <Route path="/" element={<p>pagina principală</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.getMyEnrollments.mockReset()
  api.getMyEnrollments.mockResolvedValue([
    { id: 'e1', status: 'ACTIVE' },
    { id: 'e2', status: 'ACTIVE' },
    { id: 'e3', status: 'CANCELLED' },
  ])
  deletion.deleteMyAccount.mockReset()
  deletion.signOutDeletedAccount.mockReset()
  toasts.success.mockReset()
  toasts.error.mockReset()
})

test('cardul nu citește înscrierile până nu se deschide dialogul', () => {
  renderSection()
  expect(screen.getByText('Ștergerea contului')).toBeInTheDocument()
  expect(api.getMyEnrollments).not.toHaveBeenCalled()
})

test('dialogul arată ce se șterge, ce rămâne și avertizează despre înscrierile active', async () => {
  const user = userEvent.setup()
  renderSection()
  await user.click(screen.getByRole('button', { name: 'Șterge contul' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('Se șterg definitiv')
  expect(dialog).toHaveTextContent('Rămân în evidențe')
  expect(await screen.findByRole('alert')).toHaveTextContent('Ai 2 înscrieri active. Se anulează')
  const confirm = screen.getAllByRole('button', { name: 'Șterge contul' }).at(-1)!
  expect(confirm).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Anulează' })).toHaveFocus()
})

test('după bifă șterge contul, anunță și duce pe pagina principală', async () => {
  deletion.deleteMyAccount.mockResolvedValue('anonymized')
  const user = userEvent.setup()
  renderSection()
  await user.click(screen.getByRole('button', { name: 'Șterge contul' }))
  await screen.findByRole('alert')
  await user.click(
    screen.getByRole('checkbox', { name: 'Am înțeles că ștergerea este definitivă.' }),
  )
  await user.click(screen.getAllByRole('button', { name: 'Șterge contul' }).at(-1)!)
  await waitFor(() => expect(deletion.deleteMyAccount).toHaveBeenCalledWith('parent-1'))
  expect(await screen.findByText('pagina principală')).toBeInTheDocument()
  expect(toasts.success).toHaveBeenCalledWith('Contul tău a fost șters.')
  expect(deletion.signOutDeletedAccount).toHaveBeenCalled()
})

test('o eroare lasă dialogul deschis și arată mesajul', async () => {
  deletion.deleteMyAccount.mockRejectedValue(new deletion.AccountDeletionError('doar părinte'))
  api.getMyEnrollments.mockResolvedValue([])
  const user = userEvent.setup()
  renderSection()
  await user.click(screen.getByRole('button', { name: 'Șterge contul' }))
  await user.click(await screen.findByRole('checkbox'))
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Șterge contul' }).at(-1)).toBeEnabled(),
  )
  await user.click(screen.getAllByRole('button', { name: 'Șterge contul' }).at(-1)!)
  await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('doar părinte'))
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(deletion.signOutDeletedAccount).not.toHaveBeenCalled()
})
