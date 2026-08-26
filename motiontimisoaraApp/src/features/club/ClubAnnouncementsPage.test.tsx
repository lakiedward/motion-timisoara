import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import ClubAnnouncementsPage from './ClubAnnouncementsPage'
import {
  createClubAnnouncement,
  deleteClubAnnouncement,
  getClubAnnouncements,
  getClubAudiences,
  getMyClub,
  setAnnouncementActive,
} from '@/api/club'
import { toast } from 'sonner'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubAnnouncements: vi.fn(),
  getClubAudiences: vi.fn(),
  createClubAnnouncement: vi.fn(),
  setAnnouncementActive: vi.fn(),
  deleteClubAnnouncement: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedClub = vi.mocked(getMyClub)
const mockedLista = vi.mocked(getClubAnnouncements)
const mockedTinte = vi.mocked(getClubAudiences)
const mockedCreeaza = vi.mocked(createClubAnnouncement)
const mockedComuta = vi.mocked(setAnnouncementActive)
const mockedSterge = vi.mocked(deleteClubAnnouncement)

const anunt = (
  id: string,
  title: string,
  is_active = true,
  content = 'Conținutul anunțului',
  priority = 'NORMAL',
  created_at = '2026-08-26T09:00:00Z',
  audience_kind = 'CLUB',
  audience_id: string | null = null,
) => ({ id, title, content, priority, is_active, created_at, audience_kind, audience_id })

const CURS = { kind: 'COURSE' as const, id: 'curs-1', name: 'Înot începători', active: true }
const ACTIVITATE = { kind: 'ACTIVITY' as const, id: 'act-1', name: 'Cros de toamnă', active: true }
const CURS_OPRIT = { kind: 'COURSE' as const, id: 'curs-vechi', name: 'Schi 2025', active: false }

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ClubAnnouncementsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedClub.mockResolvedValue({ id: 'club-1' } as never)
  mockedLista.mockResolvedValue([
    anunt('a', 'Cantonament de vară'),
    anunt('b', 'Bazinul închis', false),
  ] as never)
  mockedTinte.mockResolvedValue([CURS, ACTIVITATE, CURS_OPRIT] as never)
  mockedCreeaza.mockResolvedValue(undefined as never)
  mockedComuta.mockResolvedValue(undefined as never)
  mockedSterge.mockResolvedValue(undefined as never)
})

// ===== Ținta anunțului =====

test('formularul oferă tot clubul, cursurile și activitățile active', async () => {
  renderPage()
  // Selectul există de la prima randare; țintele vin cu interogarea lor.
  await screen.findByRole('option', { name: 'Înot începători' })
  const select = screen.getByLabelText('Cine primește')
  const optiuni = [...select.querySelectorAll('option')].map((o) => o.textContent)
  expect(optiuni).toContain('Toți părinții clubului')
  expect(optiuni).toContain('Înot începători')
  expect(optiuni).toContain('Cros de toamnă')
  // Un curs oprit nu se mai poate alege pentru un anunț NOU.
  expect(optiuni).not.toContain('Schi 2025')
  // Grupate, ca să nu se amestece cursurile cu activitățile.
  expect([...select.querySelectorAll('optgroup')].map((g) => g.getAttribute('label'))).toEqual([
    'Cursuri',
    'Activități',
  ])
})

test('publicarea către un curs trimite ținta la server', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByLabelText('Cine primește')

  await user.type(screen.getByLabelText('Titlu'), 'Doar pentru înot')
  await user.type(screen.getByLabelText('Conținut'), 'Vineri nu avem ședință.')
  await user.selectOptions(screen.getByLabelText('Cine primește'), 'COURSE:curs-1')
  await user.click(screen.getByRole('button', { name: 'Publică' }))

  await waitFor(() =>
    expect(mockedCreeaza).toHaveBeenCalledWith(
      expect.objectContaining({ audience_kind: 'COURSE', audience_id: 'curs-1' }),
    ),
  )
})

test('publicarea către o activitate trimite ținta la server', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByLabelText('Cine primește')

  await user.type(screen.getByLabelText('Titlu'), 'Doar pentru cros')
  await user.type(screen.getByLabelText('Conținut'), 'Ne vedem la start.')
  await user.selectOptions(screen.getByLabelText('Cine primește'), 'ACTIVITY:act-1')
  await user.click(screen.getByRole('button', { name: 'Publică' }))

  await waitFor(() =>
    expect(mockedCreeaza).toHaveBeenCalledWith(
      expect.objectContaining({ audience_kind: 'ACTIVITY', audience_id: 'act-1' }),
    ),
  )
})

