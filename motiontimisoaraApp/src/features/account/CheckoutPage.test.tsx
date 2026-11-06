import { vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CheckoutPage from './CheckoutPage'
import { getActivity, getCourse } from '@/api/public'

vi.mock('@/api/public', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/public')>()),
  getActivity: vi.fn(),
  getCourse: vi.fn(),
}))

let utilizator: { id: string; role: string } | null = null
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: utilizator }) }))

function deseneaza(url = '/account/checkout?kind=ACTIVITY&id=act-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <CheckoutPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test.each(['COACH', 'CLUB', 'ADMIN'])(
  'contul %s nu intră în pașii de înscriere și primește explicația în română',
  (role) => {
    utilizator = { id: 'u-1', role }
    deseneaza()
    expect(
      screen.getByRole('heading', { name: 'Înscrierile se fac dintr-un cont de părinte.' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/nu este de părinte/)).toBeInTheDocument()
    expect(screen.queryByText(/Only parents/)).not.toBeInTheDocument()
    expect(vi.mocked(getActivity)).not.toHaveBeenCalled()
  },
)

test('o cădere de rețea la citirea cursului arată eroare cu reîncercare, nu „nu am găsit”', async () => {
  utilizator = { id: 'p-1', role: 'PARENT' }
  vi.mocked(getCourse).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(null)
  deseneaza('/account/checkout?kind=COURSE&id=curs-1')
  expect(await screen.findByText('Nu am putut încărca oferta.')).toBeInTheDocument()
  expect(screen.queryByText(/Nu am găsit acest program/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText(/Nu am găsit acest program/)).toBeInTheDocument()
})
