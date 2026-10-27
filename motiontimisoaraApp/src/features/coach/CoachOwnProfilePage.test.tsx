import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachOwnProfilePage from './CoachOwnProfilePage'
import { getMyCoachProfile, updateMyCoachProfile } from '@/api/coach'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'coach-1', name: 'Audit Antrenor', role: 'COACH' },
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/api/coach-registration/club-membership', () => ({
  getMyCoachClubs: vi.fn().mockResolvedValue([]),
  joinClubByInvitation: vi.fn(),
}))

vi.mock('@/api/coach-profile/coach-photo', () => ({
  getMyCoachPhotoPath: vi.fn().mockResolvedValue(null),
  setMyCoachPhoto: vi.fn(),
  clearMyCoachPhoto: vi.fn(),
}))

vi.mock('@/api/coach', () => ({
  getMyCoachProfile: vi.fn(),
  updateMyCoachProfile: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoachOwnProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const profile = {
  name: 'Audit Antrenor',
  phone: null,
  email: 'uiaudit.coach@motiontimisoara.test',
  bio: '',
}

beforeEach(() => {
  vi.mocked(getMyCoachProfile).mockReset()
  vi.mocked(updateMyCoachProfile).mockReset()
})

test('coach profile page shows the profile heading and name field', async () => {
  vi.mocked(getMyCoachProfile).mockResolvedValue(profile)
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Profil antrenor' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText('Nume')).toHaveValue('Audit Antrenor'))
})

test('a failed profile load offers a retry instead of saying the profile is missing', async () => {
  vi.mocked(getMyCoachProfile).mockRejectedValueOnce(new Error('down')).mockResolvedValue(profile)
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca profilul.')
  expect(screen.queryByText(/Nu am găsit profilul/)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(screen.getByLabelText('Nume')).toHaveValue('Audit Antrenor'))
})

test('a too short name is explained under the field and nothing is saved', async () => {
  vi.mocked(getMyCoachProfile).mockResolvedValue(profile)
  const user = userEvent.setup()
  renderPage()
  const name = await screen.findByLabelText('Nume')
  await waitFor(() => expect(name).toHaveValue('Audit Antrenor'))
  await user.clear(name)
  await user.type(name, 'A')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  const message = await screen.findByText('Minim 2 caractere')
  expect(message).toHaveAttribute('id', name.getAttribute('aria-describedby'))
  expect(name).toHaveAttribute('aria-invalid', 'true')
  expect(updateMyCoachProfile).not.toHaveBeenCalled()
})