test('după publicare ținta revine la tot clubul', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByLabelText('Cine primește')

  await user.type(screen.getByLabelText('Titlu'), 'Doar pentru înot')
  await user.type(screen.getByLabelText('Conținut'), 'Vineri nu avem ședință.')
  await user.selectOptions(screen.getByLabelText('Cine primește'), 'COURSE:curs-1')
  await user.click(screen.getByRole('button', { name: 'Publică' }))

  await waitFor(() => expect(screen.getByLabelText('Cine primește')).toHaveValue('CLUB'))
})

// Partea „să văd la fiecare ce am trimis”.
test('fiecare card spune cui i-a fost trimis anunțul', async () => {
  mockedLista.mockResolvedValue([
    anunt('a', 'Către tot clubul'),
    anunt('b', 'Către curs', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'COURSE', 'curs-1'),
    anunt('c', 'Către activitate', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'ACTIVITY', 'act-1'),
  ] as never)
  renderPage()
  await screen.findByText('Către tot clubul')
  expect(screen.getByText('Trimis către: Toți părinții clubului')).toBeInTheDocument()
  expect(screen.getByText('Trimis către: Curs: Înot începători')).toBeInTheDocument()
  expect(screen.getByText('Trimis către: Activitate: Cros de toamnă')).toBeInTheDocument()
})

// Un anunț vechi trimis la un curs oprit între timp trebuie să-și păstreze eticheta.
test('eticheta se rezolvă și pentru o țintă oprită între timp', async () => {
  mockedLista.mockResolvedValue([
    anunt('a', 'Vechi', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'COURSE', 'curs-vechi'),
  ] as never)
  renderPage()
  await screen.findByText('Vechi')
  expect(screen.getByText('Trimis către: Curs: Schi 2025')).toBeInTheDocument()
})

// `activities_select` nu are clauză de club, deci o activitate dezactivată nu se
// mai citește — eticheta ei trebuie să spună asta, nu să rămână goală.
test('o țintă care nu se mai poate citi are text de rezervă', async () => {
  mockedLista.mockResolvedValue([
    anunt('a', 'Orfan', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'ACTIVITY', 'disparuta'),
  ] as never)
  renderPage()
  await screen.findByText('Orfan')
  expect(screen.getByText('Trimis către: Activitate indisponibil')).toBeInTheDocument()
})

test('filtrul restrânge lista la ținta aleasă și spune câte a lăsat', async () => {
  const user = userEvent.setup()
  mockedLista.mockResolvedValue([
    anunt('a', 'Către tot clubul'),
    anunt('b', 'Către curs', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'COURSE', 'curs-1'),
  ] as never)
  renderPage()
  await screen.findByText('Către tot clubul')

  await user.selectOptions(screen.getByLabelText('Arată'), 'COURSE:curs-1')

  expect(screen.getByText('Către curs')).toBeInTheDocument()
  expect(screen.queryByText('Către tot clubul')).not.toBeInTheDocument()
  expect(screen.getByText('1 din 2')).toBeInTheDocument()
})

test('un filtru fără potriviri nu arată mesajul de listă goală', async () => {
  const user = userEvent.setup()
  mockedLista.mockResolvedValue([
    anunt('a', 'Către tot clubul'),
    anunt('b', 'Tot către club'),
  ] as never)
  renderPage()
  await screen.findByText('Către tot clubul')

  await user.selectOptions(screen.getByLabelText('Arată'), 'COURSE:curs-1')

  expect(screen.getByText('Niciun anunț către ținta aleasă.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun anunț încă.')).not.toBeInTheDocument()
})

test('filtrul nu apare pentru un singur anunț', async () => {
  mockedLista.mockResolvedValue([anunt('a', 'Singurul')] as never)
  renderPage()
  await screen.findByText('Singurul')
  expect(screen.queryByLabelText('Arată')).not.toBeInTheDocument()
})

// Criteriul 1: ștergerea e definitivă și pleca la o singură apăsare, fără nicio
// întrebare, deși în aceeași aplicație ștergerea unui copil, a unui sport și
// eliminarea unui antrenor cer toate confirmare.
test('ștergerea cere confirmare care numește anunțul, iar refuzul îl păstrează', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
  renderPage()
  await screen.findByText('Cantonament de vară')

  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }))

  expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Cantonament de vară'))
  expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('ireversibilă'))
  expect(mockedSterge).not.toHaveBeenCalled()
  confirmSpy.mockRestore()
})

