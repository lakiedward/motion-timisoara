import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import AdminUserEditPage from './AdminUserEditPage'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('@/api/accounts/admin-accounts', () => ({
  getAdminUserProfile: mocks.get,
  updateAdminUserProfile: mocks.update,
}))
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))

const coach = {
  id: 'u1',
  name: 'Ion Antrenor',
  email: 'ion@example.com',
  role: 'COACH',
  enabled: true,
  phone: '0722000000',
  phoneKnown: true,
  bio: 'Înot',
  hasCoachProfile: true,
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/users/u1/edit']}>
        <Routes>
          <Route path="/admin/users/:id/edit" element={<AdminUserEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue(coach)
  mocks.update.mockResolvedValue(undefined)
})

test('a coach shows name, phone, bio and a read-only login email', async () => {
  renderPage()
  expect(await screen.findByLabelText(/^Nume/)).toHaveValue('Ion Antrenor')
  expect(screen.getByLabelText('Telefon')).toHaveValue('0722000000')
  expect(screen.getByLabelText('Bio')).toHaveValue('Înot')
  expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
  expect(screen.getByRole('heading', { name: 'Editează Ion Antrenor' })).toBeVisible()
  expect(mocks.get).toHaveBeenCalledWith('u1')
})

test('saving sends the edited values for that user and confirms by name', async () => {
  renderPage()
  const name = await screen.findByLabelText(/^Nume/)
  fireEvent.change(name, { target: { value: 'Ion Nou' } })
  fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '0733 111 222' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mocks.update).toHaveBeenCalled())
  expect(mocks.update.mock.calls[0][0]).toMatchObject({ id: 'u1', role: 'COACH' })
  expect(mocks.update.mock.calls[0][1]).toEqual({
    name: 'Ion Nou',
    phone: '0733111222',
    bio: 'Înot',
  })
  await waitFor(() =>
    expect(mocks.success).toHaveBeenCalledWith('Datele lui Ion Nou au fost salvate.'),
  )
})

test('a parent has no bio, and without a readable phone the phone field is hidden', async () => {
  mocks.get.mockResolvedValue({ ...coach, role: 'PARENT', phone: null, phoneKnown: false })
  renderPage()
  await screen.findByLabelText(/^Nume/)
  expect(screen.queryByLabelText('Bio')).toBeNull()
  expect(screen.queryByLabelText('Telefon')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mocks.update).toHaveBeenCalled())
  expect(mocks.update.mock.calls[0][1]).toEqual({ name: 'Ion Antrenor' })
})

test('an invalid phone is shown under the field and nothing is saved', async () => {
  renderPage()
  await screen.findByLabelText(/^Nume/)
  fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: 'abc' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Număr de telefon invalid')).toBeVisible()
  expect(mocks.update).not.toHaveBeenCalled()
})

test('a failed save keeps the form and shows an error', async () => {
  mocks.update.mockRejectedValue(new Error('denied'))
  renderPage()
  await screen.findByLabelText(/^Nume/)
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Nu am putut salva utilizatorul.'))
  expect(screen.getByLabelText(/^Nume/)).toHaveValue('Ion Antrenor')
})

test('a failed load offers retry and a way back to the list', async () => {
  mocks.get.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(coach)
  renderPage()
  expect(await screen.findByText('Nu am putut încărca utilizatorul.')).toBeVisible()
  expect(screen.getByRole('link', { name: /Înapoi la utilizatori/ })).toHaveAttribute(
    'href',
    '/admin/users',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByLabelText(/^Nume/)).toHaveValue('Ion Antrenor')
})

test('an unknown user says so instead of showing an empty form', async () => {
  mocks.get.mockResolvedValue(null)
  renderPage()
  expect(await screen.findByText('Utilizatorul nu există.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Salvează' })).toBeNull()
})
