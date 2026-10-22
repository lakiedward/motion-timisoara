import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CampPhotosSection from './CampPhotosSection'

const api = vi.hoisted(() => ({
  getPozeleTaberei: vi.fn(),
  stergeDinGalerie: vi.fn(),
}))

vi.mock('@/api/camp-photos', () => ({
  MAX_POZE_GALERIE: 12,
  adaugaInGalerie: vi.fn(),
  getPozeleTaberei: api.getPozeleTaberei,
  mutaInGalerie: vi.fn(),
  schimbaPozaHero: vi.fn(),
  stergeDinGalerie: api.stergeDinGalerie,
  urlPublic: (cale: string) => `https://cdn.test/${cale}`,
}))

const poze = [
  { id: 'a', url: 'https://cdn.test/a.jpg', storage_path: 'a.jpg', position: 0 },
  { id: 'b', url: 'https://cdn.test/b.jpg', storage_path: 'b.jpg', position: 1 },
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
  api.getPozeleTaberei.mockReset()
  api.stergeDinGalerie.mockReset()
})

test('ștergerea cere confirmare înainte să scoată poza', async () => {
  api.getPozeleTaberei.mockResolvedValue(poze)
  api.stergeDinGalerie.mockResolvedValue(undefined)
  const user = userEvent.setup()
  afiseaza()
  await user.click(await screen.findByRole('button', { name: 'Șterge poza 2' }))
  expect(api.stergeDinGalerie).not.toHaveBeenCalled()
  const dialog = screen.getByRole('alertdialog', { name: 'Ștergi poza 2?' })
  await user.click(within(dialog).getByRole('button', { name: 'Șterge poza' }))
  expect(api.stergeDinGalerie).toHaveBeenCalledWith(poze[1])
})

test('arată contorul, poza din cap și săgețile dezactivate la capete', async () => {
  api.getPozeleTaberei.mockResolvedValue(poze)
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
  api.getPozeleTaberei.mockResolvedValue([])
  afiseaza()
  expect(await screen.findByText('Nu există încă poze în galerie.')).toBeInTheDocument()
})

test('o eroare la încărcare arată Reîncearcă', async () => {
  api.getPozeleTaberei.mockRejectedValueOnce(new Error('x')).mockResolvedValue(poze)
  const user = userEvent.setup()
  afiseaza()
  const alerta = await screen.findByRole('alert')
  expect(alerta).toHaveTextContent('Nu am putut încărca pozele.')
  await user.click(within(alerta).getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText('2 din 12 poze')).toBeInTheDocument()
})
