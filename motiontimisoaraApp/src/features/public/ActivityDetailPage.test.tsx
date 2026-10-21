import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import ActivityDetailPage from './ActivityDetailPage'
import { getActivitateDetaliu, type ActivitateDetaliu } from '@/api/public'

const navigheaza = vi.fn()

vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useNavigate: () => navigheaza, useParams: () => ({ id: 'act-1' }) }
})

vi.mock('@/api/public', async () => {
  const real = await vi.importActual<typeof import('@/api/public')>('@/api/public')
  return { ...real, getActivitateDetaliu: vi.fn() }
})

let utilizator: { id: string } | null = null
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: utilizator }) }))

const mocked = vi.mocked(getActivitateDetaliu)

const DETALIU: ActivitateDetaliu = {
  id: 'act-1',
  name: 'DEMO — Atelier de ciclism',
  description: 'Atelier de mecanică și traseu scurt.',
  activityDate: '2099-09-26',
  startTime: '10:00:00',
  endTime: '12:00:00',
  price: 2000,
  currency: 'EUR',
  eur_ron_rate_micros: 5_100_000,
  bandUrl: null,
  photoUrl: 'https://public/sport-photos/ciclism.jpg',
  sport: { code: 'ciclism', name: 'Ciclism' },
  location: {
    id: 'loc-1',
    name: 'DEMO — Parc de antrenament',
    address: 'Str. Exemplu 1',
    lat: 45.751,
    lng: 21.238,
  },
  organizator: {
    fel: 'club',
    id: 'club-1',
    nume: 'DEMO — Club Sportiv Motion',
    link: '/cluburi/club-1',
    pozaUrl: null,
  },
  antrenori: [
    {
      id: 'coach-1',
      nume: 'Antrenor Demo',
      link: '/antrenori/coach-1',
      pozaUrl: 'https://public/coach-photos/demo.jpg',
    },
  ],
  galerieUrls: ['https://public/sport-photos/ciclism.jpg'],
  locuriRamase: 11,
  regulament: {
    rules_file_storage_path: null,
    rules_file_name: null,
    rules_file_content_type: null,
    rules_file_size_bytes: null,
  },
}

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ActivityDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  utilizator = null
  mocked.mockResolvedValue(DETALIU)
})

test('cât se încarcă, stă o singură formă înaltă', async () => {
  mocked.mockReturnValue(new Promise(() => {}))
  deseneaza()
  await waitFor(() => {
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(1)
  })
  expect(document.querySelector('.h-64')).toBeInTheDocument()
})

test('încărcarea eșuată are Reîncearcă și nu spune că activitatea lipsește', async () => {
  const user = userEvent.setup()
  mocked.mockRejectedValueOnce(new Error('retea')).mockResolvedValueOnce(DETALIU)
  deseneaza()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca activitatea.')
  expect(screen.queryByText('Activitatea nu a fost găsită.')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
    'DEMO — Atelier de ciclism',
  )
})

