import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  sportName: 'Ciclism',
  location: { name: 'DEMO — Parc de antrenament', lat: 45.751, lng: 21.238 },
  organizator: {
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

test('organizatorul stă sub titlu, antrenorul e separat, iar numele locului nu e link', async () => {
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
  const club = screen.getByRole('link', { name: 'DEMO — Club Sportiv Motion' })
  expect(club).toHaveAttribute('href', '/cluburi/club-1')
  expect(club.querySelector('img')).toBeNull()
  expect(club.parentElement?.querySelector('.rounded-full')?.textContent).toBe('D')
  const coach = screen.getByRole('link', { name: 'Antrenor Demo' })
  expect(coach).toHaveAttribute('href', '/antrenori/coach-1')
  expect(coach.querySelector('img')).toBeNull()
  expect(coach.parentElement?.querySelector('img')).toHaveAttribute(
    'src',
    'https://public/coach-photos/demo.jpg',
  )
  const dataEticheta = screen.getByText('Data')
  const ore = screen.getByText('Ore')
  const locEticheta = screen.getByText('Loc')
  const locuri = screen.getByText('Locuri')
  expect(dataEticheta.parentElement).toHaveTextContent('26.09.2099')
  expect(ore.parentElement).toHaveTextContent('10:00–12:00')
  expect(locEticheta.parentElement).toHaveTextContent('DEMO — Parc de antrenament')
  expect(locEticheta.closest('a')).toBeNull()
  expect(screen.getByText('DEMO — Parc de antrenament').closest('a')).toBeNull()
  expect(locuri.parentElement).toHaveTextContent('11 locuri rămase')
  expect(dataEticheta.compareDocumentPosition(ore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(ore.compareDocumentPosition(locEticheta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(
    locEticheta.compareDocumentPosition(locuri) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(dataEticheta.parentElement?.parentElement?.className).toContain('flex-col')
  expect(screen.queryByRole('heading', { name: 'Regulament' })).not.toBeInTheDocument()
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
    location: { name: 'DEMO — Parc de antrenament', lat: null, lng: null },
  })
  deseneaza()
  expect(await screen.findByText('DEMO — Parc de antrenament')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /în hărți/ })).not.toBeInTheDocument()
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

test('fără alți antrenori, blocul lor nu apare', async () => {
  mocked.mockResolvedValue({ ...DETALIU, antrenori: [] })
  deseneaza()
  expect(await screen.findByRole('heading', { name: 'Organizată de' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /^Antrenor$/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /^Antrenori$/ })).not.toBeInTheDocument()
})
