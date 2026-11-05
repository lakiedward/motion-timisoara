import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CheckoutPage from './CheckoutPage'
import { getActivity } from '@/api/public'

vi.mock('@/api/public', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/public')>()),
  getActivity: vi.fn(),
}))

let utilizator: { id: string; role: string } | null = null
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: utilizator }) }))

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/checkout?kind=ACTIVITY&id=act-1']}>
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
