import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import ActivitiesPage from './ActivitiesPage'
import { getActivitatiPublice, type ActivitateDinLista } from '@/api/public'

vi.mock('@/api/public', async () => {
  const real = await vi.importActual<typeof import('@/api/public')>('@/api/public')
  return { ...real, getActivitatiPublice: vi.fn() }
})

const mocked = vi.mocked(getActivitatiPublice)

const ACTIVITATE: ActivitateDinLista = {
  id: 'viitoare',
  name: 'DEMO — Atelier de ciclism',
  activityDate: '2026-09-26',
  startTime: '10:00:00',
  endTime: '12:00:00',
  price: 2000,
  currency: 'EUR',
  locationName: 'DEMO — Parc de antrenament',
  sportName: 'Ciclism',
  heroUrl: 'https://public/sport-photos/ciclism.jpg',
  organizator: 'DEMO — Club Sportiv Motion',
  locuriRamase: 11,
}

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ActivitiesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocked.mockReset()
})

test('o listă care nu se încarcă spune asta și are Reîncearcă', async () => {
  mocked.mockRejectedValue(new Error('retea picata'))
  deseneaza()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  expect(screen.getByText('Nu am putut încărca activitățile.')).toBeInTheDocument()
  expect(screen.queryByText(/Nicio activitate programată/)).not.toBeInTheDocument()
})

test('din eroare se poate reîncerca, iar a doua oară lista apare', async () => {
  const user = userEvent.setup()
  mocked.mockRejectedValueOnce(new Error('retea picata')).mockResolvedValueOnce([ACTIVITATE])
  deseneaza()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(screen.getByText('DEMO — Atelier de ciclism')).toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('lista goală reușită rămâne separată de eroare', async () => {
  mocked.mockResolvedValue([])
  deseneaza()
  await waitFor(() =>
    expect(screen.getByText('Nicio activitate programată momentan.')).toBeInTheDocument(),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
})

test('cât se încarcă, stau trei forme în grila de trei coloane', async () => {
  mocked.mockReturnValue(new Promise(() => {}))
  deseneaza()
  await waitFor(() => {
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(3)
  })
  expect(document.querySelector('.grid.md\\:grid-cols-3')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText(/Nicio activitate programată/)).not.toBeInTheDocument()
})

test('cardul arată poza, sportul pe poză, data, orele, locul, prețul, locurile și organizatorul', async () => {
  mocked.mockResolvedValue([ACTIVITATE])
  deseneaza()
  const card = await screen.findByRole('link', { name: /DEMO — Atelier de ciclism/ })
  expect(card).toHaveAttribute('href', '/activitati/viitoare')
  expect(card.className).toContain('hover:-translate-y-2')
  expect(card.className).toContain('focus-visible:ring-[3px]')
  expect(card.querySelector('img')).toHaveAttribute(
    'src',
    'https://public/sport-photos/ciclism.jpg',
  )
  const sport = screen.getByText('Ciclism')
  expect(card.querySelector('.relative')?.contains(sport)).toBe(true)
  expect(card.querySelector('h3')?.textContent).toBe('DEMO — Atelier de ciclism')
  expect(
    sport.compareDocumentPosition(screen.getByRole('heading', { level: 3 })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(screen.getByText('26.09.2026')).toBeInTheDocument()
  expect(screen.getByText('10:00–12:00')).toBeInTheDocument()
  expect(screen.getByText('DEMO — Parc de antrenament')).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByText('20,00 EUR')).toBeInTheDocument()
  expect(screen.getByText('11 locuri rămase')).toBeInTheDocument()
  expect(screen.getByText('DEMO — Club Sportiv Motion')).toBeInTheDocument()
  expect(screen.queryByText(/Se poate plăti și cash/)).not.toBeInTheDocument()
})

test('fără poză, cardul pune o iconiță, nu un emoji', async () => {
  mocked.mockResolvedValue([{ ...ACTIVITATE, heroUrl: null }])
  deseneaza()
  const card = await screen.findByRole('link', { name: /DEMO — Atelier de ciclism/ })
  expect(card.querySelector('img')).toBeNull()
  expect(card.querySelector('svg')).toBeInTheDocument()
  expect(card.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  expect(screen.getByText('Ciclism')).toBeInTheDocument()
})

test('prețul 0 este Gratuit', async () => {
  mocked.mockResolvedValue([{ ...ACTIVITATE, price: 0, currency: 'RON' }])
  deseneaza()
  expect(await screen.findByText('Gratuit')).toBeInTheDocument()
  expect(screen.queryByText('0,00 lei')).not.toBeInTheDocument()
})

test('o activitate plină o spune, și nu mai arată locuri rămase', async () => {
  mocked.mockResolvedValue([{ ...ACTIVITATE, locuriRamase: 0 }])
  deseneaza()
  expect(await screen.findByText('Locuri epuizate')).toBeInTheDocument()
  expect(screen.queryByText(/locuri rămase/)).not.toBeInTheDocument()
  expect(screen.queryByText(/loc rămas/)).not.toBeInTheDocument()
})

test('fără limită nu arată nici locuri, nici „epuizate”', async () => {
  mocked.mockResolvedValue([{ ...ACTIVITATE, locuriRamase: null }])
  deseneaza()
  await screen.findByText('DEMO — Atelier de ciclism')
  expect(screen.queryByText(/locuri rămase/)).not.toBeInTheDocument()
  expect(screen.queryByText('Locuri epuizate')).not.toBeInTheDocument()
})
