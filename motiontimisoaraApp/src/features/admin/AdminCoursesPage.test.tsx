import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { toast } from 'sonner'

import AdminCoursesPage from './AdminCoursesPage'
import { getAllCourses, setCourseActiveAdmin, type AdminCourse } from '@/api/admin'

vi.mock('@/api/admin', () => ({
  getAllCourses: vi.fn(),
  setCourseActiveAdmin: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedCourses = vi.mocked(getAllCourses)
const mockedToggle = vi.mocked(setCourseActiveAdmin)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminCoursesPage />
    </QueryClientProvider>,
  )
}

function curs(over: Partial<AdminCourse> & { id: string; name: string }): AdminCourse {
  return {
    price: 48000,
    active: true,
    sport: { name: 'Înot' },
    coach: { name: 'Audit Antrenor' },
    location: { name: 'Bazin Olimpic Timișoara' },
    club: null,
    ...over,
  } as AdminCourse
}

/** Doua cursuri omonime, cu acelasi sport si antrenor, la locatii diferite. */
const lista = (): AdminCourse[] => [
  curs({
    id: '1',
    name: 'Înot — audit UI',
    price: 40000,
    location: { name: 'Bazin Audit Motion' },
    club: { name: 'Club Audit Motion' },
  }),
  curs({ id: '2', name: 'Înot — audit UI', price: 60000 }),
  curs({
    id: '3',
    name: 'Alergare — audit UI',
    active: false,
    sport: { name: 'Alergare' },
    location: { name: 'Stadion Atletism' },
  }),
]

function tabel() {
  return screen.getByRole('table')
}

function rand(nume: string) {
  return within(tabel()).getAllByText(nume)[0].closest('tr')!
}

/** Sceletul e tot un <table>; numaratorul apare doar dupa ce sosesc datele. */
function asteaptaLista() {
  return screen.findByRole('status')
}

beforeEach(() => {
  vi.clearAllMocks()
})

// --- Criteriile 6 si 8: eroarea nu mai arata ca lista goala ---
test('o incarcare esuata da mesaj propriu si reincercare, nu ecranul de lista goala', async () => {
  mockedCourses.mockRejectedValue(new Error('500'))
  renderPage()

  const alerta = await screen.findByRole('alert')
  expect(within(alerta).getByText('Nu am putut încărca cursurile.')).toBeInTheDocument()
  expect(within(alerta).getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  expect(screen.queryByText(/Niciun curs înregistrat/)).not.toBeInTheDocument()
})

test('lista goala spune si unde se creeaza cursurile, fiindca din admin nu se poate', async () => {
  mockedCourses.mockResolvedValue([])
  renderPage()

  const gol = await screen.findByText(/Niciun curs înregistrat/)
  expect(gol).toHaveTextContent('Cursurile se creează din portalul clubului sau al antrenorului')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
})

test('„Reîncearcă" aduce lista, fara reload de pagina', async () => {
  mockedCourses.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce(lista())
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Reîncearcă' }))

  await asteaptaLista()
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

// --- Criteriul 7: garda pe lungime ---
test('un refetch picat nu sterge de pe ecran cursurile deja incarcate', async () => {
  mockedCourses.mockResolvedValueOnce(lista()).mockRejectedValue(new Error('500'))
  mockedToggle.mockResolvedValue(undefined as never)
  renderPage()
  await asteaptaLista()

  await userEvent.click(within(rand('Alergare — audit UI')).getByRole('button', { name: 'Activează' }))

  await waitFor(() => expect(mockedCourses).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(within(tabel()).getAllByText('Înot — audit UI')).toHaveLength(2)
  expect(screen.queryByText('Nu am putut încărca cursurile.')).not.toBeInTheDocument()
})

// --- Criteriul 9: sceletul are forma tabelului ---
test('in incarcare, sceletul pastreaza antetul si tine locul numaratorului', async () => {
  mockedCourses.mockReturnValue(new Promise(() => {}) as never)
  renderPage()

  const antet = within(tabel()).getAllByRole('columnheader').map((th) => th.textContent)
  expect(antet.slice(0, 5)).toEqual(['Curs', 'Sport', 'Antrenor', 'Preț', 'Status'])
  const inainteaTabelului = tabel().closest('div')!.previousElementSibling!
  expect(inainteaTabelului.getAttribute('data-slot')).toBe('skeleton')
})

// --- Criteriile 1 si 2: pragul e 768px ---
test('tabelul apare de la 768px in sus, iar fisele doar sub 768px', async () => {
  mockedCourses.mockResolvedValue(lista())
  const { container } = renderPage()
  await asteaptaLista()

  const invelis = tabel().closest('div')!
  expect(invelis.className).toMatch(/(^|\s)hidden(\s|$)/)
  expect(invelis.className).toMatch(/md:block/)
  const fise = container.querySelector('ul')!
  expect(fise.className).toMatch(/md:hidden/)
  expect(within(fise).getAllByRole('listitem')).toHaveLength(3)
})

// --- Criteriul 15: structura fisei de telefon ---
test('fisa de telefon are nume plus locatie, linia gri si pretul langa actiune', async () => {
  mockedCourses.mockResolvedValue(lista())
  const { container } = renderPage()
  await asteaptaLista()

  const fisa = within(container.querySelector('ul')!).getAllByRole('listitem')[0]
  expect(within(fisa).getByText('Bazin Audit Motion')).toBeInTheDocument()
  expect(within(fisa).getByText(/Înot · Audit Antrenor · Club Audit Motion/)).toBeInTheDocument()
  expect(within(fisa).getByText('Activ')).toBeInTheDocument()
  expect(within(fisa).getByRole('button', { name: 'Dezactivează' })).toBeInTheDocument()
})

// --- Criteriul 3: 44px sub 1024px ---
test('actiunile au 44px pana la 1024px si coboara la 32px abia pe desktop', async () => {
  mockedCourses.mockResolvedValue(lista())
  const { container } = renderPage()
  await asteaptaLista()

  const dinTabel = within(rand('Alergare — audit UI')).getByRole('button', { name: 'Activează' })
  expect(dinTabel.className).toMatch(/min-h-11/)
  expect(dinTabel.className).toMatch(/lg:min-h-8/)

  const dinFisa = within(container.querySelector('ul')!).getByRole('button', { name: 'Activează' })
  expect(dinFisa.className).toMatch(/min-h-11/)
  expect(dinFisa.className).not.toMatch(/lg:min-h-8/)

  expect(screen.getByLabelText(/Caută cursuri/).className).toMatch(/min-h-11/)
})

// --- Criteriile 4 si 5: buton cu contur, rand evidentiat ---
test('actiunea are contur in repaus si randul primeste fundal la hover', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const buton = within(rand('Alergare — audit UI')).getByRole('button', { name: 'Activează' })
  expect(buton.className).toMatch(/\bborder\b/)
  expect(rand('Alergare — audit UI').className).toMatch(/hover:bg-accent/)
})

// --- Criteriul 10: locatia deosebeste cursurile omonime ---
test('locatia apare sub numele cursului, deci doua cursuri omonime nu arata identic', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const omonime = within(tabel()).getAllByText('Înot — audit UI')
  expect(omonime).toHaveLength(2)
  const locatii = omonime.map((el) => el.nextElementSibling?.textContent)
  expect(locatii).toEqual(['Bazin Audit Motion', 'Bazin Olimpic Timișoara'])
  expect(new Set(locatii).size).toBe(2)
})

// --- Criteriul 14: clubul, si mentiunea pentru antrenorii independenti ---
test('cursurile fara club spun „Antrenor independent", nu lasa celula goala', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  expect(within(rand('Alergare — audit UI')).getByText('Antrenor independent')).toBeInTheDocument()
  expect(within(tabel()).getByText('Club Audit Motion')).toBeInTheDocument()
})

// --- Criteriul 16: pretul aliniat la dreapta ---
test('coloana de preț e aliniată la dreapta, antet și celule', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const antetPret = within(tabel())
    .getAllByRole('columnheader')
    .find((th) => th.textContent === 'Preț')!
  expect(antetPret.className).toMatch(/text-right/)
  const celula = rand('Alergare — audit UI').cells[3]
  expect(celula.className).toMatch(/text-right/)
})

// --- Criteriul 17: statusul ramane badge ---
test('statusul ramane badge, si pentru activ si pentru inactiv', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const inactiv = within(rand('Alergare — audit UI')).getByText('Inactiv')
  expect(inactiv.getAttribute('data-slot')).toBe('badge')
  expect(within(tabel()).getAllByText('Activ')[0].getAttribute('data-slot')).toBe('badge')
})

