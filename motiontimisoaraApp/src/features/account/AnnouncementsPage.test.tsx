import { vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import AnnouncementsPage from './AnnouncementsPage'
import { getMyAnnouncements } from '@/api/account'

vi.mock('@/api/account', () => ({ getMyAnnouncements: vi.fn() }))

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

// Regresia care a pornit totul: pagina citea DOAR `course_announcements`, deci un
// anunț scris de club nu ajungea niciodată la părinte.
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

// Anunțurile de club au titlu, cele de curs nu — cardul nu trebuie să lase un gol.
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

// Cheia trebuie să conțină sursa: cele două tabele au chei primare separate, deci
// două anunțuri din surse diferite pot avea același id fără să fie același anunț.
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
  expect(await screen.findByText(/Niciun anunț încă\./)).toBeInTheDocument()
})
