import './camp-form-page-mocks'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import {
  getCategoriile,
  getPreturilePeVarsta,
  getTabaraDeEditat,
} from '@/api/camps-admin'
import { getClubSelectableLocations } from '@/api/club'
import { getSelectableLocations } from '@/api/coach'
import { selectMenuOptionLabels } from '@/test/select-menu'
import { pickerValue, setPickerValue } from '@/test/pickers'
import { BAZIN, PORTALE, TABARA, configureCampFormMocks, renderForm } from './camp-form-page-helpers'

beforeEach(configureCampFormMocks)

test('draftul pornește pe Detalii, fără preț global', () => {
  renderForm()
  expect(screen.getByRole('heading', { name: 'Detalii' })).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Pașii formularului' })).toHaveTextContent(
    '1Detalii2Categorii și costuri3Verificare',
  )
  expect(screen.queryByLabelText(/Prețul taberei/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Draft local/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Creează tabăra' })).not.toBeInTheDocument()
})

test('Continuă arată deodată erorile din Detalii și poza lipsă, cu focus pe primul câmp', async () => {
  const user = userEvent.setup()
  renderForm()
  expect(screen.getByText(/sunt obligatorii/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  const titlu = screen.getByLabelText(/^Titlu/)
  await waitFor(() => expect(titlu).toHaveFocus())
  expect(screen.getAllByText('Minim 3 caractere').length).toBeGreaterThan(0)
  const poza = document.getElementById('camp-hero') as HTMLElement
  expect(within(poza).getByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Detalii' })).toBeInTheDocument()
})

test('după Continuă cu erori, mesajul dispare imediat ce titlul devine corect', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  const titlu = screen.getByLabelText(/^Titlu/)
  await waitFor(() => expect(titlu).toHaveAttribute('aria-invalid', 'true'))
  await user.type(titlu, 'Tabăra de vară')
  await waitFor(() => expect(titlu).toHaveAttribute('aria-invalid', 'false'))
})

test('tabăra alege locul din locațiile clubului', async () => {
  renderForm()
  const select = await screen.findByLabelText('Loc')
  await waitFor(() => expect(getClubSelectableLocations).toHaveBeenCalled())
  expect(await selectMenuOptionLabels(select)).toEqual([
    '— fără loc ales —',
    'Bazin Olimpic Timișoara · Timișoara',
    'Cabana Muntele Mic',
  ])
  expect(getClubSelectableLocations).toHaveBeenCalledWith('club-1', null)
  expect(getSelectableLocations).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: /Adaugă o locație nouă/ })).toHaveAttribute(
    'href',
    '/club/locations/new',
  )
})

test('la editare, locul salvat apare selectat chiar dacă lista vine după tabără', async () => {
  vi.mocked(getTabaraDeEditat).mockResolvedValue({ ...TABARA, location_id: BAZIN } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  vi.mocked(getClubSelectableLocations).mockImplementation(
    () =>
      new Promise((r) =>
        setTimeout(
          () => r([{ id: BAZIN, name: 'Bazin Olimpic Timișoara', city: 'Timișoara' }]),
          40,
        ),
      ),
  )

  renderForm('/club/camps/tabara-1/edit')
  await waitFor(() => expect(screen.getByLabelText(/^Titlu/)).toHaveValue('Tabără de înot'))
  await waitFor(() => expect(screen.getByLabelText('Loc')).toHaveTextContent('Bazin Olimpic'))
  expect(getClubSelectableLocations).toHaveBeenCalledWith('club-1', BAZIN)
})

test.each(PORTALE)(
  'perioada pe %s arată durata inclusiv și o scurtătură mută sfârșitul',
  async (baza) => {
    const user = userEvent.setup()
    renderForm(`${baza}/new`)
    expect(screen.getByText('Perioada taberei')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7 zile' })).toBeDisabled()
    setPickerValue(screen.getByLabelText(/^Începe/), '2027-07-10')
    expect(pickerValue(screen.getByLabelText(/^Se termină/))).toBe('2027-07-10')
    expect(screen.getByText(/· 1 zi/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '7 zile' }))
    expect(pickerValue(screen.getByLabelText(/^Se termină/))).toBe('2027-07-16')
    expect(screen.getByText(/· 7 zile/)).toBeInTheDocument()
  },
)

test.each(PORTALE)('un început după sfârșit pe %s mută sfârșitul pe aceeași zi', (baza) => {
  renderForm(`${baza}/new`)
  setPickerValue(screen.getByLabelText(/^Începe/), '2027-07-10')
  setPickerValue(screen.getByLabelText(/^Se termină/), '2027-07-12')
  setPickerValue(screen.getByLabelText(/^Începe/), '2027-07-18')
  expect(pickerValue(screen.getByLabelText(/^Se termină/))).toBe('2027-07-18')
  expect(screen.getByText(/· 1 zi/)).toBeInTheDocument()
})

test.each(PORTALE)('la editare pe %s, intervalul salvat arată durata inclusivă', async (baza) => {
  vi.mocked(getTabaraDeEditat).mockResolvedValue(TABARA as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm(`${baza}/tabara-1/edit`)
  await waitFor(() => expect(screen.getByLabelText(/^Titlu/)).toHaveValue('Tabără de înot'))
  expect(pickerValue(screen.getByLabelText(/^Începe/))).toBe('2026-09-13')
  expect(pickerValue(screen.getByLabelText(/^Se termină/))).toBe('2026-09-20')
  expect(screen.getByText(/· 8 zile/)).toBeInTheDocument()
})

test('fără titlu, pasul Detalii nu avansează', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findAllByText('Minim 3 caractere')).not.toHaveLength(0)
  expect(screen.getByRole('heading', { name: 'Detalii' })).toBeInTheDocument()
})
