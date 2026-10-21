import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

import AdminClubsPage from './AdminClubsPage'
import {
  approveClub,
  getAllClubs,
  getAllCourses,
  type AdminClub,
  type AdminCourse,
} from '@/api/admin'

vi.mock('@/api/admin', () => ({
  approveClub: vi.fn(),
  getAllClubs: vi.fn(),
  getAllCourses: vi.fn(),
}))

const mockedClubs = vi.mocked(getAllClubs)
const mockedCourses = vi.mocked(getAllCourses)

const curs = (club_id: string, active: boolean) => ({ club_id, active }) as AdminCourse

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
    approved_at: '2026-09-01T00:00:00Z',
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
  return screen.getAllByRole('list').flatMap((l) => within(l).getAllByRole('listitem'))
}

function numeClub(nume: string) {
  return screen.getByText(
    (_, el) => el?.textContent === nume && el.classList.contains('font-semibold'),
  )
}

function grup(nume: string) {
  return screen.getByRole('region', { name: nume })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedCourses.mockResolvedValue([curs('a', true), curs('a', false), curs('z', false)])
})

test('un singur H1 Cluburi, fără subtitlu și fără trunchiere', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  const titlu = await screen.findByRole('heading', { level: 1, name: 'Cluburi' })
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(titlu.className).toMatch(/break-words/)
  expect(titlu.className).not.toMatch(/truncate/)
})