test('un id lipsă rămâne „nu a fost găsită”, cu linkul înapoi', async () => {
  mocked.mockResolvedValue(null)
  deseneaza()
  expect(await screen.findByText('Activitatea nu a fost găsită.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Înapoi la activități/ })).toHaveAttribute(
    'href',
    '/activitati',
  )
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
})

test('fără poza activității, pagina nu pune degradeul gol, iar titlul stă sub link', async () => {
  deseneaza()
  const titlu = await screen.findByRole('heading', { level: 1, name: 'DEMO — Atelier de ciclism' })
  const link = screen.getByRole('link', { name: /Înapoi la activități/ })
  expect(document.querySelector('.h-32')).not.toBeInTheDocument()
  expect(document.querySelector('.from-primary\\/20')).not.toBeInTheDocument()
  expect(document.querySelector('.md\\:h-96')).not.toBeInTheDocument()
  expect(link.className).toContain('h-11')
  expect(link.compareDocumentPosition(titlu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(titlu.className).toContain('mt-4')
  expect(titlu.className).toContain('text-3xl')
  expect(titlu.className).toContain('md:text-4xl')
  expect(titlu.className).toContain('text-foreground')
  expect(screen.queryByText('Ciclism')).not.toBeInTheDocument()
  expect(screen.queryByText('Încheiată')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Poze' })).toBeInTheDocument()
})

test('poza activității umple banda, iar poza sportului rămâne în galerie', async () => {
  mocked.mockResolvedValue({
    ...DETALIU,
    bandUrl: 'https://public/activity-photos/a/hero.jpg',
  })
  deseneaza()
  const titlu = await screen.findByRole('heading', { level: 1, name: 'DEMO — Atelier de ciclism' })
  const banda = document.querySelector('.h-\\[46vh\\] img')
  expect(banda).toHaveAttribute('src', 'https://public/activity-photos/a/hero.jpg')
  expect(banda?.className).toContain('object-cover')
  expect(document.querySelector('.md\\:h-\\[52vh\\]')).toBeInTheDocument()
  expect(document.querySelector('.min-h-\\[320px\\]')).toBeInTheDocument()
  expect(titlu.className).toContain('text-white')
  expect(titlu.className).toContain('text-4xl')
  expect(document.querySelector('.from-primary\\/20')).not.toBeInTheDocument()
  expect(document.querySelector('.md\\:h-96')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Deschide poza 1 din 1' })).toBeInTheDocument()
  expect(screen.queryByText('Ciclism')).not.toBeInTheDocument()
})

test('titlul de pe bandă pornește din aceeași coloană ca restul paginii', async () => {
  mocked.mockResolvedValue({
    ...DETALIU,
    bandUrl: 'https://public/activity-photos/a/hero.jpg',
  })
  deseneaza()
  const titlu = await screen.findByRole('heading', { level: 1, name: 'DEMO — Atelier de ciclism' })
  expect(titlu.parentElement?.className).toContain('max-w-4xl')
  expect(titlu.parentElement?.className).not.toContain('max-w-6xl')
})
test('organizatorul stă sub titlu, antrenorul e separat, iar locul duce doar la harta site-ului', async () => {
  deseneaza()
  const titlu = await screen.findByRole('heading', { level: 1, name: 'DEMO — Atelier de ciclism' })
  const organizator = screen.getByRole('heading', { name: 'Organizată de' })
  const antrenor = screen.getByRole('heading', { name: /^Antrenor$/ })
  const data = screen.getByText('26.09.2099')
  expect(titlu.compareDocumentPosition(organizator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(
    organizator.compareDocumentPosition(antrenor) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(antrenor.compareDocumentPosition(data) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const club = screen.getByRole('link', { name: /DEMO — Club Sportiv Motion/ })
  expect(club).toHaveAttribute('href', '/cluburi/club-1')
  expect(club).toHaveTextContent('Club · Vezi pagina clubului')
  expect(club.querySelector('img')).toBeNull()
  expect(club.querySelector('svg')).not.toBeNull()
  const coach = screen.getByRole('link', { name: /Antrenor Demo/ })
  expect(coach).toHaveAttribute('href', '/antrenori/coach-1')
  expect(coach).toHaveTextContent('Vezi profilul antrenorului')
  const dataEticheta = screen.getByText('Data')
  const ore = screen.getByText('Ore')
  const locEticheta = screen.getByText('Loc')
  const locuri = screen.getByText('Locuri')
  expect(dataEticheta.parentElement).toHaveTextContent('26.09.2099')
  expect(ore.parentElement).toHaveTextContent('10:00–12:00')
  expect(locEticheta.parentElement).toHaveTextContent('DEMO — Parc de antrenament')
  expect(locEticheta.closest('a')).toBeNull()
  const linkuriLoc = screen
    .getAllByText('DEMO — Parc de antrenament')
    .map((nume) => nume.closest('a'))
    .filter((link) => link !== null)
  expect(linkuriLoc.map((link) => link.getAttribute('href'))).toEqual(['/harta?location=loc-1'])
  expect(locEticheta.parentElement).toContainElement(linkuriLoc[0])
  expect(locuri.parentElement).toHaveTextContent('11 locuri rămase')
  expect(dataEticheta.compareDocumentPosition(ore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(ore.compareDocumentPosition(locEticheta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(
    locEticheta.compareDocumentPosition(locuri) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(dataEticheta.parentElement?.parentElement?.className).toContain('flex-col')
  expect(screen.queryByRole('heading', { name: 'Regulament' })).not.toBeInTheDocument()
})

test('descrierea cu mai multe paragrafe stă sub eticheta Descriere', async () => {
  mocked.mockResolvedValue({
    ...DETALIU,
    description: 'Primul paragraf despre traseu.\n\nAl doilea paragraf despre echipament.',
  })
  deseneaza()
  const eticheta = await screen.findByText('Descriere')
  const primul = screen.getByText('Primul paragraf despre traseu.')
  const alDoilea = screen.getByText('Al doilea paragraf despre echipament.')
  expect(eticheta.compareDocumentPosition(primul) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(primul.compareDocumentPosition(alDoilea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(eticheta.className).toContain('text-sm')
  expect(eticheta.className).toContain('font-medium')
})

test('galerie, regulament, hartă și nota de curs stau în ordinea aleasă', async () => {
  const user = userEvent.setup()
  mocked.mockResolvedValue({
    ...DETALIU,
    regulament: {
      rules_file_storage_path: 'act-1/rules.pdf',
      rules_file_name: 'Regulament ciclism.pdf',
      rules_file_content_type: 'application/pdf',
      rules_file_size_bytes: 2048,
    },
  })
  deseneaza()
  const descriere = await screen.findByText('Atelier de mecanică și traseu scurt.')
  const eticheta = screen.getByText('Descriere')
  const data = screen.getByText('Data')
  expect(eticheta.className).toContain('text-foreground')
  expect(eticheta.className).toContain('font-medium')
  expect(eticheta.className).toContain('text-sm')
  expect(data.className).toContain('text-foreground')
  expect(data.className).toContain('font-medium')
  expect(data.parentElement?.parentElement?.className).toContain('text-sm')
  expect(
    eticheta.compareDocumentPosition(descriere) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Din activitate' })).not.toBeInTheDocument()
  const galerie = screen.getByRole('heading', { name: 'Poze' })
  const regulament = screen.getByRole('heading', { name: 'Regulament' })
  const harta = screen.getByRole('link', { name: 'Deschide DEMO — Parc de antrenament în hărți' })
  expect(descriere.compareDocumentPosition(galerie) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(
    galerie.compareDocumentPosition(regulament) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(regulament.compareDocumentPosition(harta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(harta).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=45.751,21.238',
  )
  expect(harta).toHaveAttribute('target', '_blank')
  expect(screen.getByRole('link', { name: /Regulament ciclism.pdf/ })).toBeInTheDocument()
  expect(screen.queryByText(/Fără descriere/)).not.toBeInTheDocument()
  const nota = screen.getByText(/Plata se face în lei, la cursul organizatorului: 1 EUR = 5,1 lei/)
  expect(nota.className).toContain('text-xs')
  expect(nota.className).toContain('text-muted-foreground')
  await user.click(screen.getByRole('button', { name: 'Deschide poza 1 din 1' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('fără coordonate harta lipsește, iar numele rămâne pe rând', async () => {
  mocked.mockResolvedValue({
    ...DETALIU,
    location: {
      id: 'loc-1',
      name: 'DEMO — Parc de antrenament',
      address: null,
      lat: null,
      lng: null,
    },
  })
  deseneaza()
  expect(await screen.findByText('DEMO — Parc de antrenament')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /în hărți/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /vezi pe hartă/ })).not.toBeInTheDocument()
})

test('locul de pe rândul Loc duce la harta site-ului, ca pe tabără', async () => {
  deseneaza()
  const link = await screen.findByRole('link', {
    name: 'DEMO — Parc de antrenament — vezi pe hartă',
  })
  expect(link).toHaveAttribute('href', '/harta?location=loc-1')
  expect(link).toHaveTextContent('DEMO — Parc de antrenament')
  expect(link.className).toContain('underline')
  expect(link.className).toContain('min-h-touch-target')
})

test('locația are titlu, adresă, link vizibil și ascunde dalele care nu se încarcă', async () => {
  deseneaza()
  const titlu = await screen.findByRole('heading', { name: 'Locație' })
  const sectiune = titlu.closest('section') as HTMLElement
  expect(within(sectiune).getByText('Str. Exemplu 1')).toBeInTheDocument()
  const link = within(sectiune).getByRole('link', {
    name: 'Deschide DEMO — Parc de antrenament în hărți',
  })
  expect(link).toHaveTextContent('Deschide în hărți')
  expect(link.className).toContain('min-h-11')
  const harta = sectiune.querySelector('a[aria-hidden="true"]') as HTMLAnchorElement
  expect(harta).toHaveAttribute('tabindex', '-1')
  expect(harta).toHaveAttribute('href', link.getAttribute('href'))
  expect(harta.className).toContain('rounded-2xl')
  expect(harta.className).toContain('border')
  const dala = harta.querySelector('img') as HTMLImageElement
  fireEvent.error(dala)
  expect(dala.hidden).toBe(true)
})

test('prețul în lei nu are notă, zero e Gratuit, iar înscrierea cere login', async () => {
  const user = userEvent.setup()
  mocked.mockResolvedValue({ ...DETALIU, price: 0, currency: 'RON', eur_ron_rate_micros: null })
  deseneaza()
  expect(await screen.findByText('Gratuit')).toBeInTheDocument()
  expect(screen.queryByText(/Plata se face în lei/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Cursul în lei nu este disponibil/)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Înscrie-te' }))
  expect(navigheaza).toHaveBeenCalledWith('/login?returnUrl=%2Factivitati%2Fact-1')
})

test('contul deschis duce la checkout, iar cursul lipsă lasă înscrierea', async () => {
  const user = userEvent.setup()
  utilizator = { id: 'parinte-1' }
  mocked.mockResolvedValue({ ...DETALIU, eur_ron_rate_micros: null })
  deseneaza()
  const nota = await screen.findByText(/Cursul în lei nu este disponibil/)
  expect(nota.className).toContain('text-xs')
  await user.click(screen.getByRole('button', { name: 'Înscrie-te' }))
  expect(navigheaza).toHaveBeenCalledWith('/account/checkout?kind=ACTIVITY&id=act-1')
})

test('activitatea încheiată închide înscrierea și nu mai spune locurile', async () => {
  mocked.mockResolvedValue({ ...DETALIU, activityDate: '2020-06-25', currency: 'RON' })
  deseneaza()
  expect(
    await screen.findByText('Activitatea s-a încheiat, înscrierile sunt închise.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Înscrie-te' })).not.toBeInTheDocument()
  expect(screen.queryByText(/locuri rămase/)).not.toBeInTheDocument()
  expect(screen.queryByText(/loc rămas/)).not.toBeInTheDocument()
  expect(screen.queryByText('Locuri')).not.toBeInTheDocument()
  expect(screen.getByText('Data')).toBeInTheDocument()
  expect(screen.getByText('Ore')).toBeInTheDocument()
  expect(screen.getByText('Loc')).toBeInTheDocument()
  expect(screen.queryByText('Încheiată')).not.toBeInTheDocument()
})

test('fără locuri, înscrierea dispare; fără număr, rămâne', async () => {
  mocked.mockResolvedValue({ ...DETALIU, locuriRamase: 0 })
  const prima = deseneaza()
  expect(await screen.findByText('Toate locurile sunt ocupate.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Înscrie-te' })).not.toBeInTheDocument()
  expect(screen.queryByText(/loc rămas/)).not.toBeInTheDocument()
  prima.unmount()
  mocked.mockResolvedValue({ ...DETALIU, locuriRamase: null })
  deseneaza()
  expect(await screen.findByRole('button', { name: 'Înscrie-te' })).toBeInTheDocument()
  expect(screen.queryByText(/locuri rămase/)).not.toBeInTheDocument()
  expect(screen.queryByText('Toate locurile sunt ocupate.')).not.toBeInTheDocument()
})

test('când organizatorul e antrenorul, apare un singur card, cu profilul lui', async () => {
  mocked.mockResolvedValue({
    ...DETALIU,
    organizator: {
      fel: 'antrenor',
      id: 'coach-1',
      nume: 'Antrenor Demo',
      link: '/antrenori/coach-1',
      pozaUrl: null,
    },
    antrenori: [],
  })
  deseneaza()
  const card = await screen.findByRole('link', { name: /Antrenor Demo/ })
  expect(card).toHaveAttribute('href', '/antrenori/coach-1')
  expect(card).toHaveTextContent('Antrenor · Vezi profilul antrenorului')
  expect(screen.queryByRole('heading', { name: /^Antrenor$/ })).not.toBeInTheDocument()
})

test('fără organizator și fără antrenor, blocul nu apare', async () => {
  mocked.mockResolvedValue({ ...DETALIU, organizator: null, antrenori: [] })
  deseneaza()
  await screen.findByRole('heading', { level: 1, name: 'DEMO — Atelier de ciclism' })
  expect(screen.queryByRole('heading', { name: 'Organizată de' })).not.toBeInTheDocument()
})

test('fără alți antrenori, blocul lor nu apare', async () => {
  mocked.mockResolvedValue({ ...DETALIU, antrenori: [] })
  deseneaza()
  expect(await screen.findByRole('heading', { name: 'Organizată de' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /^Antrenor$/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /^Antrenori$/ })).not.toBeInTheDocument()
})

test('fără poza activității și fără poza sportului apare ilustrația sportului', async () => {
  mocked.mockResolvedValue({ ...DETALIU, photoUrl: null, galerieUrls: [] })
  deseneaza()
  expect(await screen.findByRole('img', { name: 'Ilustrație Ciclism' })).toBeVisible()
  expect(screen.getByText('Ciclism')).toBeVisible()
})

test('când sportul are poză standard nu apare ilustrația', async () => {
  deseneaza()
  await screen.findByRole('heading', { level: 1, name: 'DEMO — Atelier de ciclism' })
  expect(screen.queryByRole('img', { name: /Ilustrație/ })).not.toBeInTheDocument()
})

test('cardul de preț e plat, ca restul cardurilor din design system', async () => {
  deseneaza()
  const buton = await screen.findByRole('button', { name: 'Înscrie-te' })
  const card = buton.parentElement as HTMLElement
  expect(card).toHaveClass('rounded-xl', 'border')
  expect(card).not.toHaveClass('shadow-card')
  expect(card).not.toHaveClass('rounded-3xl')
})
