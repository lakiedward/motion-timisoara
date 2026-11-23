import './camp-form-page-mocks'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { toast } from 'sonner'

import {
  CampDeletedError,
  getCategoriile,
  getPreturilePeVarsta,
  getTabaraDeEditat,
  listeazaSabloaneTabara,
  salveazaSablonTabara,
  saveCampOffer,
  stergeTabara,
} from '@/api/camps-admin'
import { schimbaPozaHero } from '@/api/camp-photos'
import { pickSelectMenuValue } from '@/test/select-menu'
import {
  CABANA,
  PORTALE,
  TABARA,
  completeazaCategorie,
  completeazaDetalii,
  configureCampFormMocks,
  laCosturi,
  laVerificare,
  randuriCategorii,
  renderForm,
} from './camp-form-page-helpers'

beforeEach(configureCampFormMocks)

test('la creare, „Salvează și ca șablon” salvează șablonul după tabără', async () => {
  vi.mocked(listeazaSabloaneTabara).mockResolvedValue([])
  vi.mocked(salveazaSablonTabara).mockResolvedValue('sablon-nou')
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  await completeazaCategorie(user, randuriCategorii()[0], '6', '8', [
    { name: 'Cazare', lei: '400' },
  ])
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Verificare' })
  await user.click(screen.getByRole('checkbox', { name: 'Salvează și ca șablon' }))
  expect(screen.getByLabelText('Numele șablonului')).toHaveValue('Tabără de înot')
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(salveazaSablonTabara).toHaveBeenCalled())
  expect(vi.mocked(saveCampOffer).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(salveazaSablonTabara).mock.invocationCallOrder[0],
  )
  const [owner, sablon] = vi.mocked(salveazaSablonTabara).mock.calls[0]
  expect(owner).toEqual({ clubId: 'club-1', coachUserId: null })
  expect(sablon).toMatchObject({ name: 'Tabără de înot' })
  expect(sablon).not.toHaveProperty('period_start')
})

test('fără bifă, crearea taberei nu salvează niciun șablon', async () => {
  vi.mocked(listeazaSabloaneTabara).mockResolvedValue([])
  const user = userEvent.setup()
  renderForm()
  await laCosturi(user)
  await completeazaCategorie(user, randuriCategorii()[0], '6', '8', [
    { name: 'Cazare', lei: '400' },
  ])
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Verificare' })
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(saveCampOffer).toHaveBeenCalled())
  expect(salveazaSablonTabara).not.toHaveBeenCalled()
})

test('retry after an uncertain save reuses the camp identity and complete offer', async () => {
  const user = userEvent.setup()
  vi.mocked(saveCampOffer).mockRejectedValueOnce(new Error('Răspuns pierdut'))
  renderForm()
  await laVerificare(user)
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Răspuns pierdut'))
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(saveCampOffer).toHaveBeenCalledTimes(2))
  expect(vi.mocked(saveCampOffer).mock.calls[0]).toEqual(vi.mocked(saveCampOffer).mock.calls[1])
})

test('retry after removing a camp with a failed hero upload creates it with a fresh ID', async () => {
  const user = userEvent.setup()
  vi.mocked(schimbaPozaHero).mockRejectedValueOnce(new Error('Încărcarea a eșuat'))
  renderForm()
  await laVerificare(user)
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Fără poza din capul paginii tabăra nu se salvează.'),
  )
  const firstId = vi.mocked(saveCampOffer).mock.calls[0][0]
  expect(stergeTabara).toHaveBeenCalledWith(firstId)
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(saveCampOffer).toHaveBeenCalledTimes(2))
  expect(vi.mocked(saveCampOffer).mock.calls[1][0]).not.toBe(firstId)
})

test('a lost rollback response keeps the ID until the database confirms deletion', async () => {
  const user = userEvent.setup()
  vi.mocked(schimbaPozaHero).mockRejectedValueOnce(new Error('Încărcarea a eșuat'))
  vi.mocked(stergeTabara).mockRejectedValueOnce(new Error('Răspuns pierdut'))
  vi.mocked(saveCampOffer)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new CampDeletedError())
  renderForm()
  await laVerificare(user)
  const create = () => user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await create()
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Răspuns pierdut'))
  await create()
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      'Salvarea anterioară a fost anulată. Apasă din nou pe „Creează tabăra”.',
    ),
  )
  await create()
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Tabără creată.'))
  const [initial, uncertain, retry] = vi.mocked(saveCampOffer).mock.calls
  expect(uncertain).toEqual(initial)
  expect(retry[0]).not.toBe(initial[0])
  expect(retry.slice(1)).toEqual(initial.slice(1))
})

