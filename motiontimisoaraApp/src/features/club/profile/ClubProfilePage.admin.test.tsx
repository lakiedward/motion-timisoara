import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import ClubProfilePage from './ClubProfilePage'

const mocks = vi.hoisted(() => ({
  getAdminClub: vi.fn(),
  getMyClub: vi.fn(),
  updateClub: vi.fn(),
  setImage: vi.fn(),
  clearImage: vi.fn(),
}))
vi.mock('@/api/accounts/admin-accounts', () => ({ getAdminClub: mocks.getAdminClub }))
vi.mock('@/api/club', async (original) => ({
  ...(await original<typeof import('@/api/club')>()),
  getMyClub: mocks.getMyClub,
  updateClub: mocks.updateClub,
}))
vi.mock('@/api/club-images', () => ({
  setClubImage: mocks.setImage,
  clearClubImage: mocks.clearImage,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const club = {
  id: 'club-9',
  name: 'Clubul Altcuiva',
  description: null,
  website: null,
  email: 'club@example.com',
  phone: null,
  county: null,
  city: 'Arad',
  address: null,
  lat: null,
  lng: null,
  public_email_consent: false,
  logo_storage_path: null,
  hero_photo_storage_path: null,
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/clubs/club-9/edit']}>
        <Routes>
          <Route path="/admin/clubs/:id/edit" element={<ClubProfilePage portal="admin" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getAdminClub.mockResolvedValue(club)
  mocks.updateClub.mockResolvedValue(undefined)
})

test('the admin edits the club from the URL, not their own club', async () => {
  renderPage()
  expect(await screen.findByLabelText(/^Nume club/)).toHaveValue('Clubul Altcuiva')
  expect(mocks.getAdminClub).toHaveBeenCalledWith('club-9')
  expect(mocks.getMyClub).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Editează Clubul Altcuiva' })).toBeVisible()
  expect(screen.getByRole('link', { name: /Înapoi la cluburi/ })).toHaveAttribute(
    'href',
    '/admin/clubs',
  )
})

test('saving writes that club and no billing fields', async () => {
  renderPage()
  const name = await screen.findByLabelText(/^Nume club/)
  fireEvent.change(name, { target: { value: 'Clubul Redenumit' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mocks.updateClub).toHaveBeenCalled())
  expect(mocks.updateClub.mock.calls[0][0]).toBe('club-9')
  expect(mocks.updateClub.mock.calls[0][1]).toMatchObject({
    name: 'Clubul Redenumit',
    city: 'Arad',
  })
  expect(mocks.updateClub.mock.calls[0][1]).not.toHaveProperty('bank_account')
})

test('a failed load keeps the way back to the list', async () => {
  mocks.getAdminClub.mockRejectedValue(new Error('boom'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca profilul clubului.')).toBeVisible()
  expect(screen.getByRole('link', { name: /Înapoi la cluburi/ })).toBeVisible()
})
