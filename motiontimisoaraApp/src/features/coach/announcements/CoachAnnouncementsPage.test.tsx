import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CoachAnnouncementsPage from './CoachAnnouncementsPage'
import { getMyCourses, type CoachCourse } from '@/api/coach'
import { getCoachAnnouncements, type CoachAnnouncement } from '@/api/coach-announcements'

vi.mock('@/api/coach', () => ({ getMyCourses: vi.fn() }))
vi.mock('@/api/coach-announcements', () => ({
  getCoachAnnouncements: vi.fn(),
  createCourseAnnouncement: vi.fn(),
  setCourseAnnouncementPinned: vi.fn(),
  deleteCourseAnnouncement: vi.fn(),
}))
vi.mock('@/api/attachments', () => ({
  getAtasamente: vi.fn().mockResolvedValue({}),
  incarcaAtasamente: vi.fn(),
  stergeFisiereleAnuntului: vi.fn(),
}))

const courses = [
  { id: 'c1', name: 'Înot începători', active: true },
  { id: 'c2', name: 'Atletism', active: true },
] as CoachCourse[]

const row = (over: Partial<CoachAnnouncement>): CoachAnnouncement => ({
  id: crypto.randomUUID(),
  source: 'coach',
  courseId: 'c1',
  title: null,
  content: 'Joi ne vedem la bazinul mic',
  pinned: false,
  priority: null,
  clubName: null,
  createdAt: '2026-10-10T10:00:00Z',
  ...over,
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CoachAnnouncementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('the form opens from Anunț nou and lists only active courses', async () => {
  vi.mocked(getMyCourses).mockResolvedValue([
    ...courses,
    { id: 'c3', name: 'Curs oprit', active: false } as CoachCourse,
  ])
  vi.mocked(getCoachAnnouncements).mockResolvedValue([])
  renderPage()
  expect(await screen.findByText('Niciun anunț încă.')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Anunț nou' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Anunț nou/ }))
  const select = screen.getByLabelText('Cursul')
  expect(
    within(select)
      .getAllByRole('option')
      .map((o) => o.textContent),
  ).toEqual(['Alege cursul', 'Înot începători', 'Atletism'])
  await userEvent.click(screen.getByRole('button', { name: 'Publică' }))
  expect(await screen.findByText('Alege cursul', { selector: 'p, span' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Renunță' }))
  expect(screen.queryByLabelText('Cursul')).not.toBeInTheDocument()
})

test('club announcements are marked and read-only; own ones can be pinned and deleted', async () => {
  vi.mocked(getMyCourses).mockResolvedValue(courses)
  vi.mocked(getCoachAnnouncements).mockResolvedValue([
    row({}),
    row({ source: 'club', courseId: 'c2', title: 'Taxa pe noiembrie', clubName: 'CS Motion' }),
  ])
  renderPage()
  const club = (await screen.findByRole('heading', { name: 'Taxa pe noiembrie' })).closest(
    'article',
  )!
  expect(within(club).getByText('De la club')).toBeInTheDocument()
  expect(within(club).queryByRole('button', { name: /Șterge/ })).not.toBeInTheDocument()
  const own = screen.getByRole('heading', { name: 'Înot începători' }).closest('article')!
  expect(within(own).getByRole('button', { name: /Fixează sus/ })).toBeInTheDocument()
  expect(within(own).getByRole('button', { name: /Șterge/ })).toBeInTheDocument()
})

test('source pills filter and Arată încă pages by 15', async () => {
  vi.mocked(getMyCourses).mockResolvedValue(courses)
  vi.mocked(getCoachAnnouncements).mockResolvedValue([
    ...Array.from({ length: 20 }, () => row({})),
    row({ source: 'club', title: 'Echipament', clubName: 'CS Motion' }),
  ])
  renderPage()
  expect(await screen.findByText('Vezi 15 din 21')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Arată încă 6' }))
  expect(screen.queryByText(/Vezi \d+ din/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /De la club/ }))
  expect(screen.getByText('1 din 21')).toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(1)
})
