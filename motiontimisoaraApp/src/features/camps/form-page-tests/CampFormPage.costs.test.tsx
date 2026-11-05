import './camp-form-page-mocks'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { toast } from 'sonner'

import {
  getCategoriile,
  getPreturilePeVarsta,
  getTabaraDeEditat,
  getTaberelemele,
  saveCampOffer,
} from '@/api/camps-admin'
import { getCursBnr } from '@/api/bnr-rate'
import { pickSelectMenuValue, selectMenuOptionLabels } from '@/test/select-menu'
import {
  TABARA,
  completeazaCategorie,
  configureCampFormMocks,
  laCosturi,
  randuriCategorii,
  renderForm,
} from './camp-form-page-helpers'

beforeEach(configureCampFormMocks)

test('componentele adună totalul, iar Înapoi păstrează draftul', async () => {
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  const prima = randuriCategorii()[0]
  await completeazaCategorie(user, prima, '6', '8', [
    { name: 'Cazare', lei: '400' },
    { name: 'Masă', lei: '200' },
    { name: 'Antrenamente', lei: '100' },
  ])
  expect(within(prima).getByRole('status')).toHaveTextContent(/Total 700,00 lei/)
  await user.click(screen.getByRole('button', { name: 'Înapoi' }))
  expect(screen.getByLabelText(/^Titlu/)).toHaveValue('Tabără de înot')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(screen.getByLabelText('De la (ani)')).toHaveValue(6)
  expect(screen.getByDisplayValue('Cazare')).toBeInTheDocument()
  expect(screen.getAllByRole('status')[0]).toHaveTextContent(/Total 700,00 lei/)
})

test('Marchează gratuit pune categoria pe zero', async () => {
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  expect(screen.getByText('Tarif adult')).toBeInTheDocument()
  expect(screen.getByLabelText('Componentă adult')).toHaveValue('Participare')
  expect(screen.getByLabelText(/Sumă adult/)).toHaveValue(0)
  const prima = randuriCategorii()[0]
  await completeazaCategorie(user, prima, '0', '2', [{ name: 'Cazare', lei: '50' }])
  await user.click(within(prima).getByRole('button', { name: 'Marchează gratuit' }))
  expect(await within(prima).findByDisplayValue('Participare')).toBeInTheDocument()
  expect(within(prima).getByLabelText(/Sumă \(/)).toHaveValue(0)
  expect(within(prima).getByRole('status')).toHaveTextContent(/Total Gratuit/)
})

test('două intervale care se suprapun opresc avansul și numesc perechea', async () => {
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  await completeazaCategorie(user, randuriCategorii()[0], '6', '8', [
    { name: 'Cazare', lei: '700' },
  ])
  await user.click(screen.getByRole('button', { name: 'Adaugă o categorie de vârstă' }))
  const randuri = randuriCategorii()
  await completeazaCategorie(user, randuri[randuri.length - 1], '8', '10', [
    { name: 'Cazare', lei: '800' },
  ])
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Categoria 6–8 ani se suprapune cu 8–10 ani',
  )
  expect(screen.getByRole('heading', { name: 'Categorii și costuri' })).toBeInTheDocument()
})

