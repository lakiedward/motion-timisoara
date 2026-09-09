import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CampDetailsPage from './CampDetailsPage'
import { getTabaraDetaliu } from '@/api/camps'

const navigheaza = vi.fn()

vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useNavigate: () => navigheaza, useParams: () => ({ slug: 'tabara-inot' }) }
})

vi.mock('@/api/camps', async () => {
  const real = await vi.importActual<typeof import('@/api/camps')>('@/api/camps')
  return { ...real, getTabaraDetaliu: vi.fn() }
})

let utilizator: { id: string } | null = { id: 'parinte-1' }
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: utilizator }) }))

const mocked = vi.mocked(getTabaraDetaliu)

function pesteUnAn(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

const TABARA_IMPLICITA = {
  id: 'camp-1',
  slug: 'tabara-inot',
  title: 'Tabără de înot',
  description: 'Stagiu intensiv.',
  price: 90000,
  capacity: 20,
  allow_cash: false,
  period_start: '2026-09-13',
  period_end: pesteUnAn(),
  location_text: 'Timișoara',
}
const detaliu = (peste: Record<string, unknown> = {}) => ({
  location: null,
  organizator: { fel: 'club', nume: 'Club Audit Motion', link: '/cluburi/club-1' },
  categorii: [],
  agePrices: [],
  antrenori: [],
  heroUrl: null,
  galerieUrls: [],
  locuriRamase: 20,
  ...peste,
  tabara: { ...TABARA_IMPLICITA, ...((peste.tabara as object) ?? {}) },
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CampDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  utilizator = { id: 'parinte-1' }
  mocked.mockResolvedValue(detaliu() as never)
})

test('the camp location opens the map and preserves arrival details', async () => {
  mocked.mockResolvedValue(
    detaliu({
      location: {
        id: 'pool-1',
        name: 'Bazin Olimpic',
        lat: 45.75,
        lng: 21.23,
        address: null,
        city: 'Timișoara',
      },
      tabara: { location_text: 'Intrarea din curte' },
    }) as never,
  )
  renderPage()
  expect(
    await screen.findByRole('link', { name: 'Bazin Olimpic — vezi pe hartă' }),
  ).toHaveAttribute('href', '/harta?location=pool-1')
  expect(screen.getByText('Intrarea din curte')).toBeInTheDocument()
})
test('„Înscrie-te" duce la checkout cu tabăra aleasă', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Înscrie-te' }))
  expect(navigheaza).toHaveBeenCalledWith('/account/checkout?kind=CAMP&slug=tabara-inot')
})

test('un vizitator nelogat e dus la autentificare și se întoarce pe tabără', async () => {
  const user = userEvent.setup()
  utilizator = null
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Înscrie-te' }))
  expect(navigheaza).toHaveBeenCalledWith('/login?returnUrl=%2Ftabere%2Ftabara-inot')
})
test('o tabără încheiată nu mai oferă înscriere și spune de ce', async () => {
  mocked.mockResolvedValue(detaliu({ tabara: { period_end: '2020-08-21' } }) as never)
  renderPage()
  expect(await screen.findByText('Încheiată')).toBeInTheDocument()
  expect(screen.getByText(/înscrierile sunt închise/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Înscrie-te' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Tabără de înot' })).toBeInTheDocument()
  expect(screen.getByText('900,00 lei')).toBeInTheDocument()
})
test('perioada și locul se văd lângă titlu', async () => {
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Tabără de înot' })
  expect(screen.getByText(/13\.09\.2026/)).toBeInTheDocument()
  expect(screen.getByText('Timișoara')).toBeInTheDocument()
})

test('o tabără fără loc nu lasă un rând gol în locul lui', async () => {
  mocked.mockResolvedValue(detaliu({ tabara: { location_text: null } }) as never)
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Tabără de înot' })
  expect(screen.queryByText('Timișoara')).not.toBeInTheDocument()
})
test('un antrenor fără poză primește inițiala numelui', async () => {
  mocked.mockResolvedValue(
    detaliu({ antrenori: [{ id: 'a1', nume: 'Maria Pop', pozaUrl: null }] }) as never,
  )
  renderPage()
  await screen.findByText('Maria Pop')
  expect(screen.getByText('M')).toBeInTheDocument()
})

test('o tabără plină nu mai oferă înscriere', async () => {
  mocked.mockResolvedValue(detaliu({ locuriRamase: 0 }) as never)
  renderPage()
  expect(await screen.findByText('Locuri epuizate')).toBeInTheDocument()
  expect(screen.getByText('Toate locurile sunt ocupate.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Înscrie-te' })).not.toBeInTheDocument()
})
test('locurile rămase se văd, cu acordul la număr', async () => {
  mocked.mockResolvedValue(detaliu({ locuriRamase: 20 }) as never)
  renderPage()
  expect(await screen.findByText('20 de locuri rămase')).toBeInTheDocument()
})

test('un singur loc rămas se scrie la singular', async () => {
  mocked.mockResolvedValue(detaliu({ locuriRamase: 1 }) as never)
  renderPage()
  expect(await screen.findByText('1 loc rămas')).toBeInTheDocument()
})
test('capacitatea nelimitată nu afișează niciun număr de locuri', async () => {
  mocked.mockResolvedValue(detaliu({ locuriRamase: null }) as never)
  renderPage()
  await screen.findByRole('button', { name: 'Înscrie-te' })
  expect(screen.queryByText(/locuri rămase/)).not.toBeInTheDocument()
  expect(screen.queryByText('Locuri epuizate')).not.toBeInTheDocument()
})
test('lipsa plății cash se spune pe pagină, nu la checkout', async () => {
  renderPage()
  expect(await screen.findByText('Doar plată cu cardul.')).toBeInTheDocument()
})

