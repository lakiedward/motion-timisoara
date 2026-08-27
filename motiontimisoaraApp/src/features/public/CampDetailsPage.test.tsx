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

const detaliu = (peste: Record<string, unknown> = {}) => ({
  tabara: {
    id: 'camp-1',
    slug: 'tabara-inot',
    title: 'Tabără de înot',
    description: 'Stagiu intensiv.',
    price: 90000,
    capacity: 20,
    allow_cash: false,
    period_start: '2026-09-13',
    period_end: '2036-09-18',
    location_text: 'Timișoara',
    ...((peste.tabara as object) ?? {}),
  },
  categorii: [],
  antrenori: [],
  heroUrl: null,
  galerieUrls: [],
  locuriRamase: 20,
  ...peste,
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

// Criteriul 4 (#638): butonul era un ciot, desi backendul de inscriere e intreg.
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
  expect(navigheaza).toHaveBeenCalledWith(
    '/login?returnUrl=%2Ftabere%2Ftabara-inot',
  )
})

// Criteriul 5: azi un parinte putea ajunge pana la plata pentru ceva terminat.
test('o tabără încheiată nu mai oferă înscriere și spune de ce', async () => {
  mocked.mockResolvedValue(detaliu({ tabara: { period_end: '2020-08-21' } }) as never)
  renderPage()
  expect(await screen.findByText('Încheiată')).toBeInTheDocument()
  expect(screen.getByText(/înscrierile sunt închise/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Înscrie-te' })).not.toBeInTheDocument()
})

test('o tabără plină nu mai oferă înscriere', async () => {
  mocked.mockResolvedValue(detaliu({ locuriRamase: 0 }) as never)
  renderPage()
  expect(await screen.findByText('Locuri epuizate')).toBeInTheDocument()
  expect(screen.getByText('Toate locurile sunt ocupate.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Înscrie-te' })).not.toBeInTheDocument()
})

// Criteriul 6: parintele afla abia la final ca nu mai sunt locuri.
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

// Capacitate nelimitata: nu se scrie nimic, si mai ales nu „0 locuri".
test('capacitatea nelimitată nu afișează niciun număr de locuri', async () => {
  mocked.mockResolvedValue(detaliu({ locuriRamase: null }) as never)
  renderPage()
  await screen.findByRole('button', { name: 'Înscrie-te' })
  expect(screen.queryByText(/locuri rămase/)).not.toBeInTheDocument()
  expect(screen.queryByText('Locuri epuizate')).not.toBeInTheDocument()
})

// Criteriul 7: refuzul venea abia din create-enrollment, dupa ce completase tot.
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

// Criteriul 1 (#638): se vedea un singur numar, fara nicio explicatie.
test('prețul e desfășurat pe categorii, cu descriere la fiecare', async () => {
  mocked.mockResolvedValue(
    detaliu({
      categorii: [
        { id: 'p1', name: 'Monitorizare', description: 'Doi antrenori non-stop', amount: 25000, display_order: 0 },
        { id: 'p2', name: 'Cazare și masă', description: 'Pensiune completă', amount: 65000, display_order: 1 },
      ],
    }) as never,
  )
  renderPage()
  expect(await screen.findByText('Ce include prețul')).toBeInTheDocument()
  expect(screen.getByText('Monitorizare')).toBeInTheDocument()
  expect(screen.getByText('Doi antrenori non-stop')).toBeInTheDocument()
  expect(screen.getByText('Cazare și masă')).toBeInTheDocument()
})

// Criteriul 2: pagina n-are voie sa minta despre bani. Cand desfasurarea nu da
// pretul, o spune, in loc s-o ascunda.
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
      categorii: [
        { id: 'p1', name: 'Tot', description: null, amount: 90000, display_order: 0 },
      ],
    }) as never,
  )
  renderPage()
  await screen.findByText('Ce include prețul')
  expect(screen.queryByText(/însumează/)).not.toBeInTheDocument()
})

// Criteriul 3: parintele isi trimite copilul o saptamana, trebuie sa stie cu cine.
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

// Criteriul 4 (#552): o retea picata aratа ca o adresa gresita.
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

// Criteriile 1 si 2 (#552): pagina incepea direct cu titlul pe fond alb.
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