test('EUR citește cursul BNR, iar verificarea arată componentele și totalul', async () => {
  let elibereaza!: (value: { date: string; eur_ron_millionths: number }) => void
  vi.mocked(getCursBnr).mockReturnValue(
    new Promise((resolve) => {
      elibereaza = resolve
    }),
  )
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Se citește cursul BNR…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continuă' })).toBeDisabled()
  elibereaza({ date: '2026-09-19', eur_ron_millionths: 5123456 })
  expect(await screen.findByText('Curs BNR din 19.09.2026: 5,123456 lei/EUR')).toBeInTheDocument()
  expect(screen.queryByLabelText('Cursul tău: 1 EUR în lei')).not.toBeInTheDocument()
  await completeazaCategorie(user, randuriCategorii()[0], '6', '12', [
    { name: 'Cazare', lei: '100' },
    { name: 'Masă', lei: '23.45' },
  ])
  await user.click(screen.getByRole('button', { name: 'Adaugă o categorie de vârstă' }))
  const randuri = randuriCategorii()
  await completeazaCategorie(user, randuri[randuri.length - 1], '13', '16', [
    { name: 'Cazare', lei: '150' },
  ])
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Verificare' })
  expect(screen.getByText('EUR, curs BNR 5,123456 lei')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Adult' })).toBeInTheDocument()
  expect(screen.getByText('6–12 ani')).toBeInTheDocument()
  expect(screen.getAllByText('Cazare').length).toBeGreaterThan(0)
  expect(screen.getByText('Masă')).toBeInTheDocument()
  expect(screen.getByText('123,45 EUR')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(saveCampOffer).toHaveBeenCalled())
  expect(vi.mocked(saveCampOffer).mock.calls[0][1]).toBe(0)
  expect(vi.mocked(saveCampOffer).mock.calls[0][2]).toEqual([])
  expect(vi.mocked(saveCampOffer).mock.calls[0][3]).toEqual({
    currency: 'EUR',
    eur_ron_rate_micros: 5123456,
  })
  expect(vi.mocked(saveCampOffer).mock.calls[0][4]).toBe('by_age')
  expect(vi.mocked(saveCampOffer).mock.calls[0][5]).toEqual([
    {
      age_from: 6,
      age_to: 12,
      amount: 12345,
      components: [
        { name: 'Cazare', amount: 10000 },
        { name: 'Masă', amount: 2345 },
      ],
    },
    {
      age_from: 13,
      age_to: 16,
      amount: 15000,
      components: [{ name: 'Cazare', amount: 15000 }],
    },
  ])
  expect(vi.mocked(saveCampOffer).mock.calls[0][8]).toEqual({
    amount: 0,
    components: [{ name: 'Participare', amount: 0 }],
  })
  expect(toast.success).toHaveBeenCalledWith('Tabără creată.')
})

test('fără curs BNR, EUR blochează avansul și oferă reîncercare', async () => {
  vi.mocked(getCursBnr).mockRejectedValue(new Error('Nu am putut citi cursul BNR. Reîncearcă.'))
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  await user.click(screen.getByRole('radio', { name: 'Euro (EUR)' }))
  expect(await screen.findByText('Nu am putut citi cursul BNR. Reîncearcă.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continuă' })).toBeDisabled()
  expect(screen.queryByLabelText('Cursul tău: 1 EUR în lei')).not.toBeInTheDocument()
  vi.mocked(getCursBnr).mockResolvedValue({ date: '2026-09-19', eur_ron_millionths: 5073100 })
  await user.click(screen.getByRole('button', { name: 'Reîncearcă cursul BNR' }))
  expect(await screen.findByText('Curs BNR din 19.09.2026: 5,0731 lei/EUR')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continuă' })).toBeEnabled()
})

test('editing preserves EUR on the cost step', async () => {
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    currency: 'EUR',
    eur_ron_rate_micros: 5123456,
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  vi.mocked(getCursBnr).mockResolvedValue({ date: '2026-09-19', eur_ron_millionths: 5073100 })
  renderForm('/club/camps/tabara-1/edit')
  await waitFor(() => expect(screen.getByLabelText(/^Titlu/)).toHaveValue('Tabără de înot'))
  await userEvent.setup().click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Categorii și costuri' })
  expect(screen.getByRole('radio', { name: 'Euro (EUR)' })).toBeChecked()
  expect(await screen.findByText('Curs BNR din 19.09.2026: 5,0731 lei/EUR')).toBeInTheDocument()
  expect(screen.queryByLabelText('Cursul tău: 1 EUR în lei')).not.toBeInTheDocument()
})

test('la editare, categoriile salvate revin ca o componentă, iar copiază din le înlocuiește', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({ ...TABARA, pricing_mode: 'by_age' } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockImplementation(async (campId) =>
    campId === 'tabara-1'
      ? ([
          {
            id: 'p1',
            camp_id: 'tabara-1',
            age_from: 6,
            age_to: 8,
            amount: 70000,
            display_order: 0,
            created_at: '',
            components: [
              { name: 'Cazare', amount: 40000 },
              { name: 'Masă', amount: 30000 },
            ],
          },
        ] as never)
      : ([
          {
            id: 'p2',
            camp_id: 'tabara-2',
            age_from: 7,
            age_to: 9,
            amount: 65000,
            display_order: 0,
            created_at: '',
          },
          {
            id: 'p3',
            camp_id: 'tabara-2',
            age_from: 10,
            age_to: 14,
            amount: 85000,
            display_order: 1,
            created_at: '',
          },
        ] as never),
  )
  vi.mocked(getTaberelemele).mockResolvedValue([
    { ...TABARA, id: 'tabara-1', pricing_mode: 'by_age' },
    { ...TABARA, id: 'tabara-2', title: 'Tabăra de anul trecut', pricing_mode: 'by_age' },
    { ...TABARA, id: 'tabara-3', title: 'Tabără cu preț unic', pricing_mode: 'single' },
  ] as never)

  renderForm('/club/camps/tabara-1/edit')
  await waitFor(() => expect(screen.getByLabelText(/^Titlu/)).toHaveValue('Tabără de înot'))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  const lista = await screen.findByRole('list', { name: 'Categorii de vârstă' })
  expect(within(lista).getByDisplayValue('Cazare')).toBeInTheDocument()
  expect(within(lista).getByDisplayValue('Masă')).toBeInTheDocument()
  expect(within(lista).getAllByLabelText(/Sumă \(/)[0]).toHaveValue(400)
  expect(within(lista).getAllByRole('status')[0]).toHaveTextContent(/Total 700,00 lei/)
  const select = await screen.findByLabelText('Copiază categoriile din altă tabără')
  expect(select).toHaveTextContent('alege o tabără…')
  expect(await selectMenuOptionLabels(select)).toEqual(['Tabăra de anul trecut'])

  await pickSelectMenuValue(select, 'tabara-2')
  await waitFor(() => expect(within(lista).getAllByLabelText('De la (ani)')).toHaveLength(2))
  expect(getPreturilePeVarsta).toHaveBeenCalledWith('tabara-2')
  const sume = within(lista).getAllByLabelText(/Sumă \(/)
  expect(sume[0]).toHaveValue(650)
  expect(sume[1]).toHaveValue(850)
})