test('confirmarea acceptată chiar șterge anunțul', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderPage()
  await screen.findByText('Cantonament de vară')

  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }))
  await waitFor(() => expect(mockedSterge).toHaveBeenCalledWith('a'))
  confirmSpy.mockRestore()
})

// Ascunderea se poate desface dintr-o apăsare, deci nu-l punem pe club să confirme.
test('ascunderea nu cere confirmare', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm')
  renderPage()
  await screen.findByText('Cantonament de vară')

  await user.click(screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' }))
  await waitFor(() => expect(mockedComuta).toHaveBeenCalledWith('a', false))
  expect(confirmSpy).not.toHaveBeenCalled()
  confirmSpy.mockRestore()
})

// Criteriul 2: apăsarea pe „Publică” cu formularul gol nu producea absolut nimic
// — verificarea lungimii se făcea în tăcere, iar funcția ieșea fără să spună.
test('publicarea cu formularul gol spune ce lipsește, pe câmp', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: 'Publică' }))

  expect(await screen.findByText('Scrie un titlu de cel puțin 2 caractere')).toBeInTheDocument()
  expect(screen.getByText('Scrie conținutul anunțului')).toBeInTheDocument()
  expect(mockedCreeaza).not.toHaveBeenCalled()
})

test('un titlu doar din spații nu trece drept titlu', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText('Titlu'), '   ')
  await user.type(screen.getByLabelText('Conținut'), 'Text destul de lung')
  await user.click(screen.getByRole('button', { name: 'Publică' }))

  expect(await screen.findByText('Scrie un titlu de cel puțin 2 caractere')).toBeInTheDocument()
  expect(mockedCreeaza).not.toHaveBeenCalled()
})

// Criteriul 14 (DE PĂSTRAT): după publicare formularul se golește și apare toastul.
test('publicarea reușită golește formularul și anunță', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText('Titlu'), 'Ședință cu părinții')
  await user.type(screen.getByLabelText('Conținut'), 'Vineri la ora 18.')
  await user.click(screen.getByRole('button', { name: 'Publică' }))

  await waitFor(() =>
    expect(mockedCreeaza).toHaveBeenCalledWith({
      club_id: 'club-1',
      title: 'Ședință cu părinții',
      content: 'Vineri la ora 18.',
      priority: 'NORMAL',
      // Implicit anunțul merge la tot clubul, nu la un curs anume.
      audience_kind: 'CLUB',
      audience_id: null,
    }),
  )
  await waitFor(() => expect(screen.getByLabelText('Titlu')).toHaveValue(''))
  expect(toast.success).toHaveBeenCalledWith('Anunț publicat.')
})

