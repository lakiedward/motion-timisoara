import './camp-form-page-mocks'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { toast } from 'sonner'

import { getCategoriile, getPreturilePeVarsta, getTabaraDeEditat, saveCampOffer } from '@/api/camps-admin'
import { incarcaRegulamentFisier, stergeRegulamentFisier } from '@/api/camp-rules-file'
import {
  TABARA,
  completeazaCategorie,
  completeazaDetalii,
  configureCampFormMocks,
  randuriCategorii,
  renderForm,
} from './camp-form-page-helpers'

beforeEach(configureCampFormMocks)

test('la editare, necesarul salvat poate primi categorii și articole numerotate', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    camp_requirements: [{ name: 'Haine', items: [{ name: 'Chiloți', quantity: 7 }] }],
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')

  await waitFor(() => expect(screen.getByLabelText(/^Categorie\*?$/)).toHaveValue('Haine'))
  expect(screen.getByLabelText(/^Articol\*?$/)).toHaveValue('Chiloți')
  expect(screen.getByLabelText(/^Număr\*?$/)).toHaveValue(7)
  expect(screen.getByRole('heading', { level: 3, name: /Haine/ })).toHaveTextContent(
    'Haine · 1 articol',
  )
  await user.click(screen.getByRole('button', { name: 'Adaugă categorie' }))
  expect(screen.getAllByLabelText(/^Articol\*?$/)).toHaveLength(2)
  expect(screen.getAllByLabelText(/^Număr\*?$/)[1]).toHaveValue(1)
  await user.type(screen.getAllByLabelText(/^Categorie\*?$/)[1], 'Ski')
  await user.type(screen.getAllByLabelText(/^Articol\*?$/)[1], 'Schiuri')
  expect(screen.getByRole('heading', { level: 3, name: /Ski/ })).toHaveTextContent(
    'Ski · 1 articol',
  )
  expect(screen.getByRole('button', { name: 'Șterge articolul 1, categoria 2' })).toBeDisabled()
})

test('ștergerea unei categorii cu articole cere confirmare', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    camp_requirements: [{ name: 'Haine', items: [{ name: 'Chiloți', quantity: 7 }] }],
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')

  await waitFor(() => expect(screen.getByLabelText(/^Categorie\*?$/)).toHaveValue('Haine'))
  await user.click(screen.getByRole('button', { name: 'Șterge categoria 1' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Ștergi categoria „Haine”?' })
  await user.click(within(dialog).getByRole('button', { name: 'Anulează' }))
  expect(screen.getByLabelText(/^Categorie\*?$/)).toHaveValue('Haine')
  await user.click(screen.getByRole('button', { name: 'Șterge categoria 1' }))
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'Șterge categoria',
    }),
  )
  expect(screen.queryByLabelText(/^Categorie\*?$/)).not.toBeInTheDocument()
  expect(screen.getByText(/Lista e goală/)).toBeInTheDocument()
})

test('o categorie nouă, încă goală, se șterge fără confirmare', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.click(await screen.findByRole('button', { name: 'Adaugă categorie' }))
  await user.click(screen.getByRole('button', { name: 'Șterge categoria 1' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/^Categorie\*?$/)).not.toBeInTheDocument()
})

test('regulamentul arată câte caractere mai are până la limită', async () => {
  renderForm()
  fireEvent.change(await screen.findByLabelText('Regulamentul taberei'), {
    target: { value: 'Fără telefoane.' },
  })
  expect(screen.getByText('15 din 8.000 de caractere')).toBeInTheDocument()
})

test('regulamentul se păstrează în draft când revii de pe costuri', async () => {
  const user = userEvent.setup()
  renderForm()
  await completeazaDetalii(user)
  fireEvent.change(screen.getByLabelText('Regulamentul taberei'), {
    target: { value: 'Fără telefoane.\nFără dulciuri seara.' },
  })
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Categorii și costuri' })
  await user.click(screen.getByRole('button', { name: 'Înapoi' }))
  expect(screen.getByLabelText('Regulamentul taberei')).toHaveValue(
    'Fără telefoane.\nFără dulciuri seara.',
  )
})