test('creation keeps the original ID if someone else deleted the camp after an uncertain save', async () => {
  const user = userEvent.setup()
  vi.mocked(saveCampOffer)
    .mockRejectedValueOnce(new Error('Răspuns pierdut'))
    .mockRejectedValue(new CampDeletedError())
  renderForm()
  await laVerificare(user)
  const create = () => user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await create()
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Răspuns pierdut'))
  await create()
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Tabăra a fost ștearsă. Revino la lista de tabere.'),
  )
  await create()
  await waitFor(() => expect(saveCampOffer).toHaveBeenCalledTimes(3))
  const [initial, uncertain, retry] = vi.mocked(saveCampOffer).mock.calls
  expect(uncertain).toEqual(initial)
  expect(retry).toEqual(initial)
  expect(stergeTabara).not.toHaveBeenCalled()
})

test('salvarea trimite location_id, regulamentul și necesar fără preț global', async () => {
  const user = userEvent.setup()
  renderForm()
  await completeazaDetalii(user)
  const select = await screen.findByLabelText('Loc')
  await pickSelectMenuValue(select, CABANA)
  await user.type(screen.getByLabelText('Detalii despre loc'), 'Intrarea din spate')
  fireEvent.change(screen.getByLabelText('Regulamentul taberei'), {
    target: { value: 'Fără telefoane.' },
  })
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Categorii și costuri' })
  await completeazaCategorie(user, randuriCategorii()[0], '6', '8', [
    { name: 'Cazare', lei: '400' },
  ])
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Verificare' })
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(saveCampOffer).toHaveBeenCalled())
  expect(vi.mocked(saveCampOffer).mock.calls[0][1]).toBe(0)
  expect(vi.mocked(saveCampOffer).mock.calls[0][6]).toMatchObject({
    location_id: CABANA,
    location_text: 'Intrarea din spate',
    rules: 'Fără telefoane.',
  })
})

test('la editare, Salvează tabăra actualizează oferta existentă', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({ ...TABARA, pricing_mode: 'by_age' } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([
    {
      id: 'p1',
      camp_id: 'tabara-1',
      age_from: 6,
      age_to: 8,
      amount: 70000,
      display_order: 0,
      created_at: '',
      components: [{ name: 'Cazare', amount: 70000 }],
    },
  ] as never)
  renderForm('/club/camps/tabara-1/edit')
  await waitFor(() => expect(screen.getByLabelText(/^Titlu/)).toHaveValue('Tabără de înot'))
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Categorii și costuri' })
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Verificare' })
  await user.click(screen.getByRole('button', { name: 'Salvează tabăra' }))
  await waitFor(() => expect(saveCampOffer).toHaveBeenCalled())
  expect(vi.mocked(saveCampOffer).mock.calls[0][0]).toBe('tabara-1')
  expect(toast.success).toHaveBeenCalledWith('Tabără actualizată.')
})

test.each(PORTALE)(
  'pe %s, un link de tabără inexistent arată „Tabăra nu a fost găsită.”',
  async (baza) => {
    vi.mocked(getTabaraDeEditat).mockResolvedValue(null)
    renderForm(`${baza}/lipsa/edit`)
    expect(await screen.findByText('Tabăra nu a fost găsită.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Înapoi la tabere/ })).toHaveAttribute('href', baza)
    expect(screen.queryByRole('heading', { name: 'Editează tabăra' })).not.toBeInTheDocument()
  },
)

test('dacă tabăra nu se poate citi, Reîncearcă repetă citirea', async () => {
  vi.mocked(getTabaraDeEditat).mockRejectedValueOnce(new Error('retea'))
  renderForm('/club/camps/tabara-1/edit')
  expect(await screen.findByText('Nu am putut încărca tabăra.')).toBeInTheDocument()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({ ...TABARA } as never)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByRole('heading', { name: 'Editează tabăra' })).toBeInTheDocument()
})
