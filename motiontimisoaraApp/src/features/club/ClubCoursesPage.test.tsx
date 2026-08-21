import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { toast } from 'sonner'

import ClubCoursesPage from './ClubCoursesPage'
import { getClubCourses, getMyClub, setClubCourseActive, type ClubCourse } from '@/api/club'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubCourses: vi.fn(),
  setClubCourseActive: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedClub = vi.mocked(getMyClub)
const mockedCourses = vi.mocked(getClubCourses)
const mockedToggle = vi.mocked(setClubCourseActive)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ClubCoursesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function curs(over: Partial<ClubCourse> & { id: string; name: string }): ClubCourse {
  return {
    price: 48000,
    active: true,
    age_from: 8,
    age_to: 13,
    sport: { id: 's1', name: 'Atletism' },
    location: { id: 'l1', name: 'Stadion Atletism' },
    coach: { id: 'c1', name: 'Audit Antrenor' },
    ...over,
  } as ClubCourse
}

/** Două cursuri cu același nume, care se deosebesc doar prin locație. */
const omonime = (): ClubCourse[] => [
  curs({ id: '1', name: 'Înot — audit UI', location: { id: 'l1', name: 'Bazin Olimpic Timișoara' } }),
  curs({ id: '2', name: 'Înot — audit UI', location: { id: 'l2', name: 'Bazin Audit Motion' } }),
]

beforeEach(() => {
  vi.clearAllMocks()
  mockedClub.mockResolvedValue({ id: 'club-1', name: 'UI Audit Club TM' } as never)
})

// --- Criteriul 1: pe telefon butonul coboară pe rândul lui ---
test('antetul stivuiește „Curs nou” sub titlu până la 640 px și îl readuce alături de la sm', async () => {
  mockedCourses.mockResolvedValue([])
  const { container } = renderPage()
  await screen.findByText(/Niciun curs încă/)
  const antet = container.querySelector('h1')!.parentElement!
  expect(antet.className).toMatch(/flex-col/)
  expect(antet.className).toMatch(/sm:flex-row/)
  // La 375 px titlul și butonul stăteau la 6 px unul de altul.
  expect(antet.className).not.toMatch(/^\s*flex items-center justify-between\s*$/)
})

// --- Criteriul 2: locația deosebește cursurile omonime, din zona titlului ---
test('locația apare în zona titlului, deci două cursuri omonime nu mai arată identic', async () => {
  mockedCourses.mockResolvedValue(omonime())
  renderPage()
  const titluri = await screen.findAllByText('Înot — audit UI')
  const zone = titluri.map((t) => t.nextElementSibling?.textContent)
  expect(zone).toEqual(['Bazin Olimpic Timișoara', 'Bazin Audit Motion'])
  expect(new Set(zone).size).toBe(2)
})

// --- Criteriul 7: locația nu se repetă; linia gri păstrează antrenorul ---
test('linia gri are antrenorul și vârsta, iar locația apare o singură dată pe card', async () => {
  mockedCourses.mockResolvedValue([curs({ id: '1', name: 'Atletism juniori' })])
  renderPage()
  const card = (await screen.findByText('Atletism juniori')).closest('div.bg-card') as HTMLElement
  expect(within(card).getByText(/Audit Antrenor · 8–13 ani/)).toBeInTheDocument()
  const aparitii = card.textContent!.split('Stadion Atletism').length - 1
  expect(aparitii).toBe(1)
})

// --- Criteriul 4: eroarea nu mai arată ca lista goală ---
test('eșecul încărcării are mesaj propriu și „Reîncearcă”, fără textul de listă goală', async () => {
  mockedCourses.mockRejectedValue(new Error('500'))
  renderPage()
  const alerta = await screen.findByRole('alert')
  expect(within(alerta).getByText('Nu am putut încărca cursurile.')).toBeInTheDocument()
  expect(within(alerta).getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  expect(screen.queryByText(/Niciun curs încă/)).not.toBeInTheDocument()
  // Titlul și acțiunea principală rămân disponibile în starea de eroare.
  expect(screen.getByRole('heading', { name: 'Cursurile clubului' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Curs nou/ })).toBeInTheDocument()
})

// --- Criteriul 8: starea goală rămâne cutia punctată, cu ambele drumuri ---
test('lista goală păstrează cutia punctată și cele două drumuri spre creare', async () => {
  mockedCourses.mockResolvedValue([])
  renderPage()
  expect(await screen.findByText(/Niciun curs încă/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Creează primul curs' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Curs nou/ })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

// --- Criteriul 10: scheletele au înălțimea cardului real ---
test('scheletele de încărcare urmăresc înălțimea cardului real, pe fiecare treaptă', async () => {
  mockedCourses.mockReturnValue(new Promise(() => {}))
  const { container } = renderPage()
  const schelete = await waitFor(() => {
    const found = container.querySelectorAll('[data-slot="skeleton"]')
    expect(found.length).toBeGreaterThanOrEqual(2)
    return found
  })
  // Măsurat în browser: cardul real are 210 px sub 1024 px și 190 px peste.
  // `h-32` dădea 128 px, deci lista sărea cu 42 px când soseau datele.
  schelete.forEach((s) => {
    expect(s.className).toMatch(/(^| )h-52( |$)/)
    expect(s.className).toMatch(/lg:h-48/)
  })
})

// --- Criteriul 11: rândurile grilei sunt egale de la sm în sus, libere pe telefon ---
test('grila egalizează rândurile de la sm în sus, dar lasă telefonul să crească', async () => {
  mockedCourses.mockResolvedValue(omonime())
  const { container } = renderPage()
  await screen.findAllByText('Înot — audit UI')
  const grila = container.querySelector('.grid')!
  expect(grila.className).toMatch(/sm:auto-rows-fr/)
  expect(grila.className).not.toMatch(/(^| )auto-rows-fr/)
})

// --- Criteriul 9: comutarea e tăcută la succes ---
test('comutarea reușită nu afișează niciun mesaj', async () => {
  const user = userEvent.setup()
  mockedCourses.mockResolvedValue([curs({ id: '1', name: 'Atletism juniori', active: false })])
  mockedToggle.mockResolvedValue(undefined)
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Activează' }))
  await waitFor(() => expect(mockedToggle).toHaveBeenCalledWith('1', true))
  expect(toast.success).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()
})

// --- Criteriul 12: refuzul RLS spune de ce ---
test('refuzul pe 42501 spune că antrenorul nu e din club; alte erori rămân generice', async () => {
  const user = userEvent.setup()
  mockedCourses.mockResolvedValue([curs({ id: '1', name: 'Atletism juniori', active: false })])
  mockedToggle.mockRejectedValue({ code: '42501', message: 'permission denied' })
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Activează' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'Nu poți modifica acest curs: antrenorul lui nu face parte din club.',
    ),
  )

  vi.mocked(toast.error).mockClear()
  mockedToggle.mockRejectedValue(new Error('retea picata'))
  await user.click(screen.getByRole('button', { name: 'Activează' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nu am putut actualiza cursul.'))
})
