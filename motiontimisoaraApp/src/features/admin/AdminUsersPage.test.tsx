import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { toast } from 'sonner'

import AdminUsersPage from './AdminUsersPage'
import { getAllUsers, setUserEnabled, type AdminUser } from '@/api/admin'

vi.mock('@/api/admin', () => ({
  getAllUsers: vi.fn(),
  setUserEnabled: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedUsers = vi.mocked(getAllUsers)
const mockedToggle = vi.mocked(setUserEnabled)

function renderPage(ruta = '/admin/users') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function user(over: Partial<AdminUser> & { id: string; name: string; email: string }): AdminUser {
  return {
    role: 'PARENT',
    enabled: true,
    created_at: '2026-08-11T09:34:31.850Z',
    ...over,
  } as AdminUser
}

const lista = (): AdminUser[] => [
  user({ id: '1', name: 'Laki Admin', email: 'laki.admin@motiontimisoara.test', role: 'ADMIN' }),
  user({ id: '2', name: 'Audit Părinte', email: 'uiaudit.parent@motiontimisoara.test' }),
  user({
    id: '3',
    name: 'Audit Antrenor',
    email: 'uiaudit.coach@motiontimisoara.test',
    role: 'COACH',
    enabled: false,
  }),
]

function grup(nume: string) {
  return screen.getByRole('region', { name: nume })
}

function tabel(nume = 'Antrenori') {
  return within(grup(nume)).getByRole('table')
}

function rand(nume: string) {
  return screen.getAllByRole('row').find((tr) => tr.textContent?.includes(nume))
}

function carduri(nume = 'Antrenori') {
  return grup(nume).querySelector('ul')!
}

function asteaptaLista() {
  return screen.findByRole('status')
}

beforeEach(() => {
  vi.clearAllMocks()
})
test('o incarcare esuata da mesaj propriu si buton de reincercare, nu ecranul de lista goala', async () => {
  mockedUsers.mockRejectedValue(new Error('500'))
  renderPage()

  const alerta = await screen.findByRole('alert')
  expect(within(alerta).getByText('Nu am putut încărca utilizatorii.')).toBeInTheDocument()
  expect(within(alerta).getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  expect(screen.queryByText('Niciun utilizator înregistrat.')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('lista goala are mesajul ei si nu ofera reincercare', async () => {
  mockedUsers.mockResolvedValue([])
  renderPage()

  expect(await screen.findByText('Niciun utilizator înregistrat.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
})

test('„Reîncearcă" reia incarcarea si aduce lista, fara reload de pagina', async () => {
  mockedUsers.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce(lista())
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Reîncearcă' }))

  expect((await screen.findAllByRole('table')).length).toBeGreaterThan(0)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
test('un refetch picat nu sterge de pe ecran utilizatorii deja incarcati', async () => {
  mockedUsers.mockResolvedValueOnce(lista()).mockRejectedValue(new Error('500'))
  mockedToggle.mockResolvedValue(undefined as never)
  renderPage()
  await asteaptaLista()
  await userEvent.click(within(tabel()).getByRole('button', { name: 'Activează' }))

  await waitFor(() => expect(mockedUsers).toHaveBeenCalledTimes(2))
  expect(rand('Laki Admin')).toBeDefined()
  expect(screen.queryByText('Nu am putut încărca utilizatorii.')).not.toBeInTheDocument()
})

test('in incarcare, sceletul rezerva pastilele, numaratorul si randurile listei', async () => {
  mockedUsers.mockReturnValue(new Promise(() => {}) as never)
  renderPage()

  const schelet = screen.getByTestId('users-loading')
  expect(schelet.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(8)
  expect(schelet.querySelector('.rounded-xl.border')).not.toBeNull()
})

test('tabelul apare de la 768px in sus, iar cardurile doar sub 768px', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  expect(tabel().className).toMatch(/(^|\s)hidden(\s|$)/)
  expect(tabel().className).toMatch(/md:table/)
  expect(carduri().className).toMatch(/md:hidden/)
  expect(within(carduri()).getAllByRole('listitem')).toHaveLength(1)
})

test('fiecare rol are cardul lui flat, fara umbra, ca organizatorii de la Cursuri', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
    'Părinți',
    'Antrenori',
    'Administratori',
  ])
  expect(grup('Antrenori').className).toMatch(/rounded-xl/)
  expect(grup('Antrenori').className).not.toMatch(/shadow/)
  expect(within(grup('Antrenori')).getByText('activi din 1', { exact: false })).toBeInTheDocument()
})

test('cardul de telefon arata rolul, statusul si actiunea', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const card = within(carduri()).getAllByRole('listitem')[0]
  expect(within(card).getByText('Antrenor')).toBeInTheDocument()
  expect(within(card).getByText('Dezactivat')).toBeInTheDocument()
  expect(within(card).getByRole('button', { name: 'Activează' })).toBeInTheDocument()
  expect(
    within(card).getByText('uiaudit.coach@motiontimisoara.test').closest('p')!.className,
  ).toMatch(/break-all/)
})

test('actiunile au 44px pana la 1024px si coboara la 32px abia pe desktop', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const dinTabel = within(tabel()).getByRole('button', { name: 'Activează' })
  expect(dinTabel.className).toMatch(/min-h-touch-target/)
  expect(dinTabel.className).toMatch(/lg:min-h-8/)

  const dinCard = within(carduri()).getByRole('button', { name: 'Activează' })
  expect(dinCard.className).toMatch(/min-h-touch-target/)
  expect(dinCard.className).not.toMatch(/lg:min-h-8/)

  expect(screen.getByLabelText(/Caută utilizatori/).className).toMatch(/min-h-touch-target/)
  for (const pastila of screen.getAllByRole('button', { pressed: false })) {
    expect(pastila.className).toMatch(/min-h-touch-target/)
  }
})

test('actiunea are contur in repaus si randul primeste fundal la hover', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const buton = within(tabel()).getByRole('button', { name: 'Activează' })
  expect(buton.className).toMatch(/\bborder\b/)
  expect(rand('Laki Admin')!.className).toMatch(/hover:bg-accent/)
})

test('statusul apare ca badge, nu ca text verde sau rosu', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const activ = within(tabel('Părinți')).getAllByText('Activ')[0]
  const dezactivat = within(tabel()).getByText('Dezactivat')
  expect(activ.getAttribute('data-slot')).toBe('badge')
  expect(dezactivat.getAttribute('data-slot')).toBe('badge')
  expect(activ.className).not.toMatch(/(^|\s)text-success(\s|$)/)
  expect(dezactivat.className).not.toMatch(/(^|\s)text-destructive(\s|$)/)
})

test('rolul apare in romana, ca badge', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  expect(within(rand('Laki Admin')!).getByText('Administrator').getAttribute('data-slot')).toBe(
    'badge',
  )
  expect(within(rand('Audit Părinte')!).getByText('Părinte')).toBeInTheDocument()
})

test('o comutare reusita confirma cu numele contului', async () => {
  mockedUsers.mockResolvedValue(lista())
  mockedToggle.mockResolvedValue(undefined as never)
  renderPage()
  await asteaptaLista()

  await userEvent.click(within(rand('Audit Părinte')!).getByRole('button', { name: 'Dezactivează' }))

  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Contul lui Audit Părinte a fost dezactivat.'),
  )
  expect(mockedToggle).toHaveBeenCalledWith('2', false)
})

test('o comutare esuata pastreaza mesajul de eroare si nu confirma nimic', async () => {
  mockedUsers.mockResolvedValue(lista())
  mockedToggle.mockRejectedValue(new Error('500'))
  renderPage()
  await asteaptaLista()

  await userEvent.click(within(rand('Audit Părinte')!).getByRole('button', { name: 'Dezactivează' }))

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Nu am putut actualiza utilizatorul.'),
  )
  expect(toast.success).not.toHaveBeenCalled()
})

test('cautarea filtreaza dupa nume si email, peste diacritice, iar numaratorul urmeaza filtrul', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()
  expect(screen.getByRole('status')).toHaveTextContent('3 utilizatori')

  const camp = screen.getByLabelText(/Caută utilizatori/)
  await userEvent.type(camp, 'parinte')

  await waitFor(() => expect(rand('Laki Admin')).toBeUndefined())
  expect(rand('Audit Părinte')).toBeDefined()
  expect(
    within(rand('Audit Părinte')!).getByText('Părinte', { selector: 'mark' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('1 din 3 utilizatori')

  await userEvent.clear(camp)
  await userEvent.type(camp, 'uiaudit.coach@')
  await waitFor(() => expect(rand('Audit Antrenor')).toBeDefined())
  expect(rand('Audit Părinte')).toBeUndefined()
})

test('o cautare fara rezultate spune ca e o cautare, nu ca platforma e goala', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  await userEvent.type(screen.getByLabelText(/Caută utilizatori/), 'zzz')

  expect(
    await screen.findByText(/Niciun utilizator nu se potrivește cu căutarea/),
  ).toBeInTheDocument()
  expect(screen.queryByText('Niciun utilizator înregistrat.')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Șterge căutarea' }))
  expect((await screen.findAllByRole('table')).length).toBeGreaterThan(0)
})

test('pastilele de status filtreaza si arata numaratorii', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const status = screen.getByRole('group', { name: 'Status' })
  expect(within(status).getByRole('button', { name: /Toți 3/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await userEvent.click(within(status).getByRole('button', { name: /Dezactivați 1/ }))

  expect(screen.getByRole('status')).toHaveTextContent('1 din 3 utilizatori')
  expect(rand('Audit Antrenor')).toBeDefined()
  expect(rand('Laki Admin')).toBeUndefined()
})

test('randul de ADMIN pastreaza actiunea, inactiva, si explica motivul accesibil', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const buton = within(rand('Laki Admin')!).getByRole('button', { name: 'Dezactivează' })
  expect(buton).toHaveAttribute('aria-disabled', 'true')
  expect(buton).toHaveAttribute('title', 'Conturile de administrator nu pot fi dezactivate')
  expect(buton).toHaveAccessibleDescription('Conturile de administrator nu pot fi dezactivate')
  await userEvent.click(buton)
  expect(mockedToggle).not.toHaveBeenCalled()
})

test('tabelul are coloana Înregistrat, ascunsa sub 1024px', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const antet = within(tabel())
    .getAllByRole('columnheader')
    .find((th) => th.textContent === 'Înregistrat')!
  expect(antet.className).toMatch(/(^|\s)hidden(\s|$)/)
  expect(antet.className).toMatch(/lg:table-cell/)
  expect(within(tabel()).getAllByText('11 aug. 2026').length).toBeGreaterThan(0)
})

test('?role=COACH deschide doar grupul de antrenori', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage('/admin/users?role=COACH')
  await asteaptaLista()

  const deschis = (nume: string) =>
    within(grup(nume)).getByRole('button', {
      expanded: true,
      hidden: false,
      name: new RegExp(nume),
    })
  expect(deschis('Antrenori')).toBeInTheDocument()
  expect(within(grup('Părinți')).getByRole('button', { name: /Părinți/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  expect(rand('Audit Antrenor')).toBeDefined()
  expect(rand('Laki Admin')).toBeUndefined()

  await userEvent.click(within(grup('Părinți')).getByRole('button', { name: /Părinți/ }))
  expect(rand('Audit Părinte')).toBeDefined()
})

test('un grup mare arata primele 5 randuri, apoi pe toate la cerere', async () => {
  mockedUsers.mockResolvedValue(
    Array.from({ length: 120 }, (_, i) =>
      user({ id: `u${i}`, name: `Persoana ${i}`, email: `p${i}@x.ro` }),
    ),
  )
  renderPage()
  await asteaptaLista()

  expect(within(tabel('Părinți')).getAllByRole('row')).toHaveLength(6)
  await userEvent.click(screen.getByRole('button', { name: 'Arată toți cei 120 de utilizatori' }))
  expect(within(tabel('Părinți')).getAllByRole('row')).toHaveLength(121)
  expect(screen.queryByRole('button', { name: /Arată toți cei/ })).not.toBeInTheDocument()
})

test('cautarea deschide toate grupurile si arata toate potrivirile', async () => {
  mockedUsers.mockResolvedValue(
    Array.from({ length: 12 }, (_, i) =>
      user({ id: `u${i}`, name: `Persoana ${i}`, email: `p${i}@x.ro` }),
    ),
  )
  renderPage()
  await asteaptaLista()

  await userEvent.type(screen.getByLabelText(/Caută utilizatori/), 'persoana')
  await waitFor(() => expect(within(tabel('Părinți')).getAllByRole('row')).toHaveLength(13))
})
