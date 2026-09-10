import { vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import AnnouncementsPage from './AnnouncementsPage'
import { getMyAnnouncements } from '@/api/account'

vi.mock('@/api/account', () => ({ getMyAnnouncements: vi.fn() }))
vi.mock('@/features/live-location/camps/ActiveLocationAnnouncements', () => ({
  ActiveLocationAnnouncements: () => null,
}))

const mocked = vi.mocked(getMyAnnouncements)

const deLaAntrenor = {
  id: 'c1',
  content: 'Vineri nu avem ședință.',
  title: null,
  created_at: '2026-08-25T09:00:00Z',
  pinned: false,
  sursa: 'coach' as const,
  autor: 'Înot începători',
  courseId: 'curs-1',
}

const deLaClub = {
  id: 'k1',
  content: 'Ședința cu părinții.\n\nVineri, ora 18.',
  title: 'Ședință cu părinții',
  created_at: '2026-08-26T09:00:00Z',
  pinned: false,
  sursa: 'club' as const,
  autor: 'Club Audit Motion',
  courseId: null,
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AnnouncementsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.mockResolvedValue([deLaClub, deLaAntrenor] as never)
})

test('părintele vede și anunțurile clubului, nu doar pe cele ale antrenorului', async () => {
  renderPage()
  expect(await screen.findByText('Ședința cu părinții.', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('Vineri nu avem ședință.')).toBeInTheDocument()
})

test('fiecare anunț spune de la cine vine', async () => {
  renderPage()
  await screen.findByText('Club Audit Motion')
  const carduri = screen.getAllByRole('listitem')

  expect(within(carduri[0]).getByText('Club Audit Motion')).toBeInTheDocument()
  expect(within(carduri[0]).getByText('Anunț de club')).toBeInTheDocument()
  expect(within(carduri[1]).getByText('Înot începători')).toBeInTheDocument()
  expect(within(carduri[1]).getByText('Anunț de la antrenor')).toBeInTheDocument()
})

test('titlul apare doar când există', async () => {
  renderPage()
  await screen.findByText('Club Audit Motion')
  expect(screen.getByRole('heading', { level: 2, name: 'Ședință cu părinții' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
})

test('conținutul își păstrează rândurile', async () => {
  renderPage()
  const text = await screen.findByText(/Ședința cu părinții\./)
  expect(text.className).toContain('whitespace-pre-wrap')
})

test('cele două surse nu se ciocnesc pe cheie', async () => {
  mocked.mockResolvedValue([
    { ...deLaClub, id: 'acelasi' },
    { ...deLaAntrenor, id: 'acelasi' },
  ] as never)
  renderPage()
  await screen.findByText('Club Audit Motion')
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})

test('un părinte fără anunțuri vede mesajul de listă goală', async () => {
  mocked.mockResolvedValue([] as never)
  renderPage()
  expect(await screen.findByText(/Niciun mesaj încă\./)).toBeInTheDocument()
})

test('mesajul de listă goală pomenește ambele surse', async () => {
  mocked.mockResolvedValue([] as never)
  renderPage()
  const mesaj = await screen.findByText(/Niciun mesaj încă\./)
  expect(mesaj.textContent).toMatch(/cursurile/)
  expect(mesaj.textContent).toMatch(/cluburile/)
})

test('o încărcare căzută arată eroare cu reîncercare, nu mesajul de listă goală', async () => {
  mocked.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca anunțurile.')).toBeInTheDocument()
  expect(screen.queryByText(/Niciun mesaj încă\./)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})
