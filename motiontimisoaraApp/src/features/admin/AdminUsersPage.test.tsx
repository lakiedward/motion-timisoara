import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminUsersPage />
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

/** Tabelul de desktop; pe telefon acelasi utilizator apare si in lista de carduri. */
function tabel() {
  return screen.getByRole('table')
}

/** Randul unui utilizator din tabel; in tabel exista mai multe butoane omonime. */
function rand(nume: string) {
  return within(tabel()).getByText(nume).closest('tr')!
}

/**
 * Sceletul de incarcare e tot un <table>, ca primul rand sa nu-si mute pozitia,
 * deci `findByRole('table')` s-ar rezolva pe el. Asteptam numaratorul, care apare
 * doar dupa ce sosesc datele.
 */
function asteaptaLista() {
  return screen.findByRole('status')
}

beforeEach(() => {
  vi.clearAllMocks()
})

// --- Criteriile 6 si 8: eroarea nu mai arata ca lista goala ---
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

  expect(await screen.findByRole('table')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

// --- Criteriul 7: garda pe lungime ---
test('un refetch picat nu sterge de pe ecran utilizatorii deja incarcati', async () => {
  mockedUsers.mockResolvedValueOnce(lista()).mockRejectedValue(new Error('500'))
  mockedToggle.mockResolvedValue(undefined as never)
  renderPage()
  await asteaptaLista()

  // Comutarea invalideaza lista, deci declanseaza refetch-ul care pica.
  await userEvent.click(within(tabel()).getByRole('button', { name: 'Activează' }))

  await waitFor(() => expect(mockedUsers).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(within(tabel()).getByText('Laki Admin')).toBeInTheDocument()
  expect(screen.queryByText('Nu am putut încărca utilizatorii.')).not.toBeInTheDocument()
})

// --- Criteriul 9: sceletul are forma tabelului ---
test('in incarcare, sceletul pastreaza antetul tabelului, deci primul rand nu se muta', async () => {
  mockedUsers.mockReturnValue(new Promise(() => {}) as never)
  renderPage()

  const antet = within(tabel()).getAllByRole('columnheader').map((th) => th.textContent)
  expect(antet.slice(0, 4)).toEqual(['Nume', 'Email', 'Rol', 'Status'])
  expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(1)
  // Numaratorul apare doar cu date, deci in incarcare are nevoie de un loc rezervat:
  // fara el, tabelul statea cu 32px mai sus si primul rand tot sarea.
  const inainteaTabelului = tabel().closest('div')!.previousElementSibling!
  expect(inainteaTabelului.getAttribute('data-slot')).toBe('skeleton')
})

// --- Criteriile 1 si 2: pragul intre tabel si carduri e 768px ---
test('tabelul apare de la 768px in sus, iar cardurile doar sub 768px', async () => {
  mockedUsers.mockResolvedValue(lista())
  const { container } = renderPage()
  await asteaptaLista()

  const invelis = tabel().closest('div')!
  expect(invelis.className).toMatch(/(^|\s)hidden(\s|$)/)
  expect(invelis.className).toMatch(/md:block/)
  const carduri = container.querySelector('ul')!
  expect(carduri.className).toMatch(/md:hidden/)
  // Fiecare utilizator apare in ambele arborii, iar CSS-ul alege unul.
  expect(within(carduri).getAllByRole('listitem')).toHaveLength(3)
})

test('cardul de telefon arata rolul, statusul si actiunea — cele trei lucruri taiate inainte', async () => {
  mockedUsers.mockResolvedValue(lista())
  const { container } = renderPage()
  await asteaptaLista()

  const card = within(container.querySelector('ul')!).getAllByRole('listitem')[2]
  expect(within(card).getByText('COACH')).toBeInTheDocument()
  expect(within(card).getByText('Dezactivat')).toBeInTheDocument()
  expect(within(card).getByRole('button', { name: 'Activează' })).toBeInTheDocument()
  // Emailul lung se rupe, nu se taie: deosebeste conturile omonime.
  expect(within(card).getByText('uiaudit.coach@motiontimisoara.test').className).toMatch(/break-all/)
})

// --- Criteriul 3: 44px sub 1024px, 32px permis pe desktop ---
test('actiunile au 44px pana la 1024px si coboara la 32px abia pe desktop', async () => {
  mockedUsers.mockResolvedValue(lista())
  const { container } = renderPage()
  await asteaptaLista()

  const dinTabel = within(tabel()).getByRole('button', { name: 'Activează' })
  expect(dinTabel.className).toMatch(/min-h-11/)
  expect(dinTabel.className).toMatch(/lg:min-h-8/)

  const dinCard = within(container.querySelector('ul')!).getByRole('button', { name: 'Activează' })
  expect(dinCard.className).toMatch(/min-h-11/)
  expect(dinCard.className).not.toMatch(/lg:min-h-8/)

  expect(screen.getByLabelText(/Caută utilizatori/).className).toMatch(/min-h-11/)
})

// --- Criteriile 4 si 5: butonul se citeste ca buton, randul se evidentiaza ---
test('actiunea are contur in repaus si randul primeste fundal la hover', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const buton = within(tabel()).getByRole('button', { name: 'Activează' })
  expect(buton.className).toMatch(/\bborder\b/)
  expect(buton.className).not.toMatch(/^\s*$/)

  expect(rand('Laki Admin').className).toMatch(/hover:bg-accent/)
})

// --- Criteriul 10: statusul e badge, nu text colorat ---
test('statusul apare ca badge, nu ca text verde sau rosu', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const activ = within(tabel()).getAllByText('Activ')[0]
  const dezactivat = within(tabel()).getByText('Dezactivat')
  expect(activ.getAttribute('data-slot')).toBe('badge')
  expect(dezactivat.getAttribute('data-slot')).toBe('badge')
  // Nu mai e text colorat pe fundal alb: `text-success-foreground` din badge e alt lucru.
  expect(activ.className).not.toMatch(/(^|\s)text-success(\s|$)/)
  expect(dezactivat.className).not.toMatch(/(^|\s)text-destructive(\s|$)/)
})

