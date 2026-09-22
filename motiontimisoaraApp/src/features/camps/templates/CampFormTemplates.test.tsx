import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { toast } from 'sonner'

import CampFormPage from '../CampFormPage'
import CampTemplatePicker from './CampTemplatePicker'
import {
  getCategoriile,
  getPretulAdult,
  getPreturilePeVarsta,
  getTabaraDeEditat,
  getTaberelemele,
  listeazaSabloaneTabara,
  salveazaSablonTabara,
  saveCampOffer,
  stergeSablonTabara,
  type SablonTabara,
} from '@/api/camps-admin'
import { incarcaRegulamentFisier, stergeRegulamentFisier } from '@/api/camp-rules-file'
import { getCursBnr } from '@/api/bnr-rate'
import { getClubSelectableLocations } from '@/api/club'
import { getSelectableLocations } from '@/api/coach'

vi.mock('@/api/camps-admin', async () => {
  const real = await vi.importActual<typeof import('@/api/camps-admin')>('@/api/camps-admin')
  return {
    ...real,
    getCategoriile: vi.fn(),
    getPretulAdult: vi.fn(),
    getPreturilePeVarsta: vi.fn(),
    getTabaraDeEditat: vi.fn(),
    getTaberelemele: vi.fn(),
    listeazaSabloaneTabara: vi.fn(),
    salveazaSablonTabara: vi.fn(),
    saveCampOffer: vi.fn(),
    stergeSablonTabara: vi.fn(),
  }
})
vi.mock('@/api/bnr-rate', async () => {
  const real = await vi.importActual<typeof import('@/api/bnr-rate')>('@/api/bnr-rate')
  return { ...real, getCursBnr: vi.fn() }
})
vi.mock('@/api/club', () => ({ getClubSelectableLocations: vi.fn() }))
vi.mock('@/api/coach', () => ({ getSelectableLocations: vi.fn() }))
vi.mock('@/api/camp-rules-file', () => ({
  incarcaRegulamentFisier: vi.fn(),
  stergeRegulamentFisier: vi.fn(),
  campRulesFileAfisabil: vi.fn(() => null),
}))
vi.mock('../useProprietarTabere', () => ({
  useProprietarTabere: () => ({
    proprietar: { clubId: 'club-1', coachUserId: null },
    gata: true,
    eClub: true,
    eroare: false,
    reincearca: () => {},
  }),
}))
vi.mock('../CampPhotosSection', () => ({ default: () => null }))
vi.mock('../CampCoachesSection', () => ({ default: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const BAZIN = 'b6d97609-d740-44aa-b930-fb222ffadb13'
const SABLON: SablonTabara = {
  id: 'sablon-vara',
  name: 'Vara la munte',
  description: 'In fiecare an',
  rules: 'Liniste dupa 22',
  location_id: BAZIN,
  location_text: 'La cabana',
  capacity: 24,
  allow_cash: true,
  currency: 'RON',
  camp_requirements: [],
  age_prices: [{ age_from: 6, age_to: 9, components: [{ name: 'Cazare', amount: 40000 }] }],
}

function renderForm(ruta: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/club/camps/new" element={<CampFormPage baza="/club/camps" />} />
          <Route path="/club/camps/:id/edit" element={<CampFormPage baza="/club/camps" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listeazaSabloaneTabara).mockResolvedValue([SABLON])
  vi.mocked(salveazaSablonTabara).mockResolvedValue('sablon-vara')
  vi.mocked(stergeSablonTabara).mockResolvedValue(undefined)
  vi.mocked(saveCampOffer).mockResolvedValue(undefined)
  vi.mocked(getTaberelemele).mockResolvedValue([] as never)
  vi.mocked(getPretulAdult).mockResolvedValue(null)
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([] as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getClubSelectableLocations).mockResolvedValue([
    { id: BAZIN, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
  ])
  vi.mocked(getSelectableLocations).mockResolvedValue([])
  vi.mocked(getCursBnr).mockResolvedValue({ date: '2026-09-22', eur_ron_millionths: 5073100 })
  vi.mocked(incarcaRegulamentFisier).mockResolvedValue({
    storagePath: 'id/uuid.pdf',
    name: 'regulament.pdf',
    contentType: 'application/pdf',
    sizeBytes: 12,
  })
  vi.mocked(stergeRegulamentFisier).mockResolvedValue(undefined)
})

test('fără șabloane spune de unde se salvează', async () => {
  vi.mocked(listeazaSabloaneTabara).mockResolvedValue([])
  renderForm('/club/camps/new')
  expect(
    await screen.findByText(
      'Nu ai șabloane. Le salvezi dintr-o tabără existentă, cu „Salvează ca șablon”.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Formular gol' })).toBeChecked()
  expect(screen.queryByText('Se încarcă șabloanele…')).not.toBeInTheDocument()
  expect(screen.queryByText('Nu am putut încărca șabloanele.')).not.toBeInTheDocument()
})

test('încărcarea șabloanelor nu e o cutie goală', async () => {
  vi.mocked(listeazaSabloaneTabara).mockReturnValue(new Promise(() => {}))
  renderForm('/club/camps/new')
  expect(await screen.findByRole('status')).toHaveTextContent('Se încarcă șabloanele…')
  expect(screen.queryByText(/Nu ai șabloane/)).not.toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: 'Formular gol' })).not.toBeInTheDocument()
})

