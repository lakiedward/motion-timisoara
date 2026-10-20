import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { toast } from 'sonner'

import AdminCoursesPage from './AdminCoursesPage'
import { EditCourseAction, NewCourseButton } from './courses/CourseEditActions'
import { getAllCourses, setCourseActiveAdmin, type AdminCourse } from '@/api/admin'

vi.mock('@/api/admin', () => ({
  getAllCourses: vi.fn(),
  setCourseActiveAdmin: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedCourses = vi.mocked(getAllCourses)
const mockedToggle = vi.mocked(setCourseActiveAdmin)

function renderPage(props: Parameters<typeof AdminCoursesPage>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminCoursesPage {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function curs(over: Partial<AdminCourse> & { id: string; name: string }): AdminCourse {
  return {
    price: 48000,
    currency: 'RON',
    active: true,
    capacity: 12,
    sport_id: 'inot',
    club_id: null,
    coach_id: 'antrenor-audit',
    sport: { name: 'Înot' },
    coach: { name: 'Audit Antrenor' },
    location: { name: 'Bazin Olimpic Timișoara' },
    club: null,
    enrollments: { active: 3, pending: 0 },
    ...over,
  } as AdminCourse
}

const lista = (): AdminCourse[] => [
  curs({
    id: '1',
    name: 'Înot — audit UI',
    price: 40000,
    club_id: 'club-audit',
    location: { name: 'Bazin Audit Motion' },
    club: { name: 'Club Audit Motion' },
  }),
  curs({ id: '2', name: 'Înot — audit UI', price: 60000 }),
  curs({
    id: '3',
    name: 'Alergare — audit UI',
    active: false,
    sport_id: 'alergare',
    sport: { name: 'Alergare' },
    location: { name: 'Stadion Atletism' },
    enrollments: { active: 0, pending: 0 },
  }),
]

const asteaptaLista = () => screen.findByRole('status')
const pastila = (nume: RegExp) => screen.getByRole('button', { name: nume })
const card = (nume: string) => screen.getByRole('region', { name: nume })
const tabelDin = (nume: string) => within(card(nume)).getByRole('table')
const rand = (nume: string, curs: string) =>
  within(tabelDin(nume)).getAllByText(curs)[0].closest('tr')!
const fiseDin = (nume: string) => card(nume).querySelector<HTMLElement>('ul')!

beforeEach(() => {
  vi.clearAllMocks()
})

test('o incarcare esuata da mesaj propriu si reincercare, nu ecranul de lista goala', async () => {
  mockedCourses.mockRejectedValue(new Error('500'))
  renderPage()

  const alerta = await screen.findByRole('alert')
  expect(within(alerta).getByText('Nu am putut încărca cursurile.')).toBeInTheDocument()
  expect(within(alerta).getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  expect(screen.queryByText(/Niciun curs înregistrat/)).not.toBeInTheDocument()
})

test('lista goala duce direct la crearea primului curs din admin', async () => {
  mockedCourses.mockResolvedValue([])
  renderPage()

  const gol = await screen.findByText(/Niciun curs înregistrat/)
  expect(within(gol).getByRole('link', { name: 'Creează primul curs' })).toHaveAttribute(
    'href',
    '/admin/courses/new',
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('„Reîncearcă" aduce lista, fara reload de pagina', async () => {
  mockedCourses.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce(lista())
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Reîncearcă' }))

  await asteaptaLista()
  expect(card('Club Audit Motion')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('un refetch picat nu sterge de pe ecran cursurile deja incarcate', async () => {
  mockedCourses.mockResolvedValueOnce(lista()).mockRejectedValue(new Error('500'))
  mockedToggle.mockResolvedValue(undefined as never)
  renderPage()
  await asteaptaLista()

  await userEvent.click(
    within(rand('Audit Antrenor', 'Înot — audit UI')).getByRole('button', { name: 'Dezactivează' }),
  )

  await waitFor(() => expect(mockedCourses).toHaveBeenCalledTimes(2))
  expect(within(tabelDin('Audit Antrenor')).getByText('Înot — audit UI')).toBeInTheDocument()
  expect(screen.queryByText('Nu am putut încărca cursurile.')).not.toBeInTheDocument()
})

test('in incarcare, sceletul are pastilele si cardurile de organizator, fara numarator', () => {
  mockedCourses.mockReturnValue(new Promise(() => {}) as never)
  const { container } = renderPage()

  expect(screen.getByRole('heading', { name: 'Cursuri' })).toBeInTheDocument()
  expect(container.querySelectorAll('[data-slot="skeleton"].rounded-full')).toHaveLength(4)
  expect(container.querySelectorAll('[data-slot="skeleton"].rounded-xl')).toHaveLength(4)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('cursurile sunt grupate pe cluburi si antrenori independenti, cu rezumat pe organizator', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  expect(screen.getByRole('heading', { name: 'Cluburi · 1' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Antrenori independenți · 1' })).toBeInTheDocument()
  const antrenor = card('Audit Antrenor')
  expect(antrenor).toHaveTextContent('1 active din 2')
  expect(antrenor).toHaveTextContent('3 copii înscriși')
  expect(screen.getByRole('status')).toHaveTextContent(
    '2 cursuri active la 1 club și 1 antrenor independent',
  )
})

test('implicit se vad cursurile active; pastilele de stare au numarul lor', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  expect(pastila(/^Active/)).toHaveAttribute('aria-pressed', 'true')
  expect(pastila(/^Inactive/)).toHaveTextContent('1')
  expect(pastila(/^Toate\s*3/)).toBeInTheDocument()
  expect(screen.queryByText('Alergare — audit UI')).not.toBeInTheDocument()

  await userEvent.click(pastila(/^Inactive/))
  expect((await screen.findAllByText('Alergare — audit UI')).length).toBeGreaterThan(0)
  expect(screen.queryByText('Înot — audit UI')).not.toBeInTheDocument()
})

test('filtrul de sport ingusteaza lista si se poate scoate', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()
  await userEvent.click(pastila(/^Toate\s*3/))

  await userEvent.click(pastila(/^Alergare/))
  expect(screen.queryByText('Înot — audit UI')).not.toBeInTheDocument()
  expect(screen.getAllByText('Alergare — audit UI').length).toBeGreaterThan(0)

  await userEvent.click(pastila(/^Toate sporturile/))
  expect(screen.getAllByText('Înot — audit UI').length).toBeGreaterThan(0)
})

test('„De verificat" aduna cursurile cu probleme si spune motivul pe rand', async () => {
  mockedCourses.mockResolvedValue([
    curs({
      id: 'a',
      name: 'Inactiv cu copii',
      active: false,
      enrollments: { active: 6, pending: 0 },
    }),
    curs({ id: 'b', name: 'Cu cereri', enrollments: { active: 1, pending: 2 } }),
    curs({ id: 'c', name: 'Plin', capacity: 8, enrollments: { active: 8, pending: 0 } }),
    curs({ id: 'd', name: 'In regula' }),
  ])
  renderPage()
  await asteaptaLista()

  expect(pastila(/^De verificat/)).toHaveTextContent('3')
  expect(card('Audit Antrenor')).toHaveTextContent('3 de verificat')
  await userEvent.click(pastila(/^De verificat/))

  const tabel = tabelDin('Audit Antrenor')
  expect(within(tabel).getByText('Inactiv, dar are 6 înscrieri active')).toBeInTheDocument()
  expect(within(tabel).getByText('2 înscrieri în așteptare')).toBeInTheDocument()
  expect(within(tabel).getByText('Locuri epuizate')).toBeInTheDocument()
  expect(within(tabel).queryByText('In regula')).not.toBeInTheDocument()
})

test('coloana Înscriși arata ocuparea fata de capacitate', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  expect(within(rand('Audit Antrenor', 'Înot — audit UI')).getByText('3/12')).toBeInTheDocument()
})

test('cautarea merge si dupa club, deschide cardul pliat si marcheaza potrivirea', async () => {
  mockedCourses.mockResolvedValue([
    ...lista(),
    curs({ id: '4', name: 'Ciclism juniori', coach_id: 'altul', coach: { name: 'Ioana Marin' } }),
  ])
  renderPage()
  await asteaptaLista()

  const antet = within(card('Ioana Marin')).getByRole('button', { name: /Ioana Marin/ })
  expect(antet).toHaveAttribute('aria-expanded', 'false')

  await userEvent.type(screen.getByLabelText(/Caută cursuri/), 'ioana')
  await waitFor(() => expect(antet).toHaveAttribute('aria-expanded', 'true'))
  expect(within(tabelDin('Ioana Marin')).getByText('Ciclism juniori')).toBeInTheDocument()
  expect(screen.getAllByText('Ioana')[0].tagName).toBe('MARK')
  expect(screen.getByRole('status')).toHaveTextContent('1 din 4 cursuri')

  await userEvent.clear(screen.getByLabelText(/Caută cursuri/))
  await userEvent.type(screen.getByLabelText(/Caută cursuri/), 'club audit')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 din 4 cursuri'))
  expect(card('Club Audit Motion')).toBeInTheDocument()
})

test('rezultatele din alte filtre se anunta si se pot vedea cu un clic', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  await userEvent.type(screen.getByLabelText(/Caută cursuri/), 'alergare')
  expect(await screen.findByText(/Niciun curs nu se potrivește cu căutarea/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Încă 1 rezultat în alte filtre' }))

  expect(pastila(/^Toate\s*3/)).toHaveAttribute('aria-pressed', 'true')
  expect((await screen.findAllByText('Alergare')).length).toBeGreaterThan(0)
})

test('o cautare fara rezultate spune ca e o cautare, nu ca platforma e goala', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  await userEvent.type(screen.getByLabelText(/Caută cursuri/), 'zzz')
  expect(await screen.findByText(/Niciun curs nu se potrivește cu căutarea/)).toBeInTheDocument()
  expect(screen.queryByText(/Niciun curs înregistrat/)).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Șterge căutarea' }))
  expect(await screen.findByRole('region', { name: 'Audit Antrenor' })).toBeInTheDocument()
})

test('un organizator cu multe cursuri arata primele 4 si „Vezi toate"', async () => {
  mockedCourses.mockResolvedValue(
    Array.from({ length: 6 }, (_, i) => curs({ id: `m${i}`, name: `Curs ${i + 1}` })),
  )
  renderPage()
  await asteaptaLista()

  expect(within(tabelDin('Audit Antrenor')).getAllByRole('row')).toHaveLength(5)
  await userEvent.click(screen.getByRole('button', { name: 'Vezi toate cele 6 cursuri' }))
  expect(within(tabelDin('Audit Antrenor')).getAllByRole('row')).toHaveLength(7)
})

test('tabelul apare de la 768px in sus, iar fisele doar sub 768px', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const tabel = tabelDin('Audit Antrenor')
  expect(tabel.className).toMatch(/(^|\s)hidden(\s|$)/)
  expect(tabel.className).toMatch(/md:table/)
  expect(fiseDin('Audit Antrenor').className).toMatch(/md:hidden/)
  expect(within(fiseDin('Audit Antrenor')).getAllByRole('listitem')).toHaveLength(1)
})

test('fisa de telefon are nume plus locatie, linia gri si pretul langa actiune', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const fisa = within(fiseDin('Club Audit Motion')).getAllByRole('listitem')[0]
  expect(within(fisa).getByText('Bazin Audit Motion')).toBeInTheDocument()
  expect(
    within(fisa).getByText(/Înot · .*Audit Antrenor.* · Club Audit Motion/),
  ).toBeInTheDocument()
  expect(within(fisa).getByText('Activ')).toBeInTheDocument()
  expect(fisa).toHaveTextContent(/400,00\slei/)
  expect(within(fisa).getByRole('button', { name: 'Dezactivează' })).toBeInTheDocument()
})

test('actiunile si pastilele au 44px pana la 1024px', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const dinTabel = within(rand('Audit Antrenor', 'Înot — audit UI')).getByRole('button', {
    name: 'Dezactivează',
  })
  expect(dinTabel.className).toMatch(/min-h-touch-target/)
  expect(dinTabel.className).toMatch(/lg:min-h-8/)
  const dinFisa = within(fiseDin('Audit Antrenor')).getByRole('button', { name: 'Dezactivează' })
  expect(dinFisa.className).toMatch(/min-h-touch-target/)
  expect(dinFisa.className).not.toMatch(/lg:min-h-8/)
  expect(pastila(/^Active/).className).toMatch(/min-h-touch-target/)
  expect(within(card('Audit Antrenor')).getAllByRole('button')[0].className).toMatch(/min-h-16/)
  expect(screen.getByLabelText(/Caută cursuri/).className).toMatch(/min-h-touch-target/)
})

test('actiunea are contur in repaus si randul primeste fundal la hover', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const r = rand('Audit Antrenor', 'Înot — audit UI')
  expect(within(r).getByRole('button', { name: 'Dezactivează' }).className).toMatch(/\bborder\b/)
  expect(r.className).toMatch(/hover:bg-accent/)
})

test('locatia apare sub numele cursului, deci doua cursuri omonime nu arata identic', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const locatii = ['Club Audit Motion', 'Audit Antrenor'].map(
    (nume) => within(tabelDin(nume)).getByText('Înot — audit UI').nextElementSibling?.textContent,
  )
  expect(locatii).toEqual(['Bazin Audit Motion', 'Bazin Olimpic Timișoara'])
})

test('pretul e aliniat la dreapta si statusul ramane badge', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()

  const tabel = tabelDin('Audit Antrenor')
  const antetPret = within(tabel)
    .getAllByRole('columnheader')
    .find((th) => th.textContent === 'Preț')!
  expect(antetPret.className).toMatch(/text-right/)
  expect(rand('Audit Antrenor', 'Înot — audit UI').cells[3].className).toMatch(/text-right/)
  expect(within(tabel).getByText('Activ').getAttribute('data-slot')).toBe('badge')
})

test('o comutare reusita confirma cu numele cursului', async () => {
  mockedCourses.mockResolvedValue(lista())
  mockedToggle.mockResolvedValue(undefined as never)
  renderPage()
  await asteaptaLista()

  await userEvent.click(
    within(rand('Audit Antrenor', 'Înot — audit UI')).getByRole('button', { name: 'Dezactivează' }),
  )

  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Cursul Înot — audit UI a fost dezactivat.'),
  )
  expect(mockedToggle).toHaveBeenCalledWith('2', false)
})

test('o comutare esuata pastreaza eroarea si nu confirma nimic', async () => {
  mockedCourses.mockResolvedValue(lista())
  mockedToggle.mockRejectedValue(new Error('500'))
  renderPage()
  await asteaptaLista()

  await userEvent.click(
    within(rand('Audit Antrenor', 'Înot — audit UI')).getByRole('button', { name: 'Dezactivează' }),
  )

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nu am putut actualiza cursul.'))
  expect(toast.success).not.toHaveBeenCalled()
})

test('antetul si randurile primesc actiuni suplimentare din afara', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage({
    headerActions: <button type="button">Curs nou</button>,
    renderRowActions: (c, layout) => (
      <button type="button">
        Editează {c.id} {layout}
      </button>
    ),
  })
  await asteaptaLista()

  expect(screen.getByRole('button', { name: 'Curs nou' })).toBeInTheDocument()
  const r = rand('Audit Antrenor', 'Înot — audit UI')
  expect(within(r).getByRole('button', { name: 'Editează 2 table' })).toBeInTheDocument()
  expect(
    within(fiseDin('Audit Antrenor')).getByRole('button', { name: 'Editează 2 card' }),
  ).toBeInTheDocument()
})

test('„Curs nou" și „Editează" din admin duc la formularele de curs', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage({
    headerActions: <NewCourseButton />,
    renderRowActions: (course, layout) => <EditCourseAction course={course} layout={layout} />,
  })
  await asteaptaLista()

  expect(screen.getByRole('link', { name: 'Curs nou' })).toHaveAttribute(
    'href',
    '/admin/courses/new',
  )
  const dinTabel = within(rand('Audit Antrenor', 'Înot — audit UI')).getByRole('link', {
    name: 'Editează Înot — audit UI',
  })
  expect(dinTabel).toHaveAttribute('href', '/admin/courses/2/edit')
  expect(dinTabel.className).toMatch(/size-touch-target/)
  expect(dinTabel.className).toMatch(/lg:size-8/)
  expect(within(dinTabel).getByText('Editează').className).toMatch(/hidden xl:inline/)
  const dinFisa = within(fiseDin('Audit Antrenor')).getByRole('link', {
    name: 'Editează Înot — audit UI',
  })
  expect(dinFisa).toHaveAttribute('href', '/admin/courses/2/edit')
  expect(dinFisa.className).not.toMatch(/lg:min-h-8/)
})

test('pe telefon sportul se alege dintr-o lista, iar starile stau pe un singur rand', async () => {
  mockedCourses.mockResolvedValue(lista())
  renderPage()
  await asteaptaLista()
  await userEvent.click(pastila(/^Toate\s*3/))

  expect(screen.getByRole('group', { name: 'Status' }).className).toMatch(/overflow-x-auto/)
  expect(screen.getByRole('group', { name: 'Sport' }).className).toMatch(/hidden.*md:flex/)
  const select = screen.getByRole('combobox', { name: 'Sport' })
  expect(select.closest('div')!.className).toMatch(/md:hidden/)

  await userEvent.selectOptions(select, 'alergare')
  expect(screen.queryByText('Înot — audit UI')).not.toBeInTheDocument()
  expect(pastila(/^Alergare/)).toHaveAttribute('aria-pressed', 'true')
})
