import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import AdminDashboard from './AdminDashboard'
import { getAdminStats, type AdminStats } from '@/api/admin'

vi.mock('@/api/admin', () => ({
  getAdminStats: vi.fn(),
}))

const mockedStats = vi.mocked(getAdminStats)

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function stats(over: Partial<AdminStats> = {}): AdminStats {
  return {
    users: 0,
    coaches: 0,
    clubs: 0,
    courses: 0,
    camps: 0,
    competitions: 0,
    newUsers7d: 0,
    activeInviteCodes: 0,
    ...over,
  }
}

test('titlul rămâne Administrare, cu un singur h1 și subtitlul de ansamblu', async () => {
  mockedStats.mockResolvedValue(stats())
  renderDashboard()
  expect(await screen.findByRole('heading', { level: 1, name: 'Administrare' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByText('Privire de ansamblu asupra platformei.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 }).className).toMatch(/break-words/)
  expect(screen.getByRole('heading', { level: 1 }).className).not.toMatch(/truncate/)
})

test('cele 8 contoare duc la secțiunile lor, Antrenori filtrat pe COACH', async () => {
  mockedStats.mockResolvedValue(stats({ users: 4, coaches: 1, clubs: 2, courses: 3, camps: 5 }))
  renderDashboard()
  expect(await screen.findByRole('link', { name: /utilizatori, 4/i })).toHaveAttribute(
    'href',
    '/admin/users',
  )
  expect(screen.getByRole('link', { name: /antrenori, 1/i })).toHaveAttribute(
    'href',
    '/admin/users?role=COACH',
  )
  expect(screen.getByRole('link', { name: /cluburi, 2/i })).toHaveAttribute('href', '/admin/clubs')
  expect(screen.getByRole('link', { name: /cursuri, 3/i })).toHaveAttribute(
    'href',
    '/admin/courses',
  )
  expect(screen.getByRole('link', { name: /tabere, 5/i })).toHaveAttribute('href', '/admin/camps')
  expect(screen.getByRole('link', { name: /concursuri, 0/i })).toHaveAttribute(
    'href',
    '/admin/competitions',
  )
  expect(
    screen.getByRole('link', { name: /utilizatori noi în ultimele 7 zile, 0/i }),
  ).toHaveAttribute('href', '/admin/users')
  expect(screen.getByRole('link', { name: /coduri de invitație active, 0/i })).toHaveAttribute(
    'href',
    '/admin/codes',
  )
  expect(screen.queryByText(/ultimii utilizatori/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/scurtături/i)).not.toBeInTheDocument()
})

test('Antrenori și Cursuri au iconițe diferite', async () => {
  mockedStats.mockResolvedValue(stats())
  renderDashboard()
  const antrenori = await screen.findByTestId('admin-stat-antrenori')
  const cursuri = screen.getByTestId('admin-stat-cursuri')
  expect(antrenori.querySelector('svg')?.innerHTML).not.toBe(
    cursuri.querySelector('svg')?.innerHTML,
  )
})

test('zero rămâne 0, nu dispare cardul', async () => {
  mockedStats.mockResolvedValue(stats())
  renderDashboard()
  expect(await screen.findByRole('link', { name: /tabere, 0/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /concursuri, 0/i })).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /utilizatori noi în ultimele 7 zile, 0/i }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /coduri de invitație active, 0/i })).toBeInTheDocument()
})

test('eroarea de încărcare are mesaj și Reîncearcă reia cererea', async () => {
  mockedStats.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce(stats({ users: 2 }))
  renderDashboard()
  const alerta = await screen.findByRole('alert')
  expect(alerta).toHaveTextContent('Nu am putut încărca statisticile.')
  expect(screen.queryByTestId('admin-stat-utilizatori')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('link', { name: /utilizatori, 2/i })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('grila e 1 / 2 / 4 coloane, cardurile au înălțime stabilă și focus', async () => {
  mockedStats.mockResolvedValue(stats())
  const { container } = renderDashboard()
  await screen.findByTestId('admin-stat-utilizatori')
  const grila = container.querySelector('.grid')
  expect(grila?.className).toMatch(/grid-cols-1/)
  expect(grila?.className).toMatch(/md:grid-cols-2/)
  expect(grila?.className).toMatch(/xl:grid-cols-4/)
  expect(grila?.className).not.toMatch(/overflow-x-auto/)
  for (const id of [
    'admin-stat-utilizatori',
    'admin-stat-antrenori',
    'admin-stat-cluburi',
    'admin-stat-cursuri',
    'admin-stat-tabere',
    'admin-stat-concursuri',
    'admin-stat-utilizatori-noi',
    'admin-stat-coduri',
  ]) {
    const card = screen.getByTestId(id)
    expect(card.className).toMatch(/min-h-\[11\.5rem\]/)
    expect(card.className).toMatch(/h-full/)
    expect(card.className).toMatch(/cursor-pointer/)
    expect(card.className).toMatch(/outline-primary/)
    expect(card.className).toMatch(/hover:-translate-y-1/)
  }
})