test('o tabără care acceptă cash nu afișează avertismentul', async () => {
  mocked.mockResolvedValue(detaliu({ tabara: { allow_cash: true } }) as never)
  renderPage()
  await screen.findByRole('button', { name: 'Înscrie-te' })
  expect(screen.queryByText('Doar plată cu cardul.')).not.toBeInTheDocument()
})
test('prețul e desfășurat pe categorii, cu descriere la fiecare', async () => {
  mocked.mockResolvedValue(
    detaliu({
      categorii: [
        {
          id: 'p1',
          name: 'Monitorizare',
          description: 'Doi antrenori non-stop',
          amount: 25000,
          display_order: 0,
        },
        {
          id: 'p2',
          name: 'Cazare și masă',
          description: 'Pensiune completă',
          amount: 65000,
          display_order: 1,
        },
      ],
    }) as never,
  )
  renderPage()
  expect(await screen.findByText('Ce include prețul')).toBeInTheDocument()
  expect(screen.getByText('Monitorizare')).toBeInTheDocument()
  expect(screen.getByText('Doi antrenori non-stop')).toBeInTheDocument()
  expect(screen.getByText('Cazare și masă')).toBeInTheDocument()
})
test('o desfășurare care nu dă prețul e semnalată, nu ascunsă', async () => {
  mocked.mockResolvedValue(
    detaliu({
      categorii: [
        { id: 'p1', name: 'Monitorizare', description: null, amount: 10000, display_order: 0 },
      ],
    }) as never,
  )
  renderPage()
  expect(await screen.findByText(/însumează/)).toBeInTheDocument()
})

test('o desfășurare corectă nu afișează nicio notă', async () => {
  mocked.mockResolvedValue(
    detaliu({
      categorii: [{ id: 'p1', name: 'Tot', description: null, amount: 90000, display_order: 0 }],
    }) as never,
  )
  renderPage()
  await screen.findByText('Ce include prețul')
  expect(screen.queryByText(/însumează/)).not.toBeInTheDocument()
})
test('clubul organizator se vede, ca link către pagina lui', async () => {
  renderPage()
  const link = await screen.findByRole('link', { name: 'Club Audit Motion' })
  expect(link).toHaveAttribute('href', '/cluburi/club-1')
  expect(screen.getByText('Organizată de')).toBeInTheDocument()
  expect(screen.getByText('Club')).toBeInTheDocument()
})

test('un antrenor organizator duce la pagina lui de antrenor', async () => {
  mocked.mockResolvedValue(
    detaliu({
      organizator: { fel: 'antrenor', nume: 'Audit Antrenor', link: '/antrenori/user-1' },
    }) as never,
  )
  renderPage()
  const link = await screen.findByRole('link', { name: 'Audit Antrenor' })
  expect(link).toHaveAttribute('href', '/antrenori/user-1')
  expect(screen.getByText('Antrenor')).toBeInTheDocument()
})
test('o tabără fără proprietar nu arată o secțiune goală', async () => {
  mocked.mockResolvedValue(detaliu({ organizator: null }) as never)
  renderPage()
  await screen.findByRole('button', { name: 'Înscrie-te' })
  expect(screen.queryByText('Organizată de')).not.toBeInTheDocument()
})
test('antrenorii care însoțesc se văd, cu nume', async () => {
  mocked.mockResolvedValue(
    detaliu({
      antrenori: [
        { id: 'a1', nume: 'Audit Antrenor', pozaUrl: 'https://public/coach-photos/a.jpg' },
        { id: 'a2', nume: 'Maria Pop', pozaUrl: null },
      ],
    }) as never,
  )
  renderPage()
  expect(await screen.findByText('Antrenorii care însoțesc')).toBeInTheDocument()
  expect(screen.getByText('Audit Antrenor')).toBeInTheDocument()
  expect(screen.getByText('Maria Pop')).toBeInTheDocument()
})

test('un singur antrenor se scrie la singular', async () => {
  mocked.mockResolvedValue(
    detaliu({ antrenori: [{ id: 'a1', nume: 'Audit Antrenor', pozaUrl: null }] }) as never,
  )
  renderPage()
  expect(await screen.findByText('Antrenorul care însoțește')).toBeInTheDocument()
})
test('o încărcare căzută arată eroare cu reîncercare, nu „nu a fost găsită"', async () => {
  mocked.mockRejectedValue(new Error('network'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca tabăra.')).toBeInTheDocument()
  expect(screen.queryByText('Tabăra nu a fost găsită.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('o tabără inexistentă are mesajul ei, cu drum înapoi', async () => {
  mocked.mockResolvedValue(null as never)
  renderPage()
  expect(await screen.findByText('Tabăra nu a fost găsită.')).toBeInTheDocument()
  expect(screen.queryByText('Nu am putut încărca tabăra.')).not.toBeInTheDocument()
})
test('poza mare și galeria apar când există', async () => {
  mocked.mockResolvedValue(
    detaliu({
      heroUrl: 'https://public/camp-photos/hero.jpg',
      galerieUrls: ['https://public/camp-photos/g1.jpg', 'https://public/camp-photos/g2.jpg'],
    }) as never,
  )
  const { container } = renderPage()
  await screen.findByText('Din tabără')
  expect(container.querySelector('img[src="https://public/camp-photos/hero.jpg"]')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Deschide poza 1 din 2' })).toBeInTheDocument()
})

test('fără poze, pagina nu arată o secțiune de galerie goală', async () => {
  renderPage()
  await screen.findByRole('button', { name: 'Înscrie-te' })
  expect(screen.queryByText('Din tabără')).not.toBeInTheDocument()
})
