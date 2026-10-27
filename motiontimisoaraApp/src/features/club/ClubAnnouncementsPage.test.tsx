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
import { stergeFisiereleAnuntului } from '@/api/attachments'
import { toast } from 'sonner'
vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubAnnouncements: vi.fn(),
  getClubAudiences: vi.fn(),
  createClubAnnouncement: vi.fn(),
  setAnnouncementActive: vi.fn(),
  deleteClubAnnouncement: vi.fn(),
}))
vi.mock('@/api/attachments', () => ({
  getAtasamente: vi.fn(async () => ({})),
  incarcaAtasamente: vi.fn(async () => []),
  stergeFisiereleAnuntului: vi.fn(async () => undefined),
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
const TABARA = { kind: 'CAMP' as const, id: 'tabara-1', name: 'Tabără de vară', active: true }
const CURS_OPRIT = { kind: 'COURSE' as const, id: 'curs-vechi', name: 'Schi 2025', active: false }
async function confirmaStergerea(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Șterge' }))
}
async function deschideFormularul(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Anunț nou' }))
}
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
  mockedTinte.mockResolvedValue([CURS, ACTIVITATE, TABARA, CURS_OPRIT] as never)
  mockedCreeaza.mockResolvedValue({ id: 'nou', publish_at: null, expires_at: null } as never)
  mockedComuta.mockResolvedValue(undefined as never)
  mockedSterge.mockResolvedValue(undefined as never)
})
test('formularul oferă tot clubul, cursurile și activitățile active', async () => {
  const user = userEvent.setup()
  renderPage()
  await deschideFormularul(user)
  await screen.findByRole('option', { name: 'Înot începători' })
  const select = screen.getByLabelText('Cine primește')
  const optiuni = [...select.querySelectorAll('option')].map((o) => o.textContent)
  expect(optiuni).toContain('Toți părinții clubului')
  expect(optiuni).toContain('Înot începători')
  expect(optiuni).toContain('Cros de toamnă')
  expect(optiuni).toContain('Tabără de vară')
  expect(optiuni).not.toContain('Schi 2025')
  expect([...select.querySelectorAll('optgroup')].map((g) => g.getAttribute('label'))).toEqual([
    'Cursuri',
    'Activități',
    'Tabere',
  ])
})
test('publicarea către un curs trimite ținta la server', async () => {
  const user = userEvent.setup()
  renderPage()
  await deschideFormularul(user)
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
  await deschideFormularul(user)
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
test('publicarea către o tabără trimite ținta la server', async () => {
  const user = userEvent.setup()
  renderPage()
  await deschideFormularul(user)
  await screen.findByLabelText('Cine primește')
  await user.type(screen.getByLabelText('Titlu'), 'Detalii de plecare')
  await user.type(screen.getByLabelText('Conținut'), 'Ne vedem la ora opt.')
  await user.selectOptions(screen.getByLabelText('Cine primește'), 'CAMP:tabara-1')
  await user.click(screen.getByRole('button', { name: 'Publică' }))
  await waitFor(() =>
    expect(mockedCreeaza).toHaveBeenCalledWith(
      expect.objectContaining({ audience_kind: 'CAMP', audience_id: 'tabara-1' }),
    ),
  )
})
test('după publicare ținta revine la tot clubul', async () => {
  const user = userEvent.setup()
  renderPage()
  await deschideFormularul(user)
  await screen.findByLabelText('Cine primește')
  await user.type(screen.getByLabelText('Titlu'), 'Doar pentru înot')
  await user.type(screen.getByLabelText('Conținut'), 'Vineri nu avem ședință.')
  await user.selectOptions(screen.getByLabelText('Cine primește'), 'COURSE:curs-1')
  await user.click(screen.getByRole('button', { name: 'Publică' }))
  await waitFor(() => expect(screen.queryByLabelText('Cine primește')).not.toBeInTheDocument())
  await deschideFormularul(user)
  expect(screen.getByLabelText('Cine primește')).toHaveValue('CLUB')
})
test('fiecare card spune cui i-a fost trimis anunțul', async () => {
  mockedLista.mockResolvedValue([
    anunt('a', 'Către tot clubul'),
    anunt('b', 'Către curs', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'COURSE', 'curs-1'),
    anunt(
      'c',
      'Către activitate',
      true,
      'x',
      'NORMAL',
      '2026-08-26T09:00:00Z',
      'ACTIVITY',
      'act-1',
    ),
    anunt('d', 'Către tabără', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'CAMP', 'tabara-1'),
  ] as never)
  renderPage()
  await screen.findByText('Către tot clubul')
  expect(screen.getByText('Trimis către: Toți părinții clubului')).toBeInTheDocument()
  expect(screen.getByText('Trimis către: Curs: Înot începători')).toBeInTheDocument()
  expect(screen.getByText('Trimis către: Activitate: Cros de toamnă')).toBeInTheDocument()
  expect(screen.getByText('Trimis către: Tabără: Tabără de vară')).toBeInTheDocument()
})
test('eticheta se rezolvă și pentru o țintă oprită între timp', async () => {
  mockedLista.mockResolvedValue([
    anunt('a', 'Vechi', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'COURSE', 'curs-vechi'),
  ] as never)
  renderPage()
  await screen.findByText('Vechi')
  expect(screen.getByText('Trimis către: Curs: Schi 2025')).toBeInTheDocument()
})
test('filtrul restrânge lista la ținta aleasă și spune câte a lăsat', async () => {
  const user = userEvent.setup()
  mockedLista.mockResolvedValue([
    anunt('a', 'Către tot clubul'),
    anunt('b', 'Către curs', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'COURSE', 'curs-1'),
  ] as never)
  renderPage()
  await screen.findByText('Către tot clubul')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Către' }), 'COURSE:curs-1')
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
  await user.type(screen.getByRole('searchbox'), 'nimic de găsit')
  expect(screen.getByText('Niciun anunț pentru filtrele alese.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun anunț încă.')).not.toBeInTheDocument()
})
test('filtrul nu apare pentru un singur anunț', async () => {
  mockedLista.mockResolvedValue([anunt('a', 'Singurul')] as never)
  renderPage()
  await screen.findByText('Singurul')
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
})
test('când filtrul dispare, anunțul rămas se vede totuși', async () => {
  const user = userEvent.setup()
  mockedLista.mockResolvedValue([
    anunt('a', 'Către tot clubul'),
    anunt('b', 'Către curs', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'COURSE', 'curs-1'),
  ] as never)
  const { rerender } = renderPage()
  await screen.findByText('Către tot clubul')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Către' }), 'COURSE:curs-1')
  expect(screen.queryByText('Către tot clubul')).not.toBeInTheDocument()
  mockedLista.mockResolvedValue([anunt('a', 'Către tot clubul')] as never)
  rerender(<div />)
  renderPage()
  expect(await screen.findByText('Către tot clubul')).toBeInTheDocument()
  expect(screen.queryByText('Niciun anunț pentru filtrele alese.')).not.toBeInTheDocument()
})
test('dacă țintele nu se pot încărca, eticheta nu minte că ținta a dispărut', async () => {
  mockedTinte.mockRejectedValue(new Error('network'))
  mockedLista.mockResolvedValue([
    anunt('b', 'Către curs', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'COURSE', 'curs-1'),
  ] as never)
  renderPage()
  await screen.findByText('Către curs')
  expect(await screen.findByText(/nu am putut încărca numele/)).toBeInTheDocument()
  expect(screen.queryByText(/indisponibil/)).not.toBeInTheDocument()
})
test('o activitate dispărută are acordul corect în text', async () => {
  mockedLista.mockResolvedValue([
    anunt('a', 'Orfan', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'ACTIVITY', 'disparuta'),
  ] as never)
  renderPage()
  await screen.findByText('Orfan')
  expect(screen.getByText('Trimis către: Activitate indisponibilă')).toBeInTheDocument()
})
test('eticheta nu confundă un curs cu o activitate care are același id', async () => {
  mockedTinte.mockResolvedValue([
    { kind: 'COURSE', id: 'acelasi', name: 'Cursul', active: true },
    { kind: 'ACTIVITY', id: 'acelasi', name: 'Activitatea', active: true },
  ] as never)
  mockedLista.mockResolvedValue([
    anunt(
      'a',
      'Spre activitate',
      true,
      'x',
      'NORMAL',
      '2026-08-26T09:00:00Z',
      'ACTIVITY',
      'acelasi',
    ),
  ] as never)
  renderPage()
  await screen.findByText('Spre activitate')
  expect(screen.getByText('Trimis către: Activitate: Activitatea')).toBeInTheDocument()
})
test('ștergerea cere confirmare care numește anunțul, iar refuzul îl păstrează', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Cantonament de vară')
  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('Ștergi anunțul „Cantonament de vară”?')
  expect(dialog).toHaveTextContent(/dispare definitiv/)
  await user.click(within(dialog).getByRole('button', { name: 'Anulează' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(mockedSterge).not.toHaveBeenCalled()
  expect(screen.getByText('Cantonament de vară')).toBeInTheDocument()
})
test('confirmarea acceptată chiar șterge anunțul', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Cantonament de vară')
  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }))
  await confirmaStergerea(user)
  await waitFor(() => expect(mockedSterge).toHaveBeenCalledWith('a'))
})
test('ștergerea scoate întâi fișierele din bucket, apoi anunțul', async () => {
  const user = userEvent.setup()
  const ordine: string[] = []
  vi.mocked(stergeFisiereleAnuntului).mockImplementation(async () => {
    ordine.push('fisiere')
  })
  mockedSterge.mockImplementation((async () => {
    ordine.push('anunt')
  }) as never)
  renderPage()
  await screen.findByText('Cantonament de vară')
  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }))
  await confirmaStergerea(user)
  await waitFor(() => expect(ordine).toEqual(['fisiere', 'anunt']))
  expect(stergeFisiereleAnuntului).toHaveBeenCalledWith('a')
})
test('ascunderea nu cere confirmare', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Cantonament de vară')
  await user.click(
    screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Cantonament de vară”' }),
  )
  await waitFor(() => expect(mockedComuta).toHaveBeenCalledWith('a', false))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
test('publicarea cu formularul gol spune ce lipsește, pe câmp', async () => {
  const user = userEvent.setup()
  renderPage()
  await deschideFormularul(user)
  await user.click(screen.getByRole('button', { name: 'Publică' }))
  expect(await screen.findByText('Scrie un titlu de cel puțin 2 caractere')).toBeInTheDocument()
  expect(screen.getByText('Scrie conținutul anunțului')).toBeInTheDocument()
  expect(mockedCreeaza).not.toHaveBeenCalled()
})
test('un titlu doar din spații nu trece drept titlu', async () => {
  const user = userEvent.setup()
  renderPage()
  await deschideFormularul(user)
  await user.type(screen.getByLabelText('Titlu'), '   ')
  await user.type(screen.getByLabelText('Conținut'), 'Text destul de lung')
  await user.click(screen.getByRole('button', { name: 'Publică' }))
  expect(await screen.findByText('Scrie un titlu de cel puțin 2 caractere')).toBeInTheDocument()
  expect(mockedCreeaza).not.toHaveBeenCalled()
})
test('publicarea reușită golește formularul și anunță', async () => {
  const user = userEvent.setup()
  renderPage()
  await deschideFormularul(user)
  await user.type(screen.getByLabelText('Titlu'), 'Ședință cu părinții')
  await user.type(screen.getByLabelText('Conținut'), 'Vineri la ora 18.')
  await user.click(screen.getByRole('button', { name: 'Publică' }))
  await waitFor(() =>
    expect(mockedCreeaza).toHaveBeenCalledWith({
      club_id: 'club-1',
      title: 'Ședință cu părinții',
      content: 'Vineri la ora 18.',
      priority: 'NORMAL',
      audience_kind: 'CLUB',
      audience_id: null,
      publish_at: null,
      expires_at: null,
    }),
  )
  await waitFor(() => expect(screen.queryByLabelText('Titlu')).not.toBeInTheDocument())
  expect(toast.success).toHaveBeenCalledWith('Anunț publicat.')
  expect(screen.getByRole('button', { name: 'Anunț nou' })).toBeInTheDocument()
})
test('o încărcare căzută arată eroare cu reîncercare, nu mesajul de listă goală', async () => {
  mockedLista.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca anunțurile.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun anunț încă.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})
test('cât timp se încarcă clubul se vede scheletul, nu mesajul de listă goală', () => {
  mockedClub.mockReturnValue(new Promise(() => {}) as never)
  const { container } = renderPage()
  expect(screen.queryByText('Niciun anunț încă.')).not.toBeInTheDocument()
  expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
})
test('un club fără anunțuri vede mesajul de listă goală și poate scrie primul anunț', async () => {
  const user = userEvent.setup()
  mockedLista.mockResolvedValue([] as never)
  renderPage()
  expect(await screen.findByText('Niciun anunț încă.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Scrie primul anunț' }))
  expect(screen.getByLabelText('Titlu')).toBeInTheDocument()
})
test('un eșec la încărcarea clubului arată eroarea, nu mesajul de listă goală', async () => {
  mockedClub.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca anunțurile.')).toBeInTheDocument()
  expect(screen.queryByText('Niciun anunț încă.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
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
test('butonul de anunț nou apare abia după ce clubul e cunoscut', async () => {
  mockedClub.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  expect(screen.queryByRole('button', { name: 'Anunț nou' })).not.toBeInTheDocument()
})
test('conținutul își păstrează rândurile așa cum le-a scris clubul', async () => {
  mockedLista.mockResolvedValue([
    anunt('a', 'Pe rânduri', true, 'Primul rând.\nAl doilea rând.'),
  ] as never)
  renderPage()
  const text = await screen.findByText(/Primul rând/)
  expect(text.className).toContain('whitespace-pre-wrap')
  expect(text.textContent).toBe('Primul rând.\nAl doilea rând.')
})
test('fiecare anunț își arată data publicării, în română', async () => {
  const asteptata = new Date('2026-08-26T09:00:00Z').toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  renderPage()
  await screen.findByText('Cantonament de vară')
  expect(screen.getAllByText(asteptata).length).toBe(2)
  expect(asteptata).toMatch(/[a-zăâîșț]{3,}/i)
})
test('numele butoanelor spun despre ce anunț e vorba', async () => {
  renderPage()
  await screen.findByText('Cantonament de vară')
  expect(
    screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Cantonament de vară”' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Arată părinților anunțul „Bazinul închis”' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Șterge anunțul „Bazinul închis”' }),
  ).toBeInTheDocument()
})
test('o ascundere refuzată de bază se vede pe ecran', async () => {
  const user = userEvent.setup()
  mockedComuta.mockRejectedValue(new Error('RLS'))
  renderPage()
  await screen.findByText('Cantonament de vară')
  await user.click(
    screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Cantonament de vară”' }),
  )
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Nu am putut schimba vizibilitatea anunțului.'),
  )
})
test('o ștergere refuzată de bază se vede pe ecran', async () => {
  const user = userEvent.setup()
  mockedSterge.mockRejectedValue(new Error('RLS'))
  renderPage()
  await screen.findByText('Cantonament de vară')
  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }))
  await confirmaStergerea(user)
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nu am putut șterge anunțul.'))
})
test('cât timp o ascundere e în curs se blochează doar butonul apăsat', async () => {
  const user = userEvent.setup()
  mockedComuta.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  await screen.findByText('Cantonament de vară')
  await user.click(
    screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Cantonament de vară”' }),
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Cantonament de vară”' }),
    ).toBeDisabled(),
  )
  expect(
    screen.getByRole('button', { name: 'Arată părinților anunțul „Bazinul închis”' }),
  ).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' })).toBeEnabled()
})
test('o apăsare pe alt rând nu redeschide butonul rândului încă în lucru', async () => {
  const user = userEvent.setup()
  mockedComuta.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  await screen.findByText('Cantonament de vară')
  await user.click(
    screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Cantonament de vară”' }),
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Cantonament de vară”' }),
    ).toBeDisabled(),
  )
  await user.click(
    screen.getByRole('button', { name: 'Arată părinților anunțul „Bazinul închis”' }),
  )
  expect(
    screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Cantonament de vară”' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Arată părinților anunțul „Bazinul închis”' }),
  ).toBeDisabled()
  expect(mockedComuta).toHaveBeenCalledTimes(2)
})
test('ștergerea în curs blochează confirmarea și butonul rândului ei', async () => {
  const user = userEvent.setup()
  mockedSterge.mockReturnValue(new Promise(() => {}) as never)
  renderPage()
  await screen.findByText('Cantonament de vară')
  await user.click(screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }))
  await confirmaStergerea(user)
  const dialog = screen.getByRole('alertdialog')
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Șterge' })).toBeDisabled())
  await user.click(within(dialog).getByRole('button', { name: 'Șterge' }))
  expect(mockedSterge).toHaveBeenCalledTimes(1)
  expect(
    screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”', hidden: true }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Șterge anunțul „Bazinul închis”', hidden: true }),
  ).toBeEnabled()
})
test('controalele poartă tiparul de atingere al casei', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Cantonament de vară')
  expect(screen.getByRole('button', { name: 'Anunț nou' }).className).toContain('h-touch-target')
  await deschideFormularul(user)
  const formular = [
    screen.getByLabelText('Titlu'),
    screen.getByLabelText('Cine primește'),
    screen.getByLabelText('Prioritate'),
    screen.getByRole('button', { name: 'Adaugă poze sau filmare' }),
    screen.getByRole('button', { name: 'Publică' }),
  ]
  for (const c of formular) expect(c.className).toContain('h-touch-target')
  for (const c of formular.slice(0, 3)) expect(c.className).not.toContain('md:text-sm')
  const lista = [
    screen.getByRole('button', { name: 'Ascunde de părinți anunțul „Cantonament de vară”' }),
    screen.getByRole('button', { name: 'Șterge anunțul „Cantonament de vară”' }),
  ]
  for (const c of lista) expect(c.className).toContain('h-11')
})
test('mesajul de lipsă e legat de câmpul lui', async () => {
  const user = userEvent.setup()
  renderPage()
  await deschideFormularul(user)
  await user.click(screen.getByRole('button', { name: 'Publică' }))
  const titlu = await screen.findByLabelText('Titlu')
  const idMesaj = titlu.getAttribute('aria-describedby')
  expect(idMesaj).toBeTruthy()
  expect(document.getElementById(idMesaj!)?.textContent).toBe(
    'Scrie un titlu de cel puțin 2 caractere',
  )
  expect(screen.getByLabelText('Conținut').getAttribute('aria-describedby')).toBeTruthy()
})
test('un anunț ascuns spune că nu ajunge la părinți', async () => {
  renderPage()
  await screen.findByText('Bazinul închis')
  expect(screen.getByText(/Părinții nu mai văd acest anunț/)).toBeInTheDocument()
  expect(screen.getAllByText(/Părinții nu mai văd/)).toHaveLength(1)
})
test('antetul arată câte anunțuri are clubul', async () => {
  renderPage()
  await screen.findByText('Cantonament de vară')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('(2)')
})
test('prioritatea rămâne pe card, iar cele ascunse poartă ambele etichete', async () => {
  mockedLista.mockResolvedValue([anunt('a', 'Urgent', false, 'Text', 'URGENT')] as never)
  renderPage()
  const card = (await screen.findByRole('listitem')) as HTMLElement
  expect(within(card).getByText('Urgentă')).toBeInTheDocument()
  expect(within(card).getByText('Ascuns')).toBeInTheDocument()
})
test('formularul stă închis până la „Anunț nou”, iar „Renunță” îl închide', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Cantonament de vară')
  expect(screen.queryByLabelText('Titlu')).not.toBeInTheDocument()
  await deschideFormularul(user)
  expect(screen.queryByRole('button', { name: 'Anunț nou' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Renunță' }))
  expect(screen.queryByLabelText('Titlu')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Anunț nou' })).toBeInTheDocument()
})
test('căutarea găsește după text și după numele țintei, fără diacritice', async () => {
  const user = userEvent.setup()
  mockedLista.mockResolvedValue([
    anunt('a', 'Ședință cu părinții', true, 'Joi la ora 18'),
    anunt('b', 'Program nou', true, 'x', 'NORMAL', '2026-08-26T09:00:00Z', 'COURSE', 'curs-1'),
  ] as never)
  renderPage()
  await screen.findByText('Program nou')
  await user.type(screen.getByRole('searchbox'), 'sedinta')
  expect(screen.getByText('Ședință cu părinții')).toBeInTheDocument()
  expect(screen.queryByText('Program nou')).not.toBeInTheDocument()
  await user.clear(screen.getByRole('searchbox'))
  await user.type(screen.getByRole('searchbox'), 'inot')
  expect(screen.getByText('Program nou')).toBeInTheDocument()
  expect(screen.getByText('1 din 2')).toBeInTheDocument()
})