test('cluburile sunt grupate după activitate, primul grup deschis, fără overflow', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  const butoane = screen.getAllByRole('button', { expanded: true })
  expect(butoane).toHaveLength(1)
  expect(butoane[0]).toHaveTextContent('Cu cursuri active')
  expect(screen.getByRole('button', { name: /Doar cursuri inactive/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  expect(screen.getByRole('button', { name: /Fără cursuri/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  expect(within(grup('Cu cursuri active')).getByText('Alpha Club')).toBeInTheDocument()
  expect(screen.getByText('6 cluburi, 1 cu cursuri active')).toBeInTheDocument()
  for (const l of screen.getAllByRole('list')) expect(l.className).not.toMatch(/overflow-x-auto/)
})

test('un grup mare arată 4 cluburi și Vezi toate', async () => {
  mockedCourses.mockResolvedValue([])
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  expect(carduri()).toHaveLength(4)
  await userEvent.click(screen.getByRole('button', { name: 'Vezi toate cele 6 cluburi' }))
  expect(carduri()).toHaveLength(6)
})

test('cardul arată nume, oraș, email și cursurile, cu — unde lipsește', async () => {
  mockedCourses.mockResolvedValue([curs('a', true), curs('a', false)])
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  await userEvent.click(screen.getByRole('button', { name: /Fără cursuri/ }))
  await userEvent.click(screen.getByRole('button', { name: /Vezi toate/ }))

  const alpha = carduri().find((item) => within(item).queryByText('Alpha Club'))!
  expect(within(alpha).getAllByText('—')).toHaveLength(1)
  expect(within(alpha).getByText('alpha@club.test')).toBeInTheDocument()
  expect(alpha).toHaveTextContent('1 activ din 2 cursuri')

  const miscare = carduri().find((item) => within(item).queryByText('Club Mișcare'))!
  expect(within(miscare).getByText('Timișoara')).toBeInTheDocument()
  expect(within(miscare).getByText('—')).toBeInTheDocument()
  expect(miscare).toHaveTextContent('Niciun curs')

  const gamma = carduri().find((item) => within(item).queryByText('Gamma Club'))!
  expect(within(gamma).getAllByText('—')).toHaveLength(2)
})

test('rândurile de club rămân statice, fără link de detaliu', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  expect(screen.queryByRole('link', { name: /Alpha Club/ })).not.toBeInTheDocument()
  for (const card of carduri()) {
    expect(card.tagName).toBe('LI')
    expect(within(card).queryByRole('link')).not.toBeInTheDocument()
  }
})

test('cautarea filtreaza dupa nume, oras sau email, peste diacritice, si deschide grupurile', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  const camp = screen.getByLabelText(/Caută cluburi/)

  await userEvent.type(camp, 'miscare')
  await waitFor(() => expect(numeClub('Club Mișcare')).toBeInTheDocument())
  expect(screen.queryByText('Alpha Club')).not.toBeInTheDocument()

  await userEvent.clear(camp)
  await userEvent.type(camp, 'oradea')
  await waitFor(() => expect(screen.getByText('Delta Club')).toBeInTheDocument())
  expect(screen.queryByText('Zebra Club')).not.toBeInTheDocument()
  expect(screen.getByText('1 din 6 cluburi')).toBeInTheDocument()

  await userEvent.clear(camp)
  await userEvent.type(camp, 'zebra@')
  await waitFor(() => expect(numeClub('Zebra Club')).toBeInTheDocument())
  expect(screen.queryByText('Alpha Club')).not.toBeInTheDocument()
})

test('filtrul Oraș păstrează doar cluburile din orașul ales', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  const oras = within(screen.getByRole('group', { name: 'Oraș' }))
  await userEvent.click(oras.getByRole('button', { name: /Arad/ }))
  expect(await screen.findByText('Zebra Club')).toBeInTheDocument()
  expect(screen.queryByText('Alpha Club')).not.toBeInTheDocument()
  expect(screen.getByText('1 din 6 cluburi')).toBeInTheDocument()
})

test('lista goala are mesajul ei si nu ofera reincercare sau stergerea filtrelor', async () => {
  mockedClubs.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText('Niciun club înregistrat.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
  expect(screen.queryByText('Niciun club găsit.')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Șterge filtrele' })).not.toBeInTheDocument()
})

test('o cautare fara rezultate spune Niciun club găsit, nu ca baza e goala', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  const camp = screen.getByLabelText(/Caută cluburi/)
  await userEvent.type(camp, 'zzz')
  expect(await screen.findByText('Niciun club găsit.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun club înregistrat.')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Șterge filtrele' }))
  expect(await screen.findByText('Alpha Club')).toBeInTheDocument()
  expect(camp).toHaveValue('')
  expect(screen.queryByText('Niciun club găsit.')).not.toBeInTheDocument()
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

test('fără cursuri încărcate, lista rămâne utilizabilă într-un singur grup', async () => {
  mockedCourses.mockRejectedValue(new Error('500'))
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  expect(await screen.findByRole('button', { name: /Toate cluburile/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  expect(screen.queryByText(/active din/)).not.toBeInTheDocument()
  expect(screen.getByText('6 cluburi')).toBeInTheDocument()
})

test('în fiecare grup cluburile sunt sortate A-Z după nume', async () => {
  mockedCourses.mockResolvedValue([])
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  await userEvent.click(screen.getByRole('button', { name: /Vezi toate/ }))
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

test('in incarcare, antetul ramane si apare scheletul', async () => {
  mockedClubs.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Cluburi' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Adaugă club' })).toBeInTheDocument()
  expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(2)
})

test('cluburile în așteptare apar în cardul De aprobat, nu în grupuri', async () => {
  mockedClubs.mockResolvedValue([
    ...listaNesortata(),
    club({ id: 'n', name: 'Club Nou', email: 'nou@club.test', approved_at: null }),
  ])
  renderPage()
  await asteaptaLista()
  const deAprobat = screen.getByRole('region', { name: 'De aprobat' })
  expect(within(deAprobat).getByText('Club Nou')).toBeInTheDocument()
  expect(deAprobat).toHaveTextContent('1 club nou, ascuns de pe site până îl aprobi')
  expect(within(grup('Fără cursuri')).queryByText('Club Nou')).not.toBeInTheDocument()
})

test('fără cluburi în așteptare nu apare cardul De aprobat', async () => {
  mockedClubs.mockResolvedValue(listaNesortata())
  renderPage()
  await asteaptaLista()
  expect(screen.queryByRole('region', { name: 'De aprobat' })).not.toBeInTheDocument()
})

test('Aprobă cere confirmare, apoi aprobă clubul și reîncarcă lista', async () => {
  const user = userEvent.setup()
  vi.mocked(approveClub).mockResolvedValue(undefined)
  mockedClubs.mockResolvedValue([
    ...listaNesortata(),
    club({ id: 'n', name: 'Club Nou', approved_at: null }),
  ])
  renderPage()
  await asteaptaLista()
  await user.click(screen.getByRole('button', { name: 'Aprobă' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Aprobi clubul Club Nou?' })
  expect(approveClub).not.toHaveBeenCalled()
  await user.click(within(dialog).getByRole('button', { name: 'Aprobă clubul' }))
  await waitFor(() => expect(approveClub).toHaveBeenCalledWith('n'))
  await waitFor(() => expect(mockedClubs).toHaveBeenCalledTimes(2))
})
