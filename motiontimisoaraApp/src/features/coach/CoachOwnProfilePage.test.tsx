import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachOwnProfilePage from './CoachOwnProfilePage'
import { getMyCoachProfile } from '@/api/coach'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'coach-1', name: 'Audit Antrenor', role: 'COACH' },
    loading: false,
    profileError: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/api/coach', () => ({
  getMyCoachProfile: vi.fn(),
  updateMyCoachProfile: vi.fn(),
}))

test('coach profile page shows the profile heading and name field', async () => {
  vi.mocked(getMyCoachProfile).mockResolvedValue({
    name: 'Audit Antrenor',
    phone: null,
    email: 'uiaudit.coach@motiontimisoara.test',
    bio: '',
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CoachOwnProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(await screen.findByRole('heading', { name: 'Profil antrenor' })).toBeInTheDocument()
  expect(screen.getByLabelText('Nume')).toHaveValue('Audit Antrenor')
})
