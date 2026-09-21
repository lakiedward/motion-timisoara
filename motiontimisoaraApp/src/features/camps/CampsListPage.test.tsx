import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import CampsListPage from './CampsListPage'
import { getTaberelemele, type TabaraDinLista } from '@/api/camps-admin'
import { formatMoney } from '@/lib/money'

vi.mock('@/api/camps-admin', async () => {
  const real = await vi.importActual<typeof import('@/api/camps-admin')>('@/api/camps-admin')
  return { ...real, getTaberelemele: vi.fn() }
})
vi.mock('./useProprietarTabere', () => ({
  useProprietarTabere: () => ({
    proprietar: { clubId: 'club-1', coachUserId: null },
    gata: true,
    eClub: true,
    eroare: false,
    reincearca: () => {},
  }),
}))
vi.mock('./CampInvitations', () => ({ default: () => null }))

const BAZA = '/club/camps'

function tabara(p: Partial<TabaraDinLista> = {}): TabaraDinLista {
  return {
    id: 'tabara-1',
    title: 'Tabără de munte',
    slug: 'tabara-de-munte',
    period_start: '2027-07-10',
    period_end: '2027-07-17',
    location_text: null,
    location_id: null,
    capacity: 20,
    price: 0,
    allow_cash: false,
    description: null,
    hero_photo_storage_path: null,
    pricing_mode: 'by_age',
    club_id: 'club-1',
    coach_id: null,
    currency: 'RON',
    gallery_json: null,
    camp_requirements: [],
    rules: null,
    eur_ron_rate_micros: null,
    locuriOcupate: 0,
    categorii: 0,
    preturiPeVarsta: [],
    antrenoriAcceptati: 0,
    antrenoriInAsteptare: 0,
    ...p,
  } as TabaraDinLista
}

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CampsListPage baza={BAZA} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getTaberelemele).mockReset()
})

test('o tabără by_age arată numărul de categorii de vârstă și intervalul de preț', async () => {
  vi.mocked(getTaberelemele).mockResolvedValue([
    tabara({
      categorii: 2,
      preturiPeVarsta: [0, 60000],
      price: 0,
    }),
  ])
  deseneaza()
  expect(await screen.findByRole('heading', { name: 'Tabără de munte' })).toBeInTheDocument()
  expect(screen.getByText('Gratuit – 600,00 lei')).toBeInTheDocument()
  expect(screen.getByText('2 categorii')).toBeInTheDocument()
  expect(screen.queryByText('0,00 lei')).not.toBeInTheDocument()
  expect(screen.queryByText('Fără categorii')).not.toBeInTheDocument()
})

test('fără categorii de vârstă, prețul e Gratuit', async () => {
  vi.mocked(getTaberelemele).mockResolvedValue([tabara({ categorii: 0, preturiPeVarsta: [], price: 0 })])
  deseneaza()
  expect(await screen.findByText('Gratuit')).toBeInTheDocument()
  expect(screen.getByText('Fără categorii')).toBeInTheDocument()
})

test('o tabără cu preț unic păstrează prețul global și itemele', async () => {
  vi.mocked(getTaberelemele).mockResolvedValue([
    tabara({
      id: 'tabara-unica',
      title: 'Tabără unică',
      pricing_mode: 'single',
      price: 90000,
      categorii: 3,
      preturiPeVarsta: [],
    }),
  ])
  deseneaza()
  expect(await screen.findByRole('heading', { name: 'Tabără unică' })).toBeInTheDocument()
  expect(screen.getByText(formatMoney(90000, 'RON'))).toBeInTheDocument()
  expect(screen.getByText('3 categorii')).toBeInTheDocument()
  expect(screen.queryByText('Gratuit')).not.toBeInTheDocument()
})

test('cardul duce la editare pe baza portalului', async () => {
  vi.mocked(getTaberelemele).mockResolvedValue([tabara({ preturiPeVarsta: [40000], categorii: 1 })])
  deseneaza()
  const card = await screen.findByRole('link', { name: /Tabără de munte/ })
  expect(card).toHaveAttribute('href', '/club/camps/tabara-1/edit')
})

test('o listă care nu se încarcă spune asta, nu „nicio tabără”', async () => {
  vi.mocked(getTaberelemele).mockRejectedValue(new Error('retea'))
  deseneaza()
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca taberele.')
  expect(screen.queryByText(/Nicio tabără încă/)).not.toBeInTheDocument()
})

test('fără tabere, mesajul e altul decât cel de eroare', async () => {
  vi.mocked(getTaberelemele).mockResolvedValue([])
  deseneaza()
  expect(await screen.findByText('Nicio tabără încă.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