test('eroarea de șabloane e separată de lista goală', async () => {
  const user = userEvent.setup()
  vi.mocked(listeazaSabloaneTabara).mockRejectedValue(new Error('retea'))
  renderForm('/club/camps/new')
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut încărca șabloanele.')
  expect(screen.queryByText(/Nu ai șabloane/)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(listeazaSabloaneTabara).toHaveBeenCalledTimes(2))
})

test('proprietarul eșuat nu rămâne pe un schelet', async () => {
  const user = userEvent.setup()
  const reincearca = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CampTemplatePicker
        proprietar={{ clubId: null, coachUserId: null }}
        gata={false}
        eroareProprietar
        reincearcaProprietar={reincearca}
        selectatId=""
        citesteAreDate={() => false}
        onAlege={() => {}}
        onSters={() => {}}
      />
    </QueryClientProvider>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Nu am putut încărca șabloanele.')
  expect(document.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(reincearca).toHaveBeenCalledOnce()
})

test('tabăra nouă alege șablonul și lasă titlul gol', async () => {
  const user = userEvent.setup()
  renderForm('/club/camps/new')
  expect(screen.queryByRole('button', { name: 'Salvează ca șablon' })).not.toBeInTheDocument()
  await user.click(await screen.findByRole('radio', { name: 'Vara la munte' }))
  expect(screen.queryByText(/Înlocuiești câmpurile/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('Titlu')).toHaveValue('')
  expect(screen.getByLabelText('Descriere')).toHaveValue('In fiecare an')
  expect(screen.getByLabelText('Locuri')).toHaveValue(24)
  expect(screen.getByRole('checkbox', { name: 'Acceptă plata cash' })).toBeChecked()
})

test('un formular început cere confirmare și păstrează titlul', async () => {
  const user = userEvent.setup()
  renderForm('/club/camps/new')
  await user.type(await screen.findByLabelText('Titlu'), 'Ediția 2028')
  await user.click(await screen.findByRole('radio', { name: 'Vara la munte' }))
  expect(screen.getByText(/Înlocuiești câmpurile copiate/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Renunță' }))
  expect(screen.getByLabelText('Descriere')).toHaveValue('')
  await user.click(screen.getByRole('radio', { name: 'Vara la munte' }))
  await user.click(screen.getByRole('button', { name: 'Înlocuiește' }))
  expect(screen.getByLabelText('Titlu')).toHaveValue('Ediția 2028')
  expect(screen.getByLabelText('Descriere')).toHaveValue('In fiecare an')
})

test('ștergerea șablonului nu salvează tabăra', async () => {
  const user = userEvent.setup()
  renderForm('/club/camps/new')
  await user.click(await screen.findByRole('button', { name: 'Șterge Vara la munte' }))
  await user.click(screen.getByRole('button', { name: 'Șterge șablonul' }))
  await waitFor(() => expect(stergeSablonTabara).toHaveBeenCalledWith('sablon-vara'))
  expect(saveCampOffer).not.toHaveBeenCalled()
  expect(toast.success).toHaveBeenCalledWith('Șablon șters.')
})

test('editarea salvează șablonul fără perioadă și înlocuiește același nume', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    id: 'tabara-1',
    title: 'Tabără de înot',
    slug: 'tabara-inot-2026',
    period_start: '2026-09-13',
    period_end: '2026-09-20',
    location_text: 'Băile Herculane',
    capacity: 20,
    price: 90000,
    allow_cash: false,
    description: 'Text salvat',
    hero_photo_storage_path: null,
    pricing_mode: 'by_age',
    location_id: null,
    club_id: 'club-1',
    coach_id: null,
    currency: 'RON',
    gallery_json: null,
    camp_requirements: [],
    rules: null,
    rules_file_content_type: null,
    rules_file_name: null,
    rules_file_size_bytes: null,
    rules_file_storage_path: null,
  } as never)
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([
    {
      age_from: 6,
      age_to: 9,
      amount: 40000,
      components: [{ name: 'Cazare', amount: 40000 }],
    },
  ] as never)
  vi.mocked(listeazaSabloaneTabara).mockResolvedValue([
    { ...SABLON, name: 'Tabără de înot' },
  ])
  renderForm('/club/camps/tabara-1/edit')
  expect(await screen.findByRole('button', { name: 'Salvează ca șablon' })).toBeInTheDocument()
  expect(screen.queryByText('Pornește de la un șablon')).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByLabelText('Titlu')).toHaveValue('Tabără de înot'))
  await waitFor(() =>
    expect(screen.getByLabelText('Numele șablonului')).toHaveValue('Tabără de înot'),
  )
  await user.click(screen.getByRole('button', { name: 'Salvează ca șablon' }))
  expect(await screen.findByText(/Există deja un șablon cu acest nume/)).toBeInTheDocument()
  expect(salveazaSablonTabara).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Înlocuiește' }))
  await waitFor(() => expect(salveazaSablonTabara).toHaveBeenCalledOnce())
  const payload = vi.mocked(salveazaSablonTabara).mock.calls[0][1]
  expect(payload.name).toBe('Tabără de înot')
  expect(payload.description).toBe('Text salvat')
  expect(payload.age_prices[0].components[0]).toEqual({ name: 'Cazare', amount: 40000 })
  expect(payload).not.toHaveProperty('period_start')
  expect(payload).not.toHaveProperty('slug')
  expect(toast.success).toHaveBeenCalledWith('Șablon salvat.')
})