test('la editare, regulamentul salvat revine în formular', async () => {
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    rules: 'Fără telefoane.',
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')
  await waitFor(() =>
    expect(screen.getByLabelText('Regulamentul taberei')).toHaveValue('Fără telefoane.'),
  )
})

test('un video e refuzat pe loc, fără urcare', async () => {
  renderForm()
  const film = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
  fireEvent.change(screen.getByLabelText('Fișierul regulamentului'), {
    target: { files: [film] },
  })
  expect(toast.error).toHaveBeenCalledWith('Fișierul trebuie să fie PDF, imagine, Word sau Excel.')
  expect(incarcaRegulamentFisier).not.toHaveBeenCalled()
  expect(screen.queryByText(/clip.mp4/)).not.toBeInTheDocument()
})

test('la creare, fișierul PDF se urcă după salvare cu același id', async () => {
  const user = userEvent.setup()
  const pdf = new File(['x'.repeat(12)], 'regulament.pdf', { type: 'application/pdf' })
  renderForm()
  await completeazaDetalii(user)
  await user.upload(screen.getByLabelText('Fișierul regulamentului'), pdf)
  expect(screen.getByText('regulament.pdf')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Categorii și costuri' })
  await completeazaCategorie(user, randuriCategorii()[0], '6', '8', [
    { name: 'Cazare', lei: '400' },
  ])
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
  await screen.findByRole('heading', { name: 'Verificare' })
  expect(screen.getByText(/Fișier: regulament.pdf/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Creează tabăra' }))
  await waitFor(() => expect(saveCampOffer).toHaveBeenCalled())
  await waitFor(() => expect(incarcaRegulamentFisier).toHaveBeenCalled())
  expect(vi.mocked(incarcaRegulamentFisier).mock.calls[0][0]).toBe(
    vi.mocked(saveCampOffer).mock.calls[0][0],
  )
  expect(vi.mocked(incarcaRegulamentFisier).mock.calls[0][1]).toBe(pdf)
})

test('la editare, fișierul salvat se vede lângă text', async () => {
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    rules: 'Fără telefoane.',
    rules_file_storage_path: 'tabara-1/uuid.pdf',
    rules_file_name: 'regulament-tabara.pdf',
    rules_file_content_type: 'application/pdf',
    rules_file_size_bytes: 2048,
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')
  await screen.findByText('regulament-tabara.pdf')
  expect(screen.getByText(/PDF · 2 KB/)).toBeInTheDocument()
})

test('la editare, un PDF se urcă imediat, fără să aștepte salvarea', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({ ...TABARA } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')
  await screen.findByLabelText('Regulamentul taberei')
  const pdf = new File(['x'.repeat(12)], 'regulament.pdf', { type: 'application/pdf' })
  await user.upload(screen.getByLabelText('Fișierul regulamentului'), pdf)
  await waitFor(() => expect(incarcaRegulamentFisier).toHaveBeenCalledWith('tabara-1', pdf))
  expect(saveCampOffer).not.toHaveBeenCalled()
})

test('la editare, ștergerea fișierului actualizează rândul fără salvarea formularului', async () => {
  const user = userEvent.setup()
  vi.mocked(getTabaraDeEditat).mockResolvedValue({
    ...TABARA,
    rules_file_storage_path: 'tabara-1/uuid.pdf',
    rules_file_name: 'regulament-tabara.pdf',
    rules_file_content_type: 'application/pdf',
    rules_file_size_bytes: 2048,
  } as never)
  vi.mocked(getCategoriile).mockResolvedValue([])
  vi.mocked(getPreturilePeVarsta).mockResolvedValue([])
  renderForm('/club/camps/tabara-1/edit')
  await screen.findByText('regulament-tabara.pdf')
  await user.click(screen.getByRole('button', { name: 'Șterge fișierul' }))
  expect(stergeRegulamentFisier).not.toHaveBeenCalled()
  const dialog = await screen.findByRole('alertdialog', { name: 'Ștergi fișierul regulamentului?' })
  await user.click(within(dialog).getByRole('button', { name: 'Șterge fișierul' }))
  await waitFor(() => expect(stergeRegulamentFisier).toHaveBeenCalledWith('tabara-1'))
  expect(saveCampOffer).not.toHaveBeenCalled()
})
