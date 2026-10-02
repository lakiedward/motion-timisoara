import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, vi } from 'vitest'

import AdminDashboard from './AdminDashboard'
import { getAdminStats, type AdminStatCell, type AdminStats } from '@/api/admin'
import { usesNativeNavigation } from '@/layout/native/native-runtime'

vi.mock('@/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/admin')>()
  return { ...actual, getAdminStats: vi.fn() }
})

vi.mock('@/layout/native/native-runtime', () => ({
  usesNativeNavigation: vi.fn(() => false),
}))

const mockedStats = vi.mocked(getAdminStats)
const mockedNative = vi.mocked(usesNativeNavigation)

beforeEach(() => {
  mockedNative.mockReturnValue(false)
})

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

function cell(value: number | null, error: string | null = null, capped = false): AdminStatCell {
  return { value, error, capped }
}

function stats(over: Partial<AdminStats> = {}): AdminStats {
  return {
    users: cell(0),
    coaches: cell(0),
    clubs: cell(0),
    courses: cell(0),
    camps: cell(0),
    competitions: cell(0),
    newUsers7d: cell(0),
    activeInviteCodes: cell(0),
    ...over,
  }
}

function failedStats(): AdminStats {
  return {
    users: cell(null, 'Nu am putut încărca numărul de utilizatori.'),
    coaches: cell(null, 'Nu am putut încărca numărul de antrenori.'),
    clubs: cell(null, 'Nu am putut încărca numărul de cluburi.'),
    courses: cell(null, 'Nu am putut încărca numărul de cursuri.'),
    camps: cell(null, 'Nu am putut încărca numărul de tabere.'),
    competitions: cell(null, 'Nu am putut încărca numărul de concursuri.'),
    newUsers7d: cell(null, 'Nu am putut încărca utilizatorii noi (7 zile).'),
    activeInviteCodes: cell(null, 'Nu am putut încărca codurile invitație.'),
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
  expect(screen.queryByRole('link', { name: 'Profil administrator' })).not.toBeInTheDocument()
})

test('cele 8 contoare duc la secțiunile lor, Antrenori filtrat pe COACH', async () => {
  mockedStats.mockResolvedValue(stats({ users: cell(4), coaches: cell(1), clubs: cell(2), courses: cell(3), camps: cell(5) }))
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
  expect(screen.getByRole('link', { name: /utilizatori noi \(7 zile\), 0/i })).toHaveAttribute(
    'href',
    '/admin/users',
  )
  expect(
    screen.getByRole('link', { name: /coduri invitație, 0, active și neexpirate/i }),
  ).toHaveAttribute('href', '/admin/codes')
  expect(screen.getByText('Coduri invitație')).toBeInTheDocument()
  expect(screen.getByText('Active și neexpirate')).toBeInTheDocument()
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
  expect(screen.getByRole('link', { name: /utilizatori noi \(7 zile\), 0/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /coduri invitație, 0/i })).toBeInTheDocument()
})

test('numerele mari au separator de mii', async () => {
  mockedStats.mockResolvedValue(stats({ users: cell(1234, null, true) }))
  renderDashboard()
  expect(await screen.findByRole('link', { name: /utilizatori, 1\.234\+/i })).toBeInTheDocument()
})

test('eroarea de încărcare are mesaj și Reîncearcă reia cererea', async () => {
  let resolveRetry: ((value: AdminStats) => void) | undefined
  mockedStats
    .mockRejectedValueOnce(new Error('500'))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRetry = resolve
        }),
    )
  renderDashboard()
  const alerta = await screen.findByRole('alert')
  expect(alerta).toHaveTextContent('Nu am putut încărca statisticile.')
  expect(screen.queryByTestId('admin-stat-utilizatori')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  const busy = await screen.findByRole('button', { name: 'Se reîncarcă…' })
  expect(busy).toBeDisabled()
  resolveRetry!(stats({ users: cell(2) }))
  expect(await screen.findByRole('link', { name: /utilizatori, 2/i })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await waitFor(() => {
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'Administrare' }),
    )
  })
})

test('toate cardurile eșuate păstrează mesajul C4, fără grilă', async () => {
  mockedStats.mockResolvedValue(failedStats())
  renderDashboard()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca statisticile.')
  expect(screen.queryByTestId('admin-stat-utilizatori')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('eșecul unui singur card lasă restul vizibile și spune ce lipsește', async () => {
  mockedStats.mockResolvedValue(
    stats({
      users: cell(4),
      activeInviteCodes: cell(null, 'Nu am putut încărca codurile invitație.'),
    }),
  )
  renderDashboard()
  expect(await screen.findByRole('link', { name: /utilizatori, 4/i })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Nu am putut încărca: Coduri invitație.')
  expect(screen.getByRole('link', { name: /coduri invitație, indisponibil/i })).toBeInTheDocument()
  expect(screen.getByText('Nu am putut încărca codurile invitație.')).toBeInTheDocument()
  expect(screen.getByTestId('admin-stat-utilizatori')).toBeInTheDocument()
})

test('grila e 1 / 2 / 4 coloane, cardurile au înălțime stabilă și inel de focus', async () => {
  mockedStats.mockResolvedValue(stats())
  const { container } = renderDashboard()
  await screen.findByTestId('admin-stat-utilizatori')
  const grila = container.querySelector('.grid')
  expect(grila?.className).toMatch(/grid-cols-1/)
  expect(grila?.className).toMatch(/md:grid-cols-2/)
  expect(grila?.className).toMatch(/lg:grid-cols-4/)
  expect(grila?.className).not.toMatch(/xl:grid-cols-4/)
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
    expect(card.className).toMatch(/focus-visible:ring-\[3px\]/)
    expect(card.className).toMatch(/focus-visible:ring-ring\/50/)
    expect(card.className).not.toMatch(/outline-primary/)
    expect(card.className).toMatch(/hover:-translate-y-1/)
  }
})

test('în încărcare cardurile au aria-busy și status', async () => {
  let resolveStats: ((value: AdminStats) => void) | undefined
  mockedStats.mockReturnValue(
    new Promise((resolve) => {
      resolveStats = resolve
    }),
  )
  renderDashboard()
  const card = await screen.findByTestId('admin-stat-utilizatori')
  expect(card).toHaveAttribute('aria-busy', 'true')
  expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  resolveStats!(stats({ users: cell(9) }))
  expect(await screen.findByRole('link', { name: /utilizatori, 9/i })).toBeInTheDocument()
  expect(screen.getByTestId('admin-stat-utilizatori')).not.toHaveAttribute('aria-busy')
})

test('în navigarea nativă există link de Profil administrator, fără chrome de layout', async () => {
  mockedNative.mockReturnValue(true)
  mockedStats.mockResolvedValue(stats())
  renderDashboard()
  expect(await screen.findByRole('link', { name: 'Profil administrator' })).toHaveAttribute(
    'href',
    '/admin/profile',
  )
})
