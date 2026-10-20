import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import AdminAnnouncementFormPage from './AdminAnnouncementFormPage'
import { getAllClubs, getCoachesForSelect } from '@/api/admin'
import { getIndependentCoachCourses } from '@/api/announcements/admin-announcements'
import { getClubAudiences } from '@/api/club'

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
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('option', { name: 'Clubul Delfinul' })
  await user.selectOptions(screen.getByLabelText('Organizator'), 'c1')
  expect(await screen.findByLabelText('Titlu')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Înot mic' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Curs vechi' })).not.toBeInTheDocument()
  expect(getClubAudiences).toHaveBeenCalledWith('c1')
})

test('an independent coach shows the coach form or a message without courses', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('option', { name: 'Clubul Delfinul' })
  await user.selectOptions(screen.getByLabelText('Organizator'), 'independent')
  await screen.findByRole('option', { name: 'Ana Rusu' })
  await user.selectOptions(screen.getByLabelText('Antrenor'), 'u1')
  expect(await screen.findByLabelText('Cursul')).toHaveValue('k9')
  await user.selectOptions(screen.getByLabelText('Antrenor'), 'u2')
  expect(await screen.findByText('Antrenorul nu are cursuri active.')).toBeInTheDocument()
})