// Criteriul 3: orice eșec ducea la „Niciun anunț încă.”, deci un club care ARE
// anunțuri era invitat să scrie primul.
test('o încărcare căzută arată eroare cu reîncercare, nu mesajul de listă goală', async () => {
  mockedLista.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca anunțurile.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun anunț încă.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

// Criteriul 4: cât timp se încarcă clubul interogarea e oprită, deci `isLoading`
// e fals și ecranul clipea cu mesajul de listă goală.
test('cât timp se încarcă clubul se vede scheletul, nu mesajul de listă goală', () => {
  mockedClub.mockReturnValue(new Promise(() => {}) as never)
  const { container } = renderPage()
  expect(screen.queryByText('Niciun anunț încă.')).not.toBeInTheDocument()
  expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
})

test('un club fără anunțuri vede mesajul de listă goală', async () => {
  mockedLista.mockResolvedValue([] as never)
  renderPage()
  expect(await screen.findByText('Niciun anunț încă.')).toBeInTheDocument()
})

// Regresie găsită la revizuire: `isError` venea DOAR de pe interogarea de
// anunțuri. Când pică `getMyClub`, `isPending` devine fals, `clubId` rămâne gol,
// deci interogarea anunțurilor stă oprită — iar o interogare oprită are
// `isLoading` fals ȘI `isError` fals. Cascada cădea pe ultima ramură, adică pe
// exact mesajul pe care criteriul 3 îl interzice la eșec, fără cale de întoarcere.
test('un eșec la încărcarea clubului arată eroarea, nu mesajul de listă goală', async () => {
  mockedClub.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca anunțurile.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun anunț încă.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
  // Interogarea anunțurilor nici măcar nu pleacă fără club.
  expect(mockedLista).not.toHaveBeenCalled()
})

test('butonul de reîncercare chiar cere din nou datele', async () => {
  const user = userEvent.setup()
  mockedLista.mockRejectedValue(new Error('network'))
  renderPage()
  await screen.findByText('Nu am putut încărca anunțurile.')
  const inainte = mockedLista.mock.calls.length

  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(mockedLista.mock.calls.length).toBeGreaterThan(inainte))
})

test('un cont de club fără club asociat nu e invitat să scrie primul anunț', async () => {
  mockedClub.mockResolvedValue(null as never)
  renderPage()
  expect(await screen.findByText('Niciun club asociat contului.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun anunț încă.')).not.toBeInTheDocument()
})

// Regresie față de codul vechi, care avea garda `&& clubId` în onSubmit: fără ea
// publicarea pleca cu club_id gol dacă omul apuca să scrie înainte de răspuns.
test('publicarea e blocată cât timp clubul nu e cunoscut', () => {
  mockedClub.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  expect(screen.getByRole('button', { name: 'Publică' })).toBeDisabled()
})

// Criteriul 5: textul era randat cu white-space normal, deci un anunț scris pe
// trei rânduri se citea ca un bloc continuu.
test('conținutul își păstrează rândurile așa cum le-a scris clubul', async () => {
  mockedLista.mockResolvedValue([
    anunt('a', 'Pe rânduri', true, 'Primul rând.\nAl doilea rând.'),
  ] as never)
  renderPage()
  const text = await screen.findByText(/Primul rând/)
  expect(text.className).toContain('whitespace-pre-wrap')
  expect(text.textContent).toBe('Primul rând.\nAl doilea rând.')
})

// Criteriul 6: cardul arăta titlu, prioritate și conținut, dar nicăieri data.
// Data așteptată se calculează cu același formatter, ca testul să nu pice pe un
// runner dintr-un fus în care 09:00 UTC cade în ziua precedentă.
test('fiecare anunț își arată data publicării, în română', async () => {
  const asteptata = new Date('2026-08-26T09:00:00Z').toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  renderPage()
  await screen.findByText('Cantonament de vară')
  expect(screen.getAllByText(asteptata).length).toBe(2)
  // Format lung, nu 26.08.2026: luna scrisă în litere.
  expect(asteptata).toMatch(/[a-zăâîșț]{3,}/i)
})

// Criteriul 7: un cititor de ecran auzea N butoane identice „Ascunde” și N
// identice „Șterge”, fără să poată spune pe care anunț cade apăsarea.
test('numele butoanelor spun despre ce anunț e vorba', async () => {
  renderPage()
  await screen.findByText('Cantonament de vară')
  expect(
    screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Afișează anunțul „Bazinul închis”' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Șterge anunțul „Bazinul închis”' })).toBeInTheDocument()
})

// Criteriul 9: cele două mutații nu aveau tratare de eroare, deci un refuz al
// bazei pleca în tăcere și ecranul rămânea neschimbat, ca după o reușită.
test('o ascundere refuzată de bază se vede pe ecran', async () => {
  const user = userEvent.setup()
  mockedComuta.mockRejectedValue(new Error('RLS'))
  renderPage()
  await screen.findByText('Cantonament de vară')

  await user.click(screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Nu am putut schimba vizibilitatea anunțului.'),
  )
})

test('o ștergere refuzată de bază se vede pe ecran', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  mockedSterge.mockRejectedValue(new Error('RLS'))
  renderPage()
  await screen.findByText('Cantonament de vară')

  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nu am putut șterge anunțul.'))
  confirmSpy.mockRestore()
})

