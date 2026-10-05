import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import AdminClubsPage from './AdminClubsPage'
import { getAllClubs, type AdminClub } from '@/api/admin'

vi.mock('@/api/admin', () => ({
  getAllClubs: vi.fn(),
}))

const mockedClubs = vi.mocked(getAllClubs)

function renderPage(ruta = '/admin/clubs') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin/clubs" element={<AdminClubsPage />} />
          <Route path="/admin/codes" element={<div>pagina coduri invitație</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function club(over: Partial<AdminClub> & { id: string; name: string }): AdminClub {
  return {
    city: 'Timișoara',
    email: `${over.id}@club.test`,
    ...over,
  }
}

const listaNesortata = (): AdminClub[] => [
  club({ id: 'z', name: 'Zebra Club', city: 'Arad', email: 'zebra@club.test' }),
  club({ id: 'a', name: 'Alpha Club', city: null, email: 'alpha@club.test' }),
  club({ id: 'm', name: 'Club Mișcare', city: 'Timișoara', email: null }),
  club({ id: 'g', name: 'Gamma Club', city: '', email: '   ' }),
  club({ id: 'b', name: 'Beta Club', city: 'Cluj', email: 'beta@club.test' }),
  club({ id: 'd', name: 'Delta Club', city: 'Oradea', email: 'delta@club.test' }),
]

function asteaptaLista() {
  return screen.findByText('Alpha Club')
}

function carduri() {
  return within(screen.getByRole('list')).getAllByRole('listitem')
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('un singur H1 Cluburi, fără subtitlu și fără trunchiere', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  const titlu = await screen.findByRole('heading', { level: 1, name: 'Cluburi' })
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(titlu.className).toMatch(/break-words/)
  expect(titlu.className).not.toMatch(/truncate/)
  expect(screen.queryByText(/privire de ansamblu/i)).not.toBeInTheDocument()
})

test('grila e 1 / 2 / 4 coloane, fără overflow orizontal', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  const grila = screen.getByRole('list')
  expect(grila.className).toMatch(/grid-cols-1/)
  expect(grila.className).toMatch(/md:grid-cols-2/)
  expect(grila.className).toMatch(/lg:grid-cols-4/)
  expect(grila.className).not.toMatch(/lg:grid-cols-3/)
  expect(grila.className).not.toMatch(/overflow-x-auto/)
})

test('cardul arată nume, oraș și email, cu — unde lipsește', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()

  const alpha = carduri().find((item) => within(item).queryByText('Alpha Club'))
  expect(alpha).toBeTruthy()
  expect(within(alpha!).getAllByText('—')).toHaveLength(1)
  expect(within(alpha!).getByText('alpha@club.test')).toBeInTheDocument()

  const miscare = carduri().find((item) => within(item).queryByText('Club Mișcare'))
  expect(miscare).toBeTruthy()
  expect(within(miscare!).getByText('Timișoara')).toBeInTheDocument()
  expect(within(miscare!).getByText('—')).toBeInTheDocument()

  const gamma = carduri().find((item) => within(item).queryByText('Gamma Club'))
  expect(gamma).toBeTruthy()
  expect(within(gamma!).getAllByText('—')).toHaveLength(2)
})

test('cardurile rămân statice, fără link de detaliu', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  expect(screen.queryByRole('link', { name: 'Alpha Club' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Zebra Club' })).not.toBeInTheDocument()
  for (const card of carduri()) {
    expect(card.tagName).toBe('LI')
    expect(card.className).toMatch(/focus-visible:ring-\[3px\]/)
    expect(card.className).toMatch(/focus-visible:ring-ring\/50/)
  }
})

test('cautarea filtreaza dupa nume, oras sau email, peste diacritice', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  const camp = screen.getByLabelText(/Caută cluburi/)

  await userEvent.type(camp, 'miscare')
  await waitFor(() => expect(screen.getByText('Club Mișcare')).toBeInTheDocument())
  expect(screen.queryByText('Alpha Club')).not.toBeInTheDocument()

  await userEvent.clear(camp)
  await userEvent.type(camp, 'timisoara')
  await waitFor(() => expect(screen.getByText('Club Mișcare')).toBeInTheDocument())
  expect(screen.queryByText('Zebra Club')).not.toBeInTheDocument()

  await userEvent.clear(camp)
  await userEvent.type(camp, 'zebra@')
  await waitFor(() => expect(screen.getByText('Zebra Club')).toBeInTheDocument())
  expect(screen.queryByText('Alpha Club')).not.toBeInTheDocument()
})

test('lista goala are mesajul ei si nu ofera reincercare', async () => {
  mockedClubs.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText('Niciun club înregistrat.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
  expect(screen.queryByText('Niciun club găsit.')).not.toBeInTheDocument()
})

test('o cautare fara rezultate spune Niciun club găsit, nu ca baza e goala', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  await userEvent.type(screen.getByLabelText(/Caută cluburi/), 'zzz')
  expect(await screen.findByText('Niciun club găsit.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun club înregistrat.')).not.toBeInTheDocument()
})

test('o incarcare esuata da mesaj propriu si reincercare, nu ecranul de lista goala', async () => {
  mockedClubs.mockRejectedValue(new Error('500'))
  renderPage()
  const alerta = await screen.findByRole('alert')
  expect(within(alerta).getByText('Nu am putut încărca cluburile.')).toBeInTheDocument()
  expect(within(alerta).getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  expect(screen.queryByText('Niciun club înregistrat.')).not.toBeInTheDocument()
})

test('Reîncearcă e dezactivat cu Se reîncarcă…, apoi mută focusul pe H1', async () => {
  let resolveRetry: ((value: AdminClub[]) => void) | undefined
  mockedClubs.mockRejectedValueOnce(new Error('500')).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveRetry = resolve
      }),
  )
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Reîncearcă' }))
  const busy = await screen.findByRole('button', { name: 'Se reîncarcă…' })
  expect(busy).toBeDisabled()
  resolveRetry!(listaNesortata())
  expect(await screen.findByText('Alpha Club')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await waitFor(() => {
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Cluburi' }))
  })
})

test('lista e sortata A-Z dupa nume, chiar daca API-ul intoarce altfel', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  const nume = carduri().map((item) => item.querySelector('.font-semibold')?.textContent)
  expect(nume).toEqual([
    'Alpha Club',
    'Beta Club',
    'Club Mișcare',
    'Delta Club',
    'Gamma Club',
    'Zebra Club',
  ])
})

test('Adaugă club duce la /admin/codes', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  const adauga = await screen.findByRole('link', { name: 'Adaugă club' })
  expect(adauga).toHaveAttribute('href', '/admin/codes')
  await userEvent.click(adauga)
  expect(screen.getByText('pagina coduri invitație')).toBeInTheDocument()
})

test('in incarcare, scheletul pastreaza grila de carduri', async () => {
  mockedClubs.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Cluburi' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Adaugă club' })).toBeInTheDocument()
  const grila = screen.getByRole('list')
  expect(grila).toHaveAttribute('aria-busy', 'true')
  expect(grila.className).toMatch(/lg:grid-cols-4/)
  expect(carduri()).toHaveLength(6)
  expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(6)
})
