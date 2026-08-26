import { vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import ClubAnnouncementsPage from './ClubAnnouncementsPage'
import {
  createClubAnnouncement,
  deleteClubAnnouncement,
  getClubAnnouncements,
  getMyClub,
  setAnnouncementActive,
} from '@/api/club'
import { toast } from 'sonner'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubAnnouncements: vi.fn(),
  createClubAnnouncement: vi.fn(),
  setAnnouncementActive: vi.fn(),
  deleteClubAnnouncement: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedClub = vi.mocked(getMyClub)
const mockedLista = vi.mocked(getClubAnnouncements)
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
) => ({ id, title, content, priority, is_active, created_at })

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
  mockedCreeaza.mockResolvedValue(undefined as never)
  mockedComuta.mockResolvedValue(undefined as never)
  mockedSterge.mockResolvedValue(undefined as never)
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
test('fiecare anunț își arată data publicării', async () => {
  renderPage()
  await screen.findByText('Cantonament de vară')
  expect(screen.getAllByText('26 august 2026').length).toBeGreaterThan(0)
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
