import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CampsPage from './CampsPage'
import { getTaberePublice, type TabaraDinLista } from '@/api/camps'

vi.mock('@/api/camps', async () => {
  const real = await vi.importActual<typeof import('@/api/camps')>('@/api/camps')
  return { ...real, getTaberePublice: vi.fn() }
})

const mocked = vi.mocked(getTaberePublice)

const TABARA: TabaraDinLista = {
  id: 'b',
  slug: 'inot',
  title: 'Tabără de înot',
  period_start: '2026-09-13',
  period_end: '2026-09-18',
  location_text: 'Timișoara',
  price: 90000,
  allow_cash: false,
  heroUrl: 'https://public/hero.jpg',
  organizator: { fel: 'club', nume: 'Club Test', link: '/cluburi/c1' },
  locuriRamase: 20,
}

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CampsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocked.mockReset()
})

// Criteriul care nu se poate forta din browser: supabase-js isi leaga fetch-ul
// la construirea clientului, deci reteaua nu se poate taia din runtime fara sa
// modific tocmai codul verificat. Aici se poate.
test('o listă care nu se încarcă spune asta, nu „nicio tabără"', async () => {
  mocked.mockRejectedValue(new Error('retea picata'))
  deseneaza()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  expect(screen.getByText('Nu am putut încărca taberele.')).toBeInTheDocument()
  expect(screen.queryByText(/Nicio tabără programată/)).not.toBeInTheDocument()
})

test('din eroare se poate reîncerca, iar a doua oară lista apare', async () => {
  const user = userEvent.setup()
  mocked.mockRejectedValueOnce(new Error('retea picata')).mockResolvedValueOnce([TABARA])
  deseneaza()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(screen.getByText('Tabără de înot')).toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

// Starea goala trebuie sa ramana DISTINCTA de cea de eroare: „nicio tabara" e o
// afirmatie despre lume, nu o scuza pentru o retea picata.
test('fără nicio tabără viitoare, mesajul e altul decât cel de eroare', async () => {
  mocked.mockResolvedValue([])
  deseneaza()
  await waitFor(() => expect(screen.getByText(/Nicio tabără programată/)).toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('cardul arată locurile rămase, organizatorul și poza', async () => {
  mocked.mockResolvedValue([TABARA])
  deseneaza()
  await waitFor(() => expect(screen.getByText('Tabără de înot')).toBeInTheDocument())
  expect(screen.getByText('20 de locuri rămase')).toBeInTheDocument()
  expect(screen.getByText('Club Test')).toBeInTheDocument()
  expect(document.querySelector('img[src="https://public/hero.jpg"]')).toBeInTheDocument()
})

// Cash-ul se vedea abia la checkout, unde parintele afla ca nu poate plati cum
// voia. Se scrie doar cand e adevarat — o tabara doar cu cardul nu spune nimic.
test('plata cash se anunță doar când e permisă', async () => {
  mocked.mockResolvedValue([TABARA])
  const { unmount } = deseneaza()
  await waitFor(() => expect(screen.getByText('Tabără de înot')).toBeInTheDocument())
  expect(screen.queryByText(/Se poate plăti și cash/)).not.toBeInTheDocument()
  unmount()

  mocked.mockResolvedValue([{ ...TABARA, allow_cash: true }])
  deseneaza()
  await waitFor(() => expect(screen.getByText(/Se poate plăti și cash/)).toBeInTheDocument())
})

test('o tabără plină o spune, și nu mai arată locuri rămase', async () => {
  mocked.mockResolvedValue([{ ...TABARA, locuriRamase: 0 }])
  deseneaza()
  await waitFor(() => expect(screen.getByText('Locuri epuizate')).toBeInTheDocument())
  expect(screen.queryByText(/locuri rămase/)).not.toBeInTheDocument()
})

// Fara limita de locuri nu inseamna zero: tabara nu e plina, doar nelimitata.
test('o tabără fără limită nu arată nici locuri, nici „epuizate”', async () => {
  mocked.mockResolvedValue([{ ...TABARA, locuriRamase: null }])
  deseneaza()
  await waitFor(() => expect(screen.getByText('Tabără de înot')).toBeInTheDocument())
  expect(screen.queryByText(/locuri rămase/)).not.toBeInTheDocument()
  expect(screen.queryByText('Locuri epuizate')).not.toBeInTheDocument()
})