// --- Criteriul 11: confirmarea spune ce curs a fost afectat ---
test('o comutare reusita confirma cu numele cursului', async () => {
  mockedCourses.mockResolvedValue(lista())
  mockedToggle.mockResolvedValue(undefined as never)
  renderPage()
  await asteaptaLista()

  await userEvent.click(within(rand('Alergare — audit UI')).getByRole('button', { name: 'Activează' }))

  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Cursul Alergare — audit UI a fost activat.'),
  )
  expect(mockedToggle).toHaveBeenCalledWith('3', true)
})

test('o comutare esuata pastreaza eroarea si nu confirma nimic', async () => {
  mockedCourses.mockResolvedValue(lista())
  mockedToggle.mockRejectedValue(new Error('500'))
  renderPage()
  await asteaptaLista()

  await userEvent.click(within(rand('Alergare — audit UI')).getByRole('button', { name: 'Activează' }))

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nu am putut actualiza cursul.'))
  expect(toast.success).not.toHaveBeenCalled()
})

// --- Criteriul 12: cautare si numarator ---
test('cautarea merge dupa curs si dupa antrenor, peste diacritice, cu numarator', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()
  expect(screen.getByRole('status')).toHaveTextContent('3 cursuri')

  const camp = screen.getByLabelText(/Caută cursuri/)
  await userEvent.type(camp, 'alergare')
  await waitFor(() => expect(within(tabel()).queryAllByText('Înot — audit UI')).toHaveLength(0))
  expect(screen.getByRole('status')).toHaveTextContent('1 din 3 cursuri')

  await userEvent.clear(camp)
  await userEvent.type(camp, 'audit antrenor')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 din 3 cursuri'))
})

test('o cautare fara rezultate spune ca e o cautare, nu ca platforma e goala', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  await userEvent.type(screen.getByLabelText(/Caută cursuri/), 'zzz')

  expect(await screen.findByText(/Niciun curs nu se potrivește cu căutarea/)).toBeInTheDocument()
  expect(screen.queryByText(/Niciun curs înregistrat/)).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Șterge căutarea' }))
  expect(await screen.findByRole('table')).toBeInTheDocument()
})
