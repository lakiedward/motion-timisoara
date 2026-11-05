import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import CampFormPage from '../CampFormPage'
import type { CampPortalBaza } from '../camp-portal'
import {
  getPreturilePeVarsta,
  getPretulAdult,
  getTaberelemele,
  listeazaSabloaneTabara,
  salveazaSablonTabara,
  saveCampOffer,
  stergeSablonTabara,
} from '@/api/camps-admin'
import { incarcaRegulamentFisier, stergeRegulamentFisier } from '@/api/camp-rules-file'
import { getCursBnr } from '@/api/bnr-rate'
import { getClubSelectableLocations } from '@/api/club'
import { getSelectableLocations } from '@/api/coach'
import { setPickerValue } from '@/test/pickers'

export const TABARA = {
  id: 'tabara-1',
  title: 'Tabără de înot',
  slug: 'tabara-inot-2026',
  period_start: '2026-09-13',
  period_end: '2026-09-20',
  location_text: 'Băile Herculane',
  capacity: 20,
  price: 90000,
  allow_cash: false,
  description: '',
  hero_photo_storage_path: 'tabara-1/hero/a.jpg',
  pricing_mode: 'single',
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
}

export const BAZIN = 'b6d97609-d740-44aa-b930-fb222ffadb13'
export const CABANA = '1f0f4d5e-7c3a-4b1e-9a2f-0c6e8d7b5a41'
export const PORTALE: CampPortalBaza[] = ['/club/camps', '/coach/camps', '/admin/camps']

export function renderForm(ruta = '/club/camps/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          {PORTALE.flatMap((baza) => [
            <Route
              key={`${baza}-new`}
              path={`${baza}/new`}
              element={<CampFormPage baza={baza} />}
            />,
            <Route
              key={`${baza}-edit`}
              path={`${baza}/:id/edit`}
              element={<CampFormPage baza={baza} />}
            />,
          ])}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export async function completeazaDetalii(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Titlu/), 'Tabără de înot')
  await user.type(screen.getByLabelText(/^Adresa paginii/), 'tabara-inot')
  setPickerValue(screen.getByLabelText(/^Începe/), '2027-07-10')
  setPickerValue(screen.getByLabelText(/^Se termină/), '2027-07-17')
  fireEvent.change(screen.getByLabelText('Poza din capul paginii', { selector: 'input' }), {
    target: { files: [new File(['poza'], 'hero.jpg', { type: 'image/jpeg' })] },
  })
}

export async function laCosturi(user: ReturnType<typeof userEvent.setup>) {
  await completeazaDetalii(user)
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Categorii și costuri' })
}

export async function completeazaCategorie(
  user: ReturnType<typeof userEvent.setup>,
  rand: HTMLElement,
  deLa: string,
  panaLa: string,
  componente: { name: string; lei: string }[],
) {
  await user.type(within(rand).getByLabelText('De la (ani)'), deLa)
  await user.type(within(rand).getByLabelText('Până la (ani)'), panaLa)
  await user.type(within(rand).getAllByLabelText('Componentă')[0], componente[0].name)
  await user.type(within(rand).getAllByLabelText(/Sumă \(/)[0], componente[0].lei)
  for (let i = 1; i < componente.length; i++) {
    await user.click(within(rand).getByRole('button', { name: 'Adaugă o componentă' }))
    const names = within(rand).getAllByLabelText('Componentă')
    await user.type(names[names.length - 1], componente[i].name)
    const sume = within(rand).getAllByLabelText(/Sumă \(/)
    await user.type(sume[sume.length - 1], componente[i].lei)
  }
}

export function randuriCategorii() {
  return screen.getAllByRole('listitem', { name: /Categoria de vârstă/ })
}

export async function laVerificare(user: ReturnType<typeof userEvent.setup>) {
  await laCosturi(user)
  await completeazaCategorie(user, randuriCategorii()[0], '6', '8', [
    { name: 'Cazare', lei: '400' },
    { name: 'Masă', lei: '200' },
  ])
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Verificare' })
}

export function configureCampFormMocks() {
  vi.clearAllMocks()
  vi.mocked(saveCampOffer).mockResolvedValue(undefined)
  vi.mocked(listeazaSabloaneTabara).mockResolvedValue([])
  vi.mocked(salveazaSablonTabara).mockResolvedValue('sablon-1')
  vi.mocked(stergeSablonTabara).mockResolvedValue(undefined)
  vi.mocked(getTaberelemele).mockResolvedValue([] as never)
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([] as never)
  vi.mocked(getPretulAdult).mockResolvedValue(null)
  vi.mocked(getClubSelectableLocations).mockResolvedValue([
    { id: BAZIN, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' },
    { id: CABANA, name: 'Cabana Muntele Mic', city: null },
  ])
  vi.mocked(getSelectableLocations).mockResolvedValue([])
  vi.mocked(getCursBnr).mockResolvedValue({ date: '2026-09-19', eur_ron_millionths: 5073100 })
  vi.mocked(incarcaRegulamentFisier).mockResolvedValue({
    storagePath: 'id/uuid.pdf',
    name: 'regulament.pdf',
    contentType: 'application/pdf',
    sizeBytes: 12,
  })
  vi.mocked(stergeRegulamentFisier).mockResolvedValue(undefined)
}