// Criteriul 10: niciun buton nu se dezactiva, deci două apăsări repezi trimiteau
// două cereri; iar starea de așteptare e comună întregii mutații, deci fără
// verificarea pe id s-ar fi blocat butoanele tuturor anunțurilor.
test('cât timp o ascundere e în curs se blochează doar butonul apăsat', async () => {
  const user = userEvent.setup()
  mockedComuta.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  await screen.findByText('Cantonament de vară')

  await user.click(screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' })).toBeDisabled(),
  )
  expect(screen.getByRole('button', { name: 'Afișează anunțul „Bazinul închis”' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' })).toBeEnabled()
})

// Regresie găsită la revizuire: garda era `toggle.variables?.id === a.id`, dar
// mutația e UNA singură pentru toată lista, iar `variables` păstrează doar
// argumentele ULTIMULUI `mutate`. O a doua apăsare pe alt rând muta reperul și
// redeschidea butonul primului rând cât timp cererea lui era încă în zbor.
test('o apăsare pe alt rând nu redeschide butonul rândului încă în lucru', async () => {
  const user = userEvent.setup()
  mockedComuta.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  await screen.findByText('Cantonament de vară')

  await user.click(screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' })).toBeDisabled(),
  )

  await user.click(screen.getByRole('button', { name: 'Afișează anunțul „Bazinul închis”' }))

  // Prima cerere e tot în zbor, deci butonul ei rămâne închis.
  expect(
    screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' }),
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Afișează anunțul „Bazinul închis”' })).toBeDisabled()
  expect(mockedComuta).toHaveBeenCalledTimes(2)
})

test('ștergerea blochează doar butonul rândului ei, și rămâne blocat', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  mockedSterge.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  await screen.findByText('Cantonament de vară')

  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' })).toBeDisabled(),
  )
  expect(screen.getByRole('button', { name: 'Șterge anunțul „Bazinul închis”' })).toBeEnabled()
  // Ascunderea aceluiași rând rămâne liberă: criteriul cere să se blocheze
  // butonul apăsat, nu tot rândul.
  expect(screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Bazinul închis”' }))
  expect(
    screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }),
  ).toBeDisabled()
  expect(mockedSterge).toHaveBeenCalledTimes(2)
  confirmSpy.mockRestore()
})

// Criteriul 8: singurul lucru verificabil în jsdom e că tiparul casei ajunge pe
// controale — înălțimile reale au fost măsurate în browser, pe cele trei
// viewporturi. Fără asta, scoaterea lui `h-11` ar trece neobservată de suită.
test('controalele poartă tiparul de atingere al casei', async () => {
  renderPage()
  await screen.findByText('Cantonament de vară')
  const controale = [
    screen.getByLabelText('Titlu'),
    screen.getByLabelText('Prioritate'),
    screen.getByRole('button', { name: 'Publică' }),
    screen.getByRole('button', { name: 'Ascunde anunțul „Cantonament de vară”' }),
    screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }),
  ]
  for (const c of controale) expect(c.className).toContain('h-11')
})

// Criteriul 2 cere mesajul „pe câmpul respectiv”: un banner global deasupra
// formularului ar conține aceleași cuvinte, dar nu ar lega mesajul de câmp.
test('mesajul de lipsă e legat de câmpul lui', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole('button', { name: 'Publică' }))
  const titlu = await screen.findByLabelText('Titlu')

  const idMesaj = titlu.getAttribute('aria-describedby')
  expect(idMesaj).toBeTruthy()
  expect(document.getElementById(idMesaj!)?.textContent).toBe(
    'Scrie un titlu de cel puțin 2 caractere',
  )
  expect(screen.getByLabelText('Conținut').getAttribute('aria-describedby')).toBeTruthy()
})

// Criteriul 11: badge-ul „Ascuns” nu explica pentru cine dispare anunțul.
test('un anunț ascuns spune că nu ajunge la părinți', async () => {
  renderPage()
  await screen.findByText('Bazinul închis')
  expect(screen.getByText('Ascuns — nu ajunge la părinți.')).toBeInTheDocument()
  // Cel afișat nu poartă explicația, ca să nu sune ca un avertisment general.
  expect(screen.getAllByText(/nu ajunge la părinți/)).toHaveLength(1)
})

// Criteriul 12: titlul era doar „Anunțuri”, fără număr.
test('antetul arată câte anunțuri are clubul', async () => {
  renderPage()
  await screen.findByText('Cantonament de vară')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('(2)')
})

// Criteriul 13 (DE PĂSTRAT): prioritatea rămâne vizibilă, cu cele patru trepte.
test('prioritatea rămâne pe card, iar cele ascunse poartă ambele etichete', async () => {
  mockedLista.mockResolvedValue([anunt('a', 'Urgent', false, 'Text', 'URGENT')] as never)
  renderPage()
  // Restrâns la card: „Urgentă” e și una dintre opțiunile selectului din formular.
  const card = (await screen.findByRole('listitem')) as HTMLElement
  expect(within(card).getByText('Urgentă')).toBeInTheDocument()
  expect(within(card).getByText('Ascuns')).toBeInTheDocument()
})
