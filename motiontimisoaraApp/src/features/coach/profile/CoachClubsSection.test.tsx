import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachClubsSection from './CoachClubsSection'
import { getMyCoachClubs, joinClubByInvitation } from '@/api/coach-registration/club-membership'

vi.mock('@/api/coach-registration/club-membership', () => ({
  getMyCoachClubs: vi.fn(),
  joinClubByInvitation: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CoachClubsSection />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getMyCoachClubs).mockReset()
  vi.mocked(joinClubByInvitation).mockReset()
})

test('a coach without clubs sees the empty state and can join with a club code', async () => {
  vi.mocked(getMyCoachClubs)
    .mockResolvedValueOnce([])
    .mockResolvedValue([{ id: 'club-1', name: 'UI Audit Club TM' }])
  vi.mocked(joinClubByInvitation).mockResolvedValue({
    clubId: 'club-1',
    clubName: 'UI Audit Club TM',
    alreadyMember: false,
  })
  const user = userEvent.setup()
  renderSection()
  expect(await screen.findByText(/Nu faci parte din niciun club încă/)).toBeInTheDocument()
  await user.type(screen.getByLabelText('Cod de club'), 'ABCD-2345')
  await user.click(screen.getByRole('button', { name: 'Alătură-te clubului' }))
  expect(joinClubByInvitation).toHaveBeenCalledWith('ABCD-2345')
  expect(await screen.findByText('UI Audit Club TM')).toBeInTheDocument()
  expect(screen.getByLabelText('Cod de club')).toHaveValue('')
})

test('a rejected code stays in the field with the server reason', async () => {
  vi.mocked(getMyCoachClubs).mockResolvedValue([])
  vi.mocked(joinClubByInvitation).mockResolvedValue({
    error: { message: 'Codul de invitație a expirat. Cere unul nou clubului.' },
  })
  const user = userEvent.setup()
  renderSection()
  await user.type(await screen.findByLabelText('Cod de club'), 'ABCD-2345')
  await user.click(screen.getByRole('button', { name: 'Alătură-te clubului' }))
  const field = screen.getByLabelText('Cod de club')
  expect(
    await screen.findByText('Codul de invitație a expirat. Cere unul nou clubului.'),
  ).toHaveAttribute('id', field.getAttribute('aria-describedby'))
  expect(field).toHaveAttribute('aria-invalid', 'true')
  expect(field).toHaveValue('ABCD-2345')
})

test('a too short code is refused without calling the server', async () => {
  vi.mocked(getMyCoachClubs).mockResolvedValue([])
  const user = userEvent.setup()
  renderSection()
  await user.type(await screen.findByLabelText('Cod de club'), 'AB')
  await user.click(screen.getByRole('button', { name: 'Alătură-te clubului' }))
  expect(
    await screen.findByText('Introdu codul primit de la club, de exemplu ABCD-2345.'),
  ).toBeInTheDocument()
  expect(joinClubByInvitation).not.toHaveBeenCalled()
})

test('a failed club list offers a retry instead of looking empty', async () => {
  vi.mocked(getMyCoachClubs).mockRejectedValueOnce(new Error('down')).mockResolvedValue([])
  const user = userEvent.setup()
  renderSection()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca cluburile.')
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText(/Nu faci parte din niciun club încă/)).toBeInTheDocument()
})
