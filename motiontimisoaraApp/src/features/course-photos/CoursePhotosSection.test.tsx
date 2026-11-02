import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import CoursePhotosSection from './CoursePhotosSection'

const api = vi.hoisted(() => ({
  getPozeleCursului: vi.fn(),
  schimbaDescrierePoza: vi.fn(),
}))

vi.mock('@/api/course-photos', () => ({
  MAX_POZE_CURS: 12,
  MAX_DESCRIERE_POZA: 60,
  adaugaPozeCurs: vi.fn(),
  getPozeleCursului: api.getPozeleCursului,
  mutaPozaCurs: vi.fn(),
  schimbaDescrierePoza: api.schimbaDescrierePoza,
  stergePozaCurs: vi.fn(),
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

function afiseaza(courseId: string | null = 'c1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <form onSubmit={(e) => e.preventDefault()}>
        <CoursePhotosSection courseId={courseId} />
      </form>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.getPozeleCursului.mockReset().mockResolvedValue(poze)
  api.schimbaDescrierePoza.mockReset().mockResolvedValue(undefined)
})

test('la un curs nou cere salvarea înainte de poze', () => {
  afiseaza(null)
  expect(
    screen.getByText('Salvează cursul, apoi revino aici ca să adaugi poze în galerie.'),
  ).toBeInTheDocument()
  expect(api.getPozeleCursului).not.toHaveBeenCalled()
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
  expect(api.schimbaDescrierePoza).toHaveBeenCalledWith('a', 'Încălzirea pe mal')
})
