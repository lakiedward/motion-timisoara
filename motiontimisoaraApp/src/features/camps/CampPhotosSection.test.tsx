import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CampPhotosSection from './CampPhotosSection'

const api = vi.hoisted(() => ({
  getPozeGalerie: vi.fn(),
  stergePozaGalerie: vi.fn(),
}))

vi.mock('@/api/camp-photos', () => ({
  schimbaPozaHero: vi.fn(),
  urlPublic: (cale: string) => `https://cdn.test/${cale}`,
}))

vi.mock('@/api/photo-gallery', async (orig) => ({
  ...(await orig<typeof import('@/api/photo-gallery')>()),
  adaugaPozeGalerie: vi.fn(),
  getPozeGalerie: api.getPozeGalerie,
  mutaPozaGalerie: vi.fn(),
  schimbaDescrierePoza: vi.fn(),
  stergePozaGalerie: api.stergePozaGalerie,
}))

const poze = [
  {
    id: 'a',
    url: 'https://cdn.test/a.jpg',
    storage_path: 'a.jpg',
    display_order: 0,
    caption: null,
  },
  {
    id: 'b',
    url: 'https://cdn.test/b.jpg',
    storage_path: 'b.jpg',
    display_order: 1,
    caption: 'Focul de tabără',
  },
]

function afiseaza() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CampPhotosSection campId="c1" heroCale="hero.jpg" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.getPozeGalerie.mockReset()
  api.stergePozaGalerie.mockReset()
})

test('ștergerea cere confirmare înainte să scoată poza', async () => {
  api.getPozeGalerie.mockResolvedValue(poze)
  api.stergePozaGalerie.mockResolvedValue(undefined)
  const user = userEvent.setup()
  afiseaza()
  await user.click(await screen.findByRole('button', { name: 'Șterge poza 2' }))
  expect(api.stergePozaGalerie).not.toHaveBeenCalled()
  const dialog = screen.getByRole('alertdialog', { name: 'Ștergi poza 2?' })
  await user.click(within(dialog).getByRole('button', { name: 'Șterge poza' }))
  expect(api.stergePozaGalerie).toHaveBeenCalledWith(
    expect.objectContaining({ tabel: 'camp_photos', id: 'c1' }),
    poze[1],
  )
})

test('arată contorul, poza din cap și săgețile dezactivate la capete', async () => {
  api.getPozeGalerie.mockResolvedValue(poze)
  afiseaza()
  expect(await screen.findByText('2 din 12 poze')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Poza din capul paginii' })).toHaveAttribute(
    'src',
    'https://cdn.test/hero.jpg',
  )
  expect(screen.getByRole('button', { name: 'Schimbă poza' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mută poza 1 mai devreme' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Mută poza 2 mai târziu' })).toBeDisabled()
  expect(screen.getByRole('list', { name: 'Pozele din galerie' })).toHaveClass('grid-cols-2')
})

test('galeria goală spune că nu există poze', async () => {
  api.getPozeGalerie.mockResolvedValue([])
  afiseaza()
  expect(await screen.findByText('Nu există încă poze în galerie.')).toBeInTheDocument()
})

test('o eroare la încărcare arată Reîncearcă', async () => {
  api.getPozeGalerie.mockRejectedValueOnce(new Error('x')).mockResolvedValue(poze)
  const user = userEvent.setup()
  afiseaza()
  const alerta = await screen.findByRole('alert')
  expect(alerta).toHaveTextContent('Nu am putut încărca pozele.')
  await user.click(within(alerta).getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('2 din 12 poze')).toBeInTheDocument()
})

test('tabăra are descrieri și cere acordul părinților înainte de încărcare', async () => {
  api.getPozeGalerie.mockResolvedValue(poze)
  const user = userEvent.setup()
  afiseaza()
  expect(await screen.findByRole('textbox', { name: 'Descrierea pozei 2' })).toHaveValue(
    'Focul de tabără',
  )
  const buton = screen.getByRole('button', { name: 'Adaugă poze' })
  expect(buton).toBeDisabled()
  await user.click(screen.getByRole('checkbox', { name: /acordul scris al părinților/ }))
  expect(buton).toBeEnabled()
})