// --- Criteriul 11: confirmarea spune pe cine a afectat ---
test('o comutare reusita confirma cu numele contului', async () => {
  mockedUsers.mockResolvedValue(lista())
  mockedToggle.mockResolvedValue(undefined as never)
  renderPage()
  await asteaptaLista()

  await userEvent.click(
    within(rand('Audit Părinte')).getByRole('button', { name: 'Dezactivează' }),
  )

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

  await userEvent.click(
    within(rand('Audit Părinte')).getByRole('button', { name: 'Dezactivează' }),
  )

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nu am putut actualiza utilizatorul.'))
  expect(toast.success).not.toHaveBeenCalled()
})

// --- Criteriul 13: cautare si numarator ---
test('cautarea filtreaza dupa nume si email, peste diacritice, iar numaratorul urmeaza filtrul', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()
  expect(screen.getByRole('status')).toHaveTextContent('3 utilizatori')

  const camp = screen.getByLabelText(/Caută utilizatori/)
  await userEvent.type(camp, 'parinte')

  await waitFor(() => expect(within(tabel()).queryByText('Laki Admin')).not.toBeInTheDocument())
  expect(within(tabel()).getByText('Audit Părinte')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('1 din 3 utilizatori')

  await userEvent.clear(camp)
  await userEvent.type(camp, 'uiaudit.coach@')
  await waitFor(() => expect(within(tabel()).getByText('Audit Antrenor')).toBeInTheDocument())
  expect(within(tabel()).queryByText('Audit Părinte')).not.toBeInTheDocument()
})

test('o cautare fara rezultate spune ca e o cautare, nu ca platforma e goala', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  await userEvent.type(screen.getByLabelText(/Caută utilizatori/), 'zzz')

  expect(await screen.findByText(/Niciun utilizator nu se potrivește cu căutarea/)).toBeInTheDocument()
  expect(screen.queryByText('Niciun utilizator înregistrat.')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Șterge căutarea' }))
  expect(await screen.findByRole('table')).toBeInTheDocument()
})

// --- Criteriul 14: randurile de ADMIN spun de ce nu au actiune ---
test('randul de ADMIN pastreaza actiunea, inactiva, si explica motivul', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const buton = within(rand('Laki Admin')).getByRole('button', { name: 'Dezactivează' })
  expect(buton).toBeDisabled()
  expect(buton.parentElement).toHaveAttribute(
    'title',
    'Conturile de administrator nu pot fi dezactivate',
  )
})

// --- Criteriul 15: coloana Inregistrat explica ordinea listei ---
test('tabelul are coloana Înregistrat, ascunsa sub 1024px', async () => {
  mockedUsers.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const antet = within(tabel())
    .getAllByRole('columnheader')
    .find((th) => th.textContent === 'Înregistrat')!
  expect(antet).toBeInTheDocument()
  expect(antet.className).toMatch(/(^|\s)hidden(\s|$)/)
  expect(antet.className).toMatch(/lg:table-cell/)
  expect(within(tabel()).getAllByText('11 aug. 2026').length).toBeGreaterThan(0)
})
