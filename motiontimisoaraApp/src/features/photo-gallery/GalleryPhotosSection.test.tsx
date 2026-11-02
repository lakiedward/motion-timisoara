import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import GalleryPhotosSection from './GalleryPhotosSection'

const api = vi.hoisted(() => ({
  getPozeGalerie: vi.fn(),
  schimbaDescrierePoza: vi.fn(),
}))

vi.mock('@/api/photo-gallery', async (orig) => ({
  ...(await orig<typeof import('@/api/photo-gallery')>()),
  adaugaPozeGalerie: vi.fn(),
  getPozeGalerie: api.getPozeGalerie,
  mutaPozaGalerie: vi.fn(),
  schimbaDescrierePoza: api.schimbaDescrierePoza,
  stergePozaGalerie: vi.fn(),
}))

const poze = [
  {
    id: 'a',
    url: 'https://cdn.test/a.jpg',
    storage_path: 'a.jpg',
    display_order: 0,
    caption: 'Încălzirea',
  },
]

function afiseaza(id: string | null = 'c1', fel: 'curs' | 'activitate' = 'curs') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <form onSubmit={(e) => e.preventDefault()}>
        <GalleryPhotosSection fel={fel} id={id} />
      </form>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.getPozeGalerie.mockReset().mockResolvedValue(poze)
  api.schimbaDescrierePoza.mockReset().mockResolvedValue(undefined)
})

test('la un curs nou cere salvarea înainte de poze', () => {
  afiseaza(null)
  expect(
    screen.getByText('Salvează cursul, apoi revino aici ca să adaugi poze în galerie.'),
  ).toBeInTheDocument()
  expect(api.getPozeGalerie).not.toHaveBeenCalled()
})

test('încărcarea pornește doar după bifa de acord a părinților', async () => {
  const user = userEvent.setup()
  afiseaza()
  const buton = await screen.findByRole('button', { name: 'Adaugă poze' })
  expect(buton).toBeDisabled()
  await user.click(screen.getByRole('checkbox', { name: /acordul scris al părinților/ }))
  expect(buton).toBeEnabled()
  expect(screen.getByText('1 din 12 poze')).toBeInTheDocument()
})

test('descrierea se salvează la Enter, fără să trimită formularul cursului', async () => {
  const user = userEvent.setup()
  afiseaza()
  const camp = await screen.findByRole('textbox', { name: 'Descrierea pozei 1' })
  expect(camp).toHaveValue('Încălzirea')
  await user.clear(camp)
  await user.type(camp, 'Încălzirea pe mal{Enter}')
  expect(api.schimbaDescrierePoza).toHaveBeenCalledWith('course_photos', 'a', 'Încălzirea pe mal')
})

test('la activitate citește galeria activității și are titlul ei', async () => {
  afiseaza('a1', 'activitate')
  expect(screen.getByText('Galeria „Din activitate”')).toBeInTheDocument()
  await screen.findByRole('textbox', { name: 'Descrierea pozei 1' })
  expect(api.getPozeGalerie).toHaveBeenCalledWith(
    expect.objectContaining({ tabel: 'activity_photos', bucket: 'activity-photos', id: 'a1' }),
  )
})

test('la o activitate nouă cere salvarea înainte de poze', () => {
  afiseaza(null, 'activitate')
  expect(
    screen.getByText('Salvează activitatea, apoi revino aici ca să adaugi poze în galerie.'),
  ).toBeInTheDocument()
})
