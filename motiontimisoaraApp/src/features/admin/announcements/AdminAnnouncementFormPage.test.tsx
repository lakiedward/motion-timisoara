import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import AdminAnnouncementFormPage from './AdminAnnouncementFormPage'
import { getAllClubs, getCoachesForSelect } from '@/api/admin'
import { getIndependentCoachCourses } from '@/api/announcements/admin-announcements'
import { getClubAudiences } from '@/api/club'
import { pickSelectMenuValue, selectMenuOptionLabels } from '@/test/select-menu'

vi.mock('@/api/admin', () => ({ getAllClubs: vi.fn(), getCoachesForSelect: vi.fn() }))
vi.mock('@/api/announcements/admin-announcements', () => ({
  getIndependentCoachCourses: vi.fn(),
}))
vi.mock('@/api/club', () => ({ getClubAudiences: vi.fn(), createClubAnnouncement: vi.fn() }))
vi.mock('@/api/coach-announcements', () => ({ createCourseAnnouncement: vi.fn() }))
vi.mock('@/api/attachments', () => ({ incarcaAtasamente: vi.fn() }))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminAnnouncementFormPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAllClubs).mockResolvedValue([{ id: 'c1', name: 'Clubul Delfinul' }] as never)
  vi.mocked(getCoachesForSelect).mockResolvedValue([
    { user_id: 'u1', name: 'Ana Rusu' },
    { user_id: 'u2', name: 'Dan Pop' },
  ])
  vi.mocked(getClubAudiences).mockResolvedValue([
    { kind: 'COURSE', id: 'k1', name: 'Înot mic', active: true },
    { kind: 'COURSE', id: 'k2', name: 'Curs vechi', active: false },
  ])
  vi.mocked(getIndependentCoachCourses).mockImplementation(async (id) =>
    id === 'u1' ? [{ id: 'k9', name: 'Tenis copii' }] : [],
  )
})

test('a club organizer shows the club form with only active audiences', async () => {
  renderPage()
  await pickSelectMenuValue(screen.getByLabelText('Organizator'), 'c1')
  expect(await screen.findByLabelText('Titlu')).toBeInTheDocument()
  const audiences = await selectMenuOptionLabels(screen.getByLabelText('Cine primește'))
  expect(audiences).toContain('Înot mic')
  expect(audiences).not.toContain('Curs vechi')
  expect(getClubAudiences).toHaveBeenCalledWith('c1')
})

test('an independent coach shows the coach form or a message without courses', async () => {
  const user = userEvent.setup()
  renderPage()
  await pickSelectMenuValue(screen.getByLabelText('Organizator'), 'independent')
  const coach = screen.getByLabelText('Antrenor')
  await waitFor(() => expect(coach).toBeEnabled())
  await user.click(coach)
  await user.click(await screen.findByRole('menuitemradio', { name: 'Ana Rusu' }))
  expect(coach).toHaveTextContent('Ana Rusu')
  expect(await screen.findByLabelText('Cursul')).toHaveAttribute('data-value', 'k9')
  await user.click(coach)
  await user.click(await screen.findByRole('menuitemradio', { name: 'Dan Pop' }))
  expect(await screen.findByText('Antrenorul nu are cursuri active.')).toBeInTheDocument()
})
